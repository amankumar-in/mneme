/**
 * WebSocket connection management and authentication for the local server.
 */
import { getSessionToken } from '../middleware/sessionAuth'

interface WebSocketClient {
  clientId: string
  authenticated: boolean
  connectedAt: number
}

const clients = new Map<string, WebSocketClient>()

export function handleWebSocketConnect(clientId: string): void {
  clients.set(clientId, {
    clientId,
    authenticated: false,
    connectedAt: Date.now(),
  })
}

export function handleWebSocketDisconnect(clientId: string): void {
  clients.delete(clientId)
}

/**
 * Handle incoming WebSocket message.
 * Returns a response message to send back, or null.
 */
export function handleWebSocketMessage(
  clientId: string,
  message: string
): string | null {
  const client = clients.get(clientId)
  if (!client) return JSON.stringify({ type: 'error', error: 'Unknown client' })

  try {
    const data = JSON.parse(message)

    // Auth message
    if (data.type === 'auth') {
      const token = getSessionToken()
      if (token && data.token === token) {
        client.authenticated = true
        return JSON.stringify({ type: 'auth', status: 'ok' })
      }
      return JSON.stringify({ type: 'auth', status: 'error', error: 'Invalid token' })
    }

    // All other messages require authentication
    if (!client.authenticated) {
      return JSON.stringify({ type: 'error', error: 'Not authenticated' })
    }

    // Handle pong (client keepalive response)
    if (data.type === 'pong') {
      return null
    }

    return null
  } catch {
    return JSON.stringify({ type: 'error', error: 'Invalid message format' })
  }
}

export function getAuthenticatedClientIds(): string[] {
  return Array.from(clients.entries())
    .filter(([_, client]) => client.authenticated)
    .map(([id]) => id)
}

export function getConnectedClientCount(): number {
  return clients.size
}

export function getAuthenticatedClientCount(): number {
  return Array.from(clients.values()).filter((c) => c.authenticated).length
}
