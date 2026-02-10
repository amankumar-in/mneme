import type { SQLiteDatabase } from 'expo-sqlite'
import {
    fromBoolean,
    generateUUID,
    getTimestamp,
    toBoolean,
    type CreateThreadInput,
    type NoteType,
    type PaginatedResult,
    type SyncStatus,
    type ThreadRow,
    type ThreadWithLastNote,
    type UpdateThreadInput,
} from '../database'

export class ThreadRepository {
  constructor(private db: SQLiteDatabase) {}

  /**
   * Create a new thread
   */
  async create(input: CreateThreadInput): Promise<ThreadWithLastNote> {
    const id = generateUUID()
    const now = getTimestamp()

    await this.db.runAsync(
      `INSERT INTO threads (id, name, icon, is_pinned, sync_status, created_at, updated_at)
       VALUES (?, ?, ?, 0, 'pending', ?, ?)`,
      [id, input.name, input.icon ?? null, now, now]
    )

    return this.getById(id) as Promise<ThreadWithLastNote>
  }

  /**
   * Get a thread row by local ID (for sync; returns raw row).
   */
  async getRowById(id: string): Promise<ThreadRow | null> {
    return this.db.getFirstAsync<ThreadRow>(
      `SELECT * FROM threads WHERE id = ? AND deleted_at IS NULL`,
      [id]
    )
  }

  /**
   * Get a thread by local ID
   */
  async getById(id: string): Promise<ThreadWithLastNote | null> {
    const row = await this.getRowById(id)
    if (!row) return null
    return this.mapToThread(row)
  }

  /**
   * Get a thread by server ID
   */
  async getByServerId(serverId: string): Promise<ThreadWithLastNote | null> {
    const row = await this.db.getFirstAsync<ThreadRow>(
      `SELECT * FROM threads WHERE server_id = ? AND deleted_at IS NULL`,
      [serverId]
    )

    if (!row) return null
    return this.mapToThread(row)
  }

  /**
   * Get all threads with optional filtering and pagination
   */
  async getAll(params?: {
    search?: string
    page?: number
    limit?: number
  }): Promise<PaginatedResult<ThreadWithLastNote>> {
    const page = params?.page ?? 1
    const limit = params?.limit ?? 20
    const offset = (page - 1) * limit
    const search = params?.search?.trim()

    let whereClause = 'WHERE deleted_at IS NULL'
    const queryParams: (string | number)[] = []

    if (search) {
      whereClause += ' AND name LIKE ?'
      queryParams.push(`%${search}%`)
    }

    // Get total count
    const countResult = await this.db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM threads ${whereClause}`,
      queryParams
    )
    const total = countResult?.count ?? 0

    // Get paginated results, ordered by pinned first, then last note timestamp
    const rows = await this.db.getAllAsync<ThreadRow>(
      `SELECT * FROM threads ${whereClause}
       ORDER BY is_pinned DESC,
                COALESCE(last_note_timestamp, updated_at) DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    )

    const threads = rows.map((row) => this.mapToThread(row))
    const hasMore = offset + rows.length < total

