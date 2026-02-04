import type { SQLiteDatabase } from 'expo-sqlite'
import {
  generateUUID,
  getTimestamp,
  toBoolean,
  fromBoolean,
  type NoteRow,
  type NoteWithDetails,
  type CreateNoteInput,
  type UpdateNoteInput,
  type TaskInput,
  type SyncStatus,
  type NoteType,
  type PaginatedResult,
  type NoteCursor,
  type TaskFilter,
} from '../database'

export class NoteRepository {
  constructor(private db: SQLiteDatabase) {}

  /**
   * Create a new note
   */
  async create(input: CreateNoteInput): Promise<NoteWithDetails> {
    const id = generateUUID()
    const now = getTimestamp()

    await this.db.runAsync(
      `INSERT INTO notes (
         id, thread_id, content, type,
         attachment_url, attachment_filename, attachment_mime_type,
         attachment_size, attachment_duration, attachment_thumbnail,
         attachment_width, attachment_height,
         location_latitude, location_longitude, location_address,
         sync_status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        id,
        input.threadId,
        input.content ?? null,
        input.type,
        input.attachment?.url ?? null,
        input.attachment?.filename ?? null,
        input.attachment?.mimeType ?? null,
        input.attachment?.size ?? null,
        input.attachment?.duration ?? null,
        input.attachment?.thumbnail ?? null,
        input.attachment?.width ?? null,
        input.attachment?.height ?? null,
        input.location?.latitude ?? null,
        input.location?.longitude ?? null,
        input.location?.address ?? null,
        now,
        now,
      ]
    )

    return this.getById(id) as Promise<NoteWithDetails>
  }

  /**
   * Get a note by local ID
   */
  async getById(id: string): Promise<NoteWithDetails | null> {
    const row = await this.db.getFirstAsync<NoteRow>(
      `SELECT n.*, t.name as thread_name
       FROM notes n
       LEFT JOIN threads t ON n.thread_id = t.id
       WHERE n.id = ? AND n.deleted_at IS NULL`,
      [id]
    )

    if (!row) return null
    return this.mapToNote(row)
  }

  /**
   * Get a note by server ID
   */
  async getByServerId(serverId: string): Promise<NoteWithDetails | null> {
    const row = await this.db.getFirstAsync<NoteRow>(
      `SELECT n.*, t.name as thread_name
       FROM notes n
       LEFT JOIN threads t ON n.thread_id = t.id
       WHERE n.server_id = ? AND n.deleted_at IS NULL`,
      [serverId]
    )

    if (!row) return null
    return this.mapToNote(row)
  }

  /**
   * Get notes for a thread with cursor-based pagination
   */
  async getByThread(
    threadId: string,
    cursor?: NoteCursor
  ): Promise<PaginatedResult<NoteWithDetails>> {
    const limit = cursor?.limit ?? 50

    let whereClause = 'WHERE n.thread_id = ? AND n.deleted_at IS NULL'
    const queryParams: (string | number)[] = [threadId]

    if (cursor?.before) {
      whereClause += ' AND n.created_at < ?'
      queryParams.push(cursor.before)
    }
    if (cursor?.after) {
      whereClause += ' AND n.created_at > ?'
      queryParams.push(cursor.after)
    }

    // Get total count for this thread
    const countResult = await this.db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM notes n ${whereClause}`,
      queryParams
    )
    const total = countResult?.count ?? 0

    // Get notes, newest first
    const rows = await this.db.getAllAsync<NoteRow>(
      `SELECT n.*, t.name as thread_name
       FROM notes n
       LEFT JOIN threads t ON n.thread_id = t.id
       ${whereClause}
       ORDER BY n.created_at DESC
       LIMIT ?`,
      [...queryParams, limit + 1] // Fetch one extra to check if there's more
    )

    const hasMore = rows.length > limit
    const notes = rows.slice(0, limit).map((row) => this.mapToNote(row))

    return { data: notes, hasMore, total }
  }

  /**
   * Update a note
   */
  async update(id: string, input: UpdateNoteInput): Promise<NoteWithDetails | null> {
    const note = await this.getById(id)
    if (!note) return null

    const now = getTimestamp()

    await this.db.runAsync(
      `UPDATE notes SET content = ?, is_edited = 1, sync_status = 'pending', updated_at = ?
       WHERE id = ?`,
      [input.content ?? note.content, now, id]
    )

    return this.getById(id)
  }

