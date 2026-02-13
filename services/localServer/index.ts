/**
 * Local Server — start/stop lifecycle and session management.
 *
 * This module spins up a local HTTP + WebSocket server on the phone
 * so a browser on the same LAN can access threads and notes.
 */
import type { SQLiteDatabase } from 'expo-sqlite'
import { Platform, type NativeEventSubscription } from 'react-native'
import * as ExpoLocalServer from '../../modules/expo-local-server'
import { Router } from './router'
import { setSessionToken, clearSessionToken } from './middleware/sessionAuth'
import { registerHandshakeRoutes } from './routes/handshake'
import { registerThreadRoutes } from './routes/threads'
import { registerNoteRoutes } from './routes/notes'
import { registerSearchRoutes } from './routes/search'
import { registerTaskRoutes } from './routes/tasks'
import { registerFileRoutes } from './routes/files'
import { registerWebRoutes } from './routes/web'
import {
  handleWebSocketConnect,
  handleWebSocketDisconnect,
  handleWebSocketMessage,
} from './websocket/handler'
import { setBroadcastFunction, clearBroadcastFunction, broadcastSessionExpired } from './websocket/eventBroadcaster'
import { startChangeDetector, stopChangeDetector, setOnChangeCallback } from './websocket/changeDetector'
import { getWebSession, setWebSession, clearWebSession, getSavedWebServerPort } from '../storage'

import type { EventSubscription } from 'expo-modules-core'

interface ServerSession {
  token: string
  port: number
  ip: string
  baseUrl: string
  startedAt: number
}

let currentSession: ServerSession | null = null
let appStateSubscription: NativeEventSubscription | null = null
let eventSubscriptions: EventSubscription[] = []

/**
 * Generate a cryptographically random hex token.
 */