    return { data: threads, hasMore, total }
  }

  /**
   * Update a thread
   */
  async update(id: string, input: UpdateThreadInput): Promise<ThreadWithLastNote | null> {
    const thread = await this.getById(id)
    if (!thread) return null

    const updates: string[] = []
    const values: (string | number | null)[] = []

    if (input.name !== undefined) {
      updates.push('name = ?')
      values.push(input.name)
    }
    if (input.icon !== undefined) {
      updates.push('icon = ?')
      values.push(input.icon)
    }
    if (input.isPinned !== undefined) {
      updates.push('is_pinned = ?')
      values.push(fromBoolean(input.isPinned))
    }
    if (input.wallpaper !== undefined) {
      updates.push('wallpaper = ?')
      values.push(input.wallpaper)
    }

    if (updates.length === 0) return thread

    // Mark as pending sync and update timestamp
    updates.push('sync_status = ?', 'updated_at = ?')
    values.push('pending', getTimestamp())

    await this.db.runAsync(
      `UPDATE threads SET ${updates.join(', ')} WHERE id = ?`,
      [...values, id]
    )

    return this.getById(id)
  }

  /**
   * Soft delete a thread
   */
  async delete(id: string): Promise<{ success: boolean; lockedNotesCount: number }> {
    // Count locked notes
    const lockedResult = await this.db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM notes
       WHERE thread_id = ? AND is_locked = 1 AND deleted_at IS NULL`,
      [id]
    )
    const lockedNotesCount = lockedResult?.count ?? 0

    const now = getTimestamp()

    // Soft delete the thread
    await this.db.runAsync(
      `UPDATE threads SET deleted_at = ?, sync_status = 'pending', updated_at = ?
       WHERE id = ?`,
      [now, now, id]
    )

    // Soft delete all non-locked notes
    await this.db.runAsync(
      `UPDATE notes SET deleted_at = ?, sync_status = 'pending', updated_at = ?
       WHERE thread_id = ? AND is_locked = 0`,
      [now, now, id]
    )

    return { success: true, lockedNotesCount }
  }

  /**
   * Update last note info for a thread
   */
  async updateLastNote(
    threadId: string,
    content: string | null,
    type: NoteType,
    timestamp: string
  ): Promise<void> {
    await this.db.runAsync(
      `UPDATE threads
       SET last_note_content = ?, last_note_type = ?, last_note_timestamp = ?,
           updated_at = ?
       WHERE id = ?`,
      [content, type, timestamp, getTimestamp(), threadId]
    )
  }

  /**
   * Get threads with pending sync status
   */
  async getPendingSync(): Promise<ThreadRow[]> {
    return this.db.getAllAsync<ThreadRow>(
      `SELECT * FROM threads WHERE sync_status = 'pending'`
    )
  }

  /**
   * Get threads that have never been synced (no server_id). Used so we always
   * send every unsynced thread in push, regardless of sync_status or pending notes.
   */
  async getNeverSynced(): Promise<ThreadRow[]> {
    return this.db.getAllAsync<ThreadRow>(
      `SELECT * FROM threads WHERE server_id IS NULL AND deleted_at IS NULL`
    )
  }

  /**
   * Get all non-deleted thread rows (for sync). Ensures every thread on device is sent
   * so server can create or correct mappings (e.g. wrong server_id from merge).
   */
  async getAllNonDeletedRows(): Promise<ThreadRow[]> {
    return this.db.getAllAsync<ThreadRow>(
      `SELECT * FROM threads WHERE deleted_at IS NULL`
    )
  }

  /**
   * Mark a thread as synced with server ID
   */
  async markSynced(localId: string, serverId: string): Promise<void> {
    const existing = await this.db.getFirstAsync<ThreadRow>(
      `SELECT * FROM threads WHERE server_id = ? AND deleted_at IS NULL`,
      [serverId]
    )

    if (existing && existing.id !== localId) {
      // Merge local duplicate into existing server-backed thread
      await this.db.runAsync(
        `UPDATE notes SET thread_id = ? WHERE thread_id = ?`,
        [existing.id, localId]
      )

      const latestNote = await this.db.getFirstAsync<{
        content: string | null
        type: string | null
        created_at: string | null
      }>(
        `SELECT content, type, created_at
         FROM notes
         WHERE thread_id = ? AND deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1`,
        [existing.id]
      )

      if (latestNote) {
        await this.db.runAsync(
          `UPDATE threads SET
             last_note_content = ?,
             last_note_type = ?,
             last_note_timestamp = ?,
             updated_at = ?
           WHERE id = ?`,
          [
            latestNote.content ?? null,
            latestNote.type ?? null,
            latestNote.created_at ?? null,
            getTimestamp(),
            existing.id,
          ]
        )
      }

      await this.db.runAsync(
        `DELETE FROM threads WHERE id = ?`,
        [localId]
      )
      return
    }

    await this.db.runAsync(
      `UPDATE threads SET server_id = ?, sync_status = 'synced' WHERE id = ?`,
      [serverId, localId]
    )
  }

  /**
   * Upsert a thread from server data (for sync)
   */
  async upsertFromServer(serverThread: {
    _id: string
    name: string
    icon?: string
    isPinned: boolean
    wallpaper?: string
    lastNote?: {
      content: string
      type: NoteType
      timestamp: string
    }
    createdAt: string
    updatedAt: string
  }): Promise<void> {
    const existing = await this.getByServerId(serverThread._id)

    if (existing) {
      // Update existing
      await this.db.runAsync(
        `UPDATE threads SET
           name = ?, icon = ?, is_pinned = ?, wallpaper = ?,
           last_note_content = ?, last_note_type = ?, last_note_timestamp = ?,
           sync_status = 'synced', updated_at = ?
         WHERE server_id = ?`,
        [
          serverThread.name,
          serverThread.icon ?? null,
          fromBoolean(serverThread.isPinned),
          serverThread.wallpaper ?? null,
          serverThread.lastNote?.content ?? null,
          serverThread.lastNote?.type ?? null,
          serverThread.lastNote?.timestamp ?? null,
          serverThread.updatedAt,
          serverThread._id,
        ]
      )
    } else {
      // Insert new
      const id = generateUUID()
      await this.db.runAsync(
        `INSERT INTO threads (
           id, server_id, name, icon, is_pinned, wallpaper,
           last_note_content, last_note_type, last_note_timestamp,
           sync_status, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?)`,
        [
          id,
          serverThread._id,
          serverThread.name,
          serverThread.icon ?? null,
          fromBoolean(serverThread.isPinned),
          serverThread.wallpaper ?? null,
          serverThread.lastNote?.content ?? null,
          serverThread.lastNote?.type ?? null,
          serverThread.lastNote?.timestamp ?? null,
          serverThread.createdAt,
          serverThread.updatedAt,
        ]
      )
    }
  }

  /**
   * Map database row to ThreadWithLastNote
   */
  private mapToThread(row: ThreadRow): ThreadWithLastNote {
    return {
      id: row.id,
      serverId: row.server_id,
      name: row.name,
      icon: row.icon,
      isPinned: toBoolean(row.is_pinned),
      isSystemThread: toBoolean(row.is_system_thread),
      isLocked: toBoolean(row.is_locked),
      wallpaper: row.wallpaper,
      lastNote:
        row.last_note_content || row.last_note_type
          ? {
              content: row.last_note_content ?? '',
              type: (row.last_note_type as NoteType) ?? 'text',
              timestamp: row.last_note_timestamp ?? row.updated_at,
            }
          : null,
      syncStatus: row.sync_status as SyncStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}

// Singleton instance holder
let threadRepositoryInstance: ThreadRepository | null = null

/**
 * Get or create ThreadRepository instance
 */
export function getThreadRepository(db: SQLiteDatabase): ThreadRepository {
  if (!threadRepositoryInstance) {
    threadRepositoryInstance = new ThreadRepository(db)
  }
  return threadRepositoryInstance
}
