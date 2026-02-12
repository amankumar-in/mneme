/**
 * Singleton event broadcaster for WebSocket real-time events.
 * Broadcasts mutation events to all connected browser clients.
 */
import type { NoteWithDetails, ThreadWithLastNote } from '../../database/types'

type BroadcastFn = (message: string) => void

let broadcastFn: BroadcastFn | null = null
let pingInterval: ReturnType<typeof setInterval> | null = null

export function setBroadcastFunction(fn: BroadcastFn): void {
  broadcastFn = fn
  // Start ping interval (every 30s)
  if (pingInterval) clearInterval(pingInterval)
  pingInterval = setInterval(() => {
    broadcast('ping', { timestamp: Date.now() })
  }, 30000)
}

export function clearBroadcastFunction(): void {
  broadcastFn = null
  if (pingInterval) {
    clearInterval(pingInterval)
    pingInterval = null
  }
}

function broadcast(event: string, data: Record<string, unknown>): void {
  if (!broadcastFn) return
  try {
    broadcastFn(JSON.stringify({ type: event, ...data }))
  } catch (error) {
    console.error('[EventBroadcaster] Failed to broadcast:', error)
  }
}

// Note events
export function broadcastNoteCreated(threadId: string, note: NoteWithDetails): void {
  broadcast('note:created', { threadId, note })
}

export function broadcastNoteUpdated(threadId: string, note: NoteWithDetails): void {
  broadcast('note:updated', { threadId, note })
}

export function broadcastNoteDeleted(threadId: string, noteId: string): void {
  broadcast('note:deleted', { threadId, noteId })
}

// Thread events
export function broadcastThreadCreated(thread: ThreadWithLastNote): void {
  broadcast('thread:created', { thread })
}

export function broadcastThreadUpdated(thread: ThreadWithLastNote): void {
  broadcast('thread:updated', { thread })
}

export function broadcastThreadDeleted(threadId: string): void {
  broadcast('thread:deleted', { threadId })
}

// Session events
export function broadcastSessionExpired(reason: string): void {
  broadcast('session:expired', { reason })
}