function generateToken(): string {
  const bytes = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Pick a random high port between 49152 and 65535.
 */
function randomPort(): number {
  return 49152 + Math.floor(Math.random() * (65535 - 49152))
}

/**
 * Start the local server and return session info for the QR code.
 * @param sessionPort — optional port to reuse (for restoring a persisted session)
 */
export async function startLocalServer(db: SQLiteDatabase, sessionToken?: string, onDataChange?: () => void, sessionPort?: number): Promise<{
  token: string
  port: number
  ip: string
  baseUrl: string
}> {
  // Stop any existing session
  if (currentSession) {
    await stopLocalServer()
  }

  const token = sessionToken ?? generateToken()
  const port = sessionPort ?? (await getSavedWebServerPort()) ?? randomPort()

  // Set up the session token for auth
  setSessionToken(token)

  // Create router and register all routes
  const router = new Router()

  registerHandshakeRoutes(router)
  registerThreadRoutes(router, db)
  registerNoteRoutes(router, db)
  registerSearchRoutes(router, db)
  registerTaskRoutes(router, db)
  registerFileRoutes(router, (requestId, statusCode, headers, filePath) => {
    ExpoLocalServer.sendFileResponse(requestId, statusCode, headers, filePath)
  })
  registerWebRoutes(router)

  // Start the native HTTP server
  const { url } = await ExpoLocalServer.startServer(port)
  const ip = await ExpoLocalServer.getLocalIpAddress()
  const baseUrl = `http://${ip}:${port}`
  router.setBaseUrl(baseUrl)

  // Handle HTTP requests — store subscription for cleanup
  eventSubscriptions.push(
    ExpoLocalServer.onRequest((req) => {
      console.log(`[LocalServer] ${req.method} ${req.path}`)
      router.handle({
        id: req.id,
        method: req.method,
        path: req.path,
        headers: req.headers,
        query: req.query,
        body: req.body,
      }).then((response) => {
        console.log(`[LocalServer] → ${response.statusCode} (${response.body.length} bytes)`)
        // statusCode -1 means the response was already sent (file streaming)
        if (response.statusCode !== -1) {
          ExpoLocalServer.sendResponse(req.id, response.statusCode, response.headers, response.body)
        }
      }).catch((error) => {
        console.error('[LocalServer] Request handling error:', error)
        ExpoLocalServer.sendResponse(req.id, 500, { 'Content-Type': 'application/json' }, JSON.stringify({ error: 'Internal server error' }))
      })
    })
  )

  // Handle WebSocket connections
  eventSubscriptions.push(
    ExpoLocalServer.onWebSocketConnect(({ clientId }) => {
      handleWebSocketConnect(clientId)
    })
  )

  eventSubscriptions.push(
    ExpoLocalServer.onWebSocketMessage(({ clientId, message }) => {
      const response = handleWebSocketMessage(clientId, message)
      if (response) {
        ExpoLocalServer.sendWebSocketMessage(clientId, response)
      }
    })
  )

  // Set up broadcast function for event broadcaster
  setBroadcastFunction((message) => {
    ExpoLocalServer.broadcastWebSocket(message)
  })

  // Start change detector for phone-side mutations
  if (onDataChange) setOnChangeCallback(onDataChange)
  await startChangeDetector(db, baseUrl)

  // Start background persistence to keep server alive
  if (Platform.OS === 'android') {
    ExpoLocalServer.startForegroundService()
  } else {
    ExpoLocalServer.startBackgroundKeepAlive()
  }

  // Store session
  currentSession = { token, port, ip, baseUrl, startedAt: Date.now() }

  // Persist session to AsyncStorage for auto-restore on next app launch
  await setWebSession(token, port)

  console.log(`[LocalServer] Started at ${baseUrl}`)

  return { token, port, ip, baseUrl }
}

/**
 * Stop the local server and clean up.
 */
export async function stopLocalServer(): Promise<void> {
  if (!currentSession) return

  // Stop background persistence
  if (Platform.OS === 'android') {
    ExpoLocalServer.stopForegroundService()
  } else {
    ExpoLocalServer.stopBackgroundKeepAlive()
  }

  // Broadcast session expiry to connected clients
  broadcastSessionExpired('Server stopped')

  // Stop change detector
  setOnChangeCallback(null)
  stopChangeDetector()

  // Clear broadcast function
  clearBroadcastFunction()

  // Remove event subscriptions
  for (const sub of eventSubscriptions) {
    sub.remove()
  }
  eventSubscriptions = []

  // Stop native server
  await ExpoLocalServer.stopServer()

  // Clear auth
  clearSessionToken()

  // Clear persisted session so next app launch won't auto-start
  await clearWebSession()

  if (appStateSubscription) {
    appStateSubscription.remove()
    appStateSubscription = null
  }

  console.log(`[LocalServer] Stopped`)
  currentSession = null
}

/**
 * Get current session info (or null if not running).
 */
export function getLocalServerSession(): ServerSession | null {
  return currentSession
}

/**
 * Check if the local server is running.
 */
export function isLocalServerRunning(): boolean {
  return currentSession !== null
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Restore a previously persisted web session on app launch.
 * Reads token+port from AsyncStorage, checks expiry (30 days),
 * and re-starts the server on the same port with the same token.
 * Returns true if restore succeeded, false otherwise.
 */
export async function restoreLocalServer(
  db: SQLiteDatabase,
  onDataChange?: () => void
): Promise<boolean> {
  if (currentSession) return true // already running

  const saved = await getWebSession()
  if (!saved) return false

  // Check 30-day expiry
  if (Date.now() - saved.createdAt > THIRTY_DAYS_MS) {
    console.log('[LocalServer] Persisted session expired (>30 days), clearing')
    await clearWebSession()
    return false
  }

  try {
    await startLocalServer(db, saved.token, onDataChange, saved.port)
    console.log('[LocalServer] Restored persisted session on port', saved.port)
    return true
  } catch (err) {
    console.warn('[LocalServer] Failed to restore session (port busy?):', err)
    await clearWebSession()
    return false
  }
}

