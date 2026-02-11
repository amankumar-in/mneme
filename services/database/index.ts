// Database initialization and migration utilities
import type { SQLiteDatabase } from 'expo-sqlite'
import { DATABASE_VERSION, SCHEMA_V1, MIGRATIONS } from './schema'

/**
 * Initialize the database with schema and run migrations
 * This is called by SQLiteProvider's onInit callback
 */
export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  // Get current database version
  const result = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  )
  let currentVersion = result?.user_version ?? 0

  // Fresh database - create initial schema
  if (currentVersion === 0) {
    await db.execAsync(SCHEMA_V1)
    // V1 schema already includes columns from migrations 2–8
    // (is_system_thread, notification_id, link_preview_*, attachment_waveform, thread is_locked, note is_pinned, boards),
    // so skip to current version to avoid duplicate ALTER TABLE errors.
    currentVersion = 8
  }

  // Run any pending migrations
  while (currentVersion < DATABASE_VERSION) {
    const nextVersion = currentVersion + 1
    const migration = MIGRATIONS[nextVersion]

    if (migration) {
      await db.execAsync(migration)
    }

    currentVersion = nextVersion
  }

  // Ensure columns exist even if ALTER TABLE didn't persist during migration
  const columns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(notes)'
  )
  const columnNames = new Set(columns.map(col => col.name))

  if (!columnNames.has('notification_id')) {
    await db.execAsync('ALTER TABLE notes ADD COLUMN notification_id TEXT')
  }
  if (!columnNames.has('link_preview_url')) {
    await db.execAsync('ALTER TABLE notes ADD COLUMN link_preview_url TEXT')
  }
  if (!columnNames.has('link_preview_title')) {
    await db.execAsync('ALTER TABLE notes ADD COLUMN link_preview_title TEXT')
  }
  if (!columnNames.has('link_preview_description')) {
    await db.execAsync('ALTER TABLE notes ADD COLUMN link_preview_description TEXT')
  }
  if (!columnNames.has('link_preview_image')) {
    await db.execAsync('ALTER TABLE notes ADD COLUMN link_preview_image TEXT')
  }
  if (!columnNames.has('attachment_waveform')) {
    await db.execAsync('ALTER TABLE notes ADD COLUMN attachment_waveform TEXT')
  }
  if (!columnNames.has('is_pinned')) {
    await db.execAsync('ALTER TABLE notes ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0')
  }

  // Check threads table columns
  const threadColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(threads)'
  )
  const threadColumnNames = new Set(threadColumns.map(col => col.name))

  if (!threadColumnNames.has('is_locked')) {
    await db.execAsync('ALTER TABLE threads ADD COLUMN is_locked INTEGER NOT NULL DEFAULT 0')
  }

  // Check board_strokes table columns (old migration 7 may have created it without these)
  const boardStrokeTables = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='board_strokes'"
  )
  if (boardStrokeTables.length > 0) {
    const bsColumns = await db.getAllAsync<{ name: string }>(
      'PRAGMA table_info(board_strokes)'
    )
    const bsColumnNames = new Set(bsColumns.map(col => col.name))

    if (!bsColumnNames.has('x_offset')) {
      await db.execAsync('ALTER TABLE board_strokes ADD COLUMN x_offset REAL NOT NULL DEFAULT 0')
    }
    if (!bsColumnNames.has('y_offset')) {
      await db.execAsync('ALTER TABLE board_strokes ADD COLUMN y_offset REAL NOT NULL DEFAULT 0')
    }
  }

  // Reset stale sync flag — if the app just launched, nothing is syncing
  await db.runAsync('UPDATE sync_meta SET is_syncing = 0 WHERE id = 1')

  // Refresh Protected Notes thread preview with the most recent locked note
  const latestLocked = await db.getFirstAsync<{
    content: string | null
    type: string | null
    created_at: string | null
  }>(
    `SELECT content, type, created_at FROM notes
     WHERE is_locked = 1 AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT 1`
  )
  if (latestLocked) {
    await db.runAsync(
      `UPDATE threads SET
         last_note_content = ?, last_note_type = ?, last_note_timestamp = ?
       WHERE id = 'system-protected-notes'`,
      [latestLocked.content, latestLocked.type, latestLocked.created_at]
    )
  }

  // Update the database version
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`)
}

/**
 * Generate a UUID v4 for local entity IDs
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Get current ISO timestamp
 */
export function getTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Convert SQLite integer (0/1) to boolean
 */
export function toBoolean(value: number | null | undefined): boolean {
  return value === 1
}

/**
 * Convert boolean to SQLite integer (0/1)
 */
export function fromBoolean(value: boolean | undefined | null): number {
  return value ? 1 : 0
}

// Re-export types and constants
export * from './types'
export * from './schema'