  /**
   * Soft delete a note
   */
  async delete(id: string): Promise<void> {
    const now = getTimestamp()

    await this.db.runAsync(
      `UPDATE notes SET deleted_at = ?, sync_status = 'pending', updated_at = ?
       WHERE id = ?`,
      [now, now, id]
    )
  }

  /**
   * Toggle note lock status
   */
  async setLocked(id: string, isLocked: boolean): Promise<NoteWithDetails | null> {
    const now = getTimestamp()

    await this.db.runAsync(
      `UPDATE notes SET is_locked = ?, sync_status = 'pending', updated_at = ?
       WHERE id = ?`,
      [fromBoolean(isLocked), now, id]
    )

    return this.getById(id)
  }

  /**
   * Toggle note star status
   */
  async setStarred(id: string, isStarred: boolean): Promise<NoteWithDetails | null> {
    const now = getTimestamp()

    await this.db.runAsync(
      `UPDATE notes SET is_starred = ?, sync_status = 'pending', updated_at = ?
       WHERE id = ?`,
      [fromBoolean(isStarred), now, id]
    )

    return this.getById(id)
  }

  /**
   * Set task properties on a note
   */
  async setTask(id: string, input: TaskInput): Promise<NoteWithDetails | null> {
    const now = getTimestamp()

    await this.db.runAsync(
      `UPDATE notes SET
         is_task = ?,
         reminder_at = ?,
         is_completed = ?,
         completed_at = ?,
         sync_status = 'pending',
         updated_at = ?
       WHERE id = ?`,
      [
        fromBoolean(input.isTask),
        input.reminderAt ?? null,
        fromBoolean(input.isCompleted ?? false),
        input.isCompleted ? now : null,
        now,
        id,
      ]
    )

    return this.getById(id)
  }

  /**
   * Complete a task
   */
  async completeTask(id: string): Promise<NoteWithDetails | null> {
    const now = getTimestamp()

    await this.db.runAsync(
      `UPDATE notes SET
         is_completed = 1,
         completed_at = ?,
         sync_status = 'pending',
         updated_at = ?
       WHERE id = ?`,
      [now, now, id]
    )

    return this.getById(id)
  }

  /**
   * Get tasks with optional filtering
   */
  async getTasks(params?: {
    filter?: TaskFilter
    threadId?: string
    page?: number
    limit?: number
  }): Promise<PaginatedResult<NoteWithDetails>> {
    const page = params?.page ?? 1
    const limit = params?.limit ?? 20
    const offset = (page - 1) * limit
    const filter = params?.filter ?? 'all'

    let whereClause = 'WHERE n.is_task = 1 AND n.deleted_at IS NULL'
    const queryParams: (string | number)[] = []

    if (params?.threadId) {
      whereClause += ' AND n.thread_id = ?'
      queryParams.push(params.threadId)
    }

    const now = new Date().toISOString()

    switch (filter) {
      case 'pending':
        whereClause += ' AND n.is_completed = 0'
        break
      case 'completed':
        whereClause += ' AND n.is_completed = 1'
        break
      case 'overdue':
        whereClause += ' AND n.is_completed = 0 AND n.reminder_at IS NOT NULL AND n.reminder_at < ?'
        queryParams.push(now)
        break
      // 'all' - no additional filter
    }

    // Get total count
    const countResult = await this.db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM notes n ${whereClause}`,
      queryParams
    )
    const total = countResult?.count ?? 0

    // Get paginated results, ordered by reminder date then created date
    const rows = await this.db.getAllAsync<NoteRow>(
      `SELECT n.*, t.name as thread_name
       FROM notes n
       LEFT JOIN threads t ON n.thread_id = t.id
       ${whereClause}
       ORDER BY
         n.is_completed ASC,
         CASE WHEN n.reminder_at IS NOT NULL THEN 0 ELSE 1 END,
         n.reminder_at ASC,
         n.created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    )

    const tasks = rows.map((row) => this.mapToNote(row))
    const hasMore = offset + rows.length < total

