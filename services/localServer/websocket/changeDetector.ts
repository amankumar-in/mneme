/**
 * Polls SQLite for changes made on the phone side (outside of web client requests)
 * and broadcasts them as WebSocket events to connected browsers.
 *
 * Uses updated_at > lastCheck to detect modifications.
 */
import type { SQLiteDatabase } from 'expo-sqlite'
import { getThreadRepository } from '../../repositories/thread.repository'
import { getNoteRepository } from '../../repositories/note.repository'
import type { NoteRow, ThreadRow, NoteWithDetails } from '../../database/types'
import {
  broadcastNoteCreated,
  broadcastNoteUpdated,
  broadcastNoteDeleted,
  broadcastThreadCreated,
  broadcastThreadUpdated,
  broadcastThreadDeleted,
} from './eventBroadcaster'
import { rewriteNoteUrls } from '../utils/rewriteUrls'

let pollInterval: ReturnType<typeof setInterval> | null = null
let lastCheckTimestamp: string = ''
let baseUrl: string = ''

// Track known IDs so we can detect creates vs updates
let knownNoteIds: Set<string> = new Set()
let knownThreadIds: Set<string> = new Set()
let initialized = false

export async function startChangeDetector(
  db: SQLiteDatabase,
  serverBaseUrl: string,
  intervalMs: number = 1000
): Promise<void> {
  baseUrl = serverBaseUrl

  if (pollInterval) stopChangeDetector()

  // Initialize known IDs and timestamp
  lastCheckTimestamp = new Date().toISOString()

  // Load current IDs
  const existingNotes = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM notes WHERE deleted_at IS NULL'
  )
  const existingThreads = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM threads WHERE deleted_at IS NULL'
  )
  knownNoteIds = new Set(existingNotes.map((n) => n.id))
  knownThreadIds = new Set(existingThreads.map((t) => t.id))
  initialized = true

  pollInterval = setInterval(() => {
    pollForChanges(db).catch((err) => {
      console.error('[ChangeDetector] Poll error:', err)
    })
  }, intervalMs)
}

export function stopChangeDetector(): void {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  initialized = false
  knownNoteIds.clear()
  knownThreadIds.clear()
}

async function pollForChanges(db: SQLiteDatabase): Promise<void> {
  if (!initialized) return

  const now = new Date().toISOString()
  const threadRepo = getThreadRepository(db)
  const noteRepo = getNoteRepository(db)

  // Check for changed notes
  const changedNotes = await db.getAllAsync<NoteRow>(
    `SELECT n.*, t.name as thread_name FROM notes n
     LEFT JOIN threads t ON n.thread_id = t.id
     WHERE n.updated_at > ?
     ORDER BY n.updated_at ASC`,
    [lastCheckTimestamp]
  )

  for (const row of changedNotes) {
    if (row.deleted_at) {
      // Note was deleted
      if (knownNoteIds.has(row.id)) {
        knownNoteIds.delete(row.id)
        broadcastNoteDeleted(row.thread_id, row.id)
      }
    } else if (!knownNoteIds.has(row.id)) {
      // New note
      knownNoteIds.add(row.id)
      const note = await noteRepo.getById(row.id)
      if (note) {
        broadcastNoteCreated(note.threadId, rewriteNoteUrls(note, baseUrl))
      }
    } else {
      // Updated note
      const note = await noteRepo.getById(row.id)
      if (note) {
        broadcastNoteUpdated(note.threadId, rewriteNoteUrls(note, baseUrl))
      }
    }
  }

  // Check for changed threads
  const changedThreads = await db.getAllAsync<ThreadRow>(
    `SELECT * FROM threads WHERE updated_at > ? ORDER BY updated_at ASC`,
    [lastCheckTimestamp]
  )

  for (const row of changedThreads) {
    if (row.deleted_at) {
      if (knownThreadIds.has(row.id)) {
        knownThreadIds.delete(row.id)
        broadcastThreadDeleted(row.id)
      }
    } else if (!knownThreadIds.has(row.id)) {
      knownThreadIds.add(row.id)
      const thread = await threadRepo.getById(row.id)
      if (thread) {
        broadcastThreadCreated(thread)
      }
    } else {
      const thread = await threadRepo.getById(row.id)
      if (thread) {
        broadcastThreadUpdated(thread)
      }
    }
  }

  lastCheckTimestamp = now
}