    return { data: tasks, hasMore, total }
  }

  /**
   * Get upcoming tasks within a number of days
   */
  async getUpcomingTasks(days: number = 7): Promise<NoteWithDetails[]> {
    const now = new Date()
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    const rows = await this.db.getAllAsync<NoteRow>(
      `SELECT n.*, t.name as thread_name
       FROM notes n
       LEFT JOIN threads t ON n.thread_id = t.id
       WHERE n.is_task = 1
         AND n.is_completed = 0
         AND n.deleted_at IS NULL
         AND n.reminder_at IS NOT NULL
         AND n.reminder_at <= ?
       ORDER BY n.reminder_at ASC`,
      [futureDate.toISOString()]
    )

    return rows.map((row) => this.mapToNote(row))
  }

  /**
   * Full-text search across notes
   */
  async search(params: {
    query: string
    threadId?: string
    page?: number
    limit?: number
  }): Promise<PaginatedResult<NoteWithDetails>> {
    const page = params.page ?? 1
    const limit = params.limit ?? 20
    const offset = (page - 1) * limit

    // Prepare FTS query - escape special characters and add prefix matching
    const ftsQuery = params.query
      .trim()
      .split(/\s+/)
      .map((term) => `"${term}"*`)
      .join(' ')

    let whereClause = ''
    const queryParams: (string | number)[] = [ftsQuery]

    if (params.threadId) {
      whereClause = 'AND fts.thread_id = ?'
      queryParams.push(params.threadId)
    }

    // Get total count
    const countResult = await this.db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM notes_fts fts
       JOIN notes n ON fts.id = n.id
       WHERE notes_fts MATCH ? ${whereClause} AND n.deleted_at IS NULL`,
      queryParams
    )
    const total = countResult?.count ?? 0

    // Get paginated results
    const rows = await this.db.getAllAsync<NoteRow>(
      `SELECT n.*, t.name as thread_name
       FROM notes_fts fts
       JOIN notes n ON fts.id = n.id
       LEFT JOIN threads t ON n.thread_id = t.id
       WHERE notes_fts MATCH ? ${whereClause} AND n.deleted_at IS NULL
       ORDER BY rank
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    )

    const notes = rows.map((row) => this.mapToNote(row))
    const hasMore = offset + rows.length < total

    return { data: notes, hasMore, total }
  }

  /**
   * Search within a specific thread
   */
  async searchInThread(
    threadId: string,
    query: string,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedResult<NoteWithDetails>> {
    return this.search({
      query,
      threadId,
      page: params?.page,
      limit: params?.limit,
    })
  }

  /**
   * Get notes with pending sync status
   */
  async getPendingSync(): Promise<NoteRow[]> {
    return this.db.getAllAsync<NoteRow>(
      `SELECT * FROM notes WHERE sync_status = 'pending'`
    )
  }

  /**
   * Mark a note as synced with server ID
   */
  async markSynced(localId: string, serverId: string): Promise<void> {
    await this.db.runAsync(
      `UPDATE notes SET server_id = ?, sync_status = 'synced' WHERE id = ?`,
      [serverId, localId]
    )
  }

  /**
   * Upsert a note from server data (for sync)
   */
  async upsertFromServer(
    threadLocalId: string,
    serverNote: {
      _id: string
      content?: string
      type: NoteType
      attachment?: {
        url: string
        filename?: string
        mimeType?: string
        size?: number
        duration?: number
        thumbnail?: string
        width?: number
        height?: number
      }
      location?: {
        latitude: number
        longitude: number
        address?: string
      }
      isLocked: boolean
      isStarred: boolean
      isEdited: boolean
      isDeleted: boolean
      task: {
        isTask: boolean
        reminderAt?: string
        isCompleted: boolean
        completedAt?: string
      }
      createdAt: string
      updatedAt: string
    }
  ): Promise<void> {
    const existing = await this.getByServerId(serverNote._id)

    if (serverNote.isDeleted) {
      // If deleted on server, soft delete locally
      if (existing) {
        await this.db.runAsync(
          `UPDATE notes SET deleted_at = ?, sync_status = 'synced' WHERE server_id = ?`,
          [serverNote.updatedAt, serverNote._id]
        )
      }
      return
    }

    if (existing) {
      // Update existing
      await this.db.runAsync(
        `UPDATE notes SET
           content = ?, type = ?,
           attachment_url = ?, attachment_filename = ?, attachment_mime_type = ?,
           attachment_size = ?, attachment_duration = ?, attachment_thumbnail = ?,
           attachment_width = ?, attachment_height = ?,
           location_latitude = ?, location_longitude = ?, location_address = ?,
           is_locked = ?, is_starred = ?, is_edited = ?,
           is_task = ?, reminder_at = ?, is_completed = ?, completed_at = ?,
           sync_status = 'synced', updated_at = ?
         WHERE server_id = ?`,
        [
          serverNote.content ?? null,
          serverNote.type,
          serverNote.attachment?.url ?? null,
          serverNote.attachment?.filename ?? null,
          serverNote.attachment?.mimeType ?? null,
          serverNote.attachment?.size ?? null,
          serverNote.attachment?.duration ?? null,
          serverNote.attachment?.thumbnail ?? null,
          serverNote.attachment?.width ?? null,
          serverNote.attachment?.height ?? null,
          serverNote.location?.latitude ?? null,
          serverNote.location?.longitude ?? null,
          serverNote.location?.address ?? null,
          fromBoolean(serverNote.isLocked),
          fromBoolean(serverNote.isStarred),
          fromBoolean(serverNote.isEdited),
          fromBoolean(serverNote.task.isTask),
          serverNote.task.reminderAt ?? null,
          fromBoolean(serverNote.task.isCompleted),
          serverNote.task.completedAt ?? null,
          serverNote.updatedAt,
          serverNote._id,
        ]
      )
    } else {
      // Insert new
      const id = generateUUID()
      await this.db.runAsync(
        `INSERT INTO notes (
           id, server_id, thread_id, content, type,
           attachment_url, attachment_filename, attachment_mime_type,
           attachment_size, attachment_duration, attachment_thumbnail,
           attachment_width, attachment_height,
           location_latitude, location_longitude, location_address,
           is_locked, is_starred, is_edited,
           is_task, reminder_at, is_completed, completed_at,
           sync_status, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?)`,
        [
          id,
          serverNote._id,
          threadLocalId,
          serverNote.content ?? null,
          serverNote.type,
          serverNote.attachment?.url ?? null,
          serverNote.attachment?.filename ?? null,
          serverNote.attachment?.mimeType ?? null,
          serverNote.attachment?.size ?? null,
          serverNote.attachment?.duration ?? null,
          serverNote.attachment?.thumbnail ?? null,
          serverNote.attachment?.width ?? null,
          serverNote.attachment?.height ?? null,
          serverNote.location?.latitude ?? null,
          serverNote.location?.longitude ?? null,
          serverNote.location?.address ?? null,
          fromBoolean(serverNote.isLocked),
          fromBoolean(serverNote.isStarred),
          fromBoolean(serverNote.isEdited),
          fromBoolean(serverNote.task.isTask),
          serverNote.task.reminderAt ?? null,
          fromBoolean(serverNote.task.isCompleted),
          serverNote.task.completedAt ?? null,
          serverNote.createdAt,
          serverNote.updatedAt,
        ]
      )
    }
  }

  /**
   * Map database row to NoteWithDetails
   */
  private mapToNote(row: NoteRow): NoteWithDetails {
    return {
      id: row.id,
      serverId: row.server_id,
      threadId: row.thread_id,
      threadName: row.thread_name,
      content: row.content,
      type: row.type as NoteType,
      attachment:
        row.attachment_url
          ? {
              url: row.attachment_url,
              filename: row.attachment_filename ?? undefined,
              mimeType: row.attachment_mime_type ?? undefined,
              size: row.attachment_size ?? undefined,
              duration: row.attachment_duration ?? undefined,
              thumbnail: row.attachment_thumbnail ?? undefined,
              width: row.attachment_width ?? undefined,
              height: row.attachment_height ?? undefined,
            }
          : null,
      location:
        row.location_latitude !== null && row.location_longitude !== null
          ? {
              latitude: row.location_latitude,
              longitude: row.location_longitude,
              address: row.location_address ?? undefined,
            }
          : null,
      isLocked: toBoolean(row.is_locked),
      isStarred: toBoolean(row.is_starred),
      isEdited: toBoolean(row.is_edited),
      task: {
        isTask: toBoolean(row.is_task),
        reminderAt: row.reminder_at ?? undefined,
        isCompleted: toBoolean(row.is_completed),
        completedAt: row.completed_at ?? undefined,
      },
      syncStatus: row.sync_status as SyncStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}

// Singleton instance holder
let noteRepositoryInstance: NoteRepository | null = null

/**
 * Get or create NoteRepository instance
 */
export function getNoteRepository(db: SQLiteDatabase): NoteRepository {
  if (!noteRepositoryInstance) {
    noteRepositoryInstance = new NoteRepository(db)
  }
  return noteRepositoryInstance
}
