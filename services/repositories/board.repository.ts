import type { SQLiteDatabase } from 'expo-sqlite'
import {
  generateUUID,
  getTimestamp,
  type BoardRow,
  type BoardItemRow,
  type BoardStrokeRow,
  type BoardConnectionRow,
  type Board,
  type BoardItem,
  type BoardStroke,
  type BoardConnection,
  type BoardPatternType,
  type BoardItemType,
  type SyncStatus,
  type CreateBoardInput,
  type UpdateBoardInput,
  type CreateBoardItemInput,
  type UpdateBoardItemInput,
  type CreateBoardStrokeInput,
  type CreateBoardConnectionInput,
  type UpdateBoardConnectionInput,
} from '../database'

export class BoardRepository {
  constructor(private db: SQLiteDatabase) {}

  // ── Boards ──────────────────────────────────────────────

  async create(input: CreateBoardInput): Promise<Board> {
    const id = generateUUID()
    const now = getTimestamp()

    await this.db.runAsync(
      `INSERT INTO boards (id, name, icon, pattern_type, viewport_x, viewport_y, viewport_zoom, sync_status, created_at, updated_at)
       VALUES (?, ?, ?, 'plain', 0, 0, 1, 'pending', ?, ?)`,
      [id, input.name, input.icon ?? null, now, now]
    )

    return this.getById(id) as Promise<Board>
  }

  async getById(id: string): Promise<Board | null> {
    const row = await this.db.getFirstAsync<BoardRow>(
      `SELECT * FROM boards WHERE id = ? AND deleted_at IS NULL`,
      [id]
    )
    if (!row) return null
    return this.mapToBoard(row)
  }

  async getAll(params?: { search?: string }): Promise<Board[]> {
    const search = params?.search?.trim()
    let whereClause = 'WHERE deleted_at IS NULL'
    const queryParams: string[] = []

    if (search) {
      whereClause += ' AND name LIKE ?'
      queryParams.push(`%${search}%`)
    }

    const rows = await this.db.getAllAsync<BoardRow>(
      `SELECT * FROM boards ${whereClause} ORDER BY updated_at DESC`,
      queryParams
    )

    return rows.map((row) => this.mapToBoard(row))
  }

  async update(id: string, input: UpdateBoardInput): Promise<Board | null> {
    const board = await this.getById(id)
    if (!board) return null

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
    if (input.patternType !== undefined) {
      updates.push('pattern_type = ?')
      values.push(input.patternType)
    }
    if (input.isLocked !== undefined) {
      updates.push('is_locked = ?')
      values.push(input.isLocked ? 1 : 0)
    }

    if (updates.length === 0) return board

    updates.push('sync_status = ?', 'updated_at = ?')
    values.push('pending', getTimestamp())

    await this.db.runAsync(
      `UPDATE boards SET ${updates.join(', ')} WHERE id = ?`,
      [...values, id]
    )

    return this.getById(id)
  }

  async updateViewport(id: string, viewport: { x: number; y: number; zoom: number }): Promise<void> {
    await this.db.runAsync(
      `UPDATE boards SET viewport_x = ?, viewport_y = ?, viewport_zoom = ? WHERE id = ?`,
      [viewport.x, viewport.y, viewport.zoom, id]
    )
  }

  async delete(id: string): Promise<void> {
    const now = getTimestamp()
    await this.db.runAsync(
      `UPDATE boards SET deleted_at = ?, sync_status = 'pending', updated_at = ? WHERE id = ?`,
      [now, now, id]
    )
  }

  async getDeleted(): Promise<Board[]> {
    const rows = await this.db.getAllAsync<BoardRow>(
      `SELECT * FROM boards WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`
    )
    return rows.map((row) => this.mapToBoard(row))
  }

  async restore(id: string): Promise<void> {
    const now = getTimestamp()
    await this.db.runAsync(
      `UPDATE boards SET deleted_at = NULL, sync_status = 'pending', updated_at = ? WHERE id = ?`,
      [now, id]
    )
  }

  async permanentlyDelete(id: string): Promise<void> {
    await this.db.runAsync(`DELETE FROM board_connections WHERE board_id = ?`, [id])
    await this.db.runAsync(`DELETE FROM board_strokes WHERE board_id = ?`, [id])
    await this.db.runAsync(`DELETE FROM board_items WHERE board_id = ?`, [id])
    await this.db.runAsync(`DELETE FROM boards WHERE id = ?`, [id])
  }

  async purgeOlderThan(days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    // Get boards to purge so we can cascade delete their children
    const boards = await this.db.getAllAsync<{ id: string }>(
      `SELECT id FROM boards WHERE deleted_at IS NOT NULL AND deleted_at < ?`,
      [cutoff]
    )
    for (const board of boards) {
      await this.permanentlyDelete(board.id)
    }
    return boards.length
  }

  // ── Board Items ──────────────────────────────────────────

  async createItem(input: CreateBoardItemInput): Promise<BoardItem> {
    const id = generateUUID()
    const now = getTimestamp()

    // Get next z_index
    const maxZ = await this.db.getFirstAsync<{ max_z: number | null }>(
      `SELECT MAX(z_index) as max_z FROM board_items WHERE board_id = ? AND deleted_at IS NULL`,
      [input.boardId]
    )
    const zIndex = (maxZ?.max_z ?? 0) + 1

    await this.db.runAsync(
      `INSERT INTO board_items (id, board_id, type, x, y, width, height, rotation, z_index, content, image_uri, audio_uri, audio_duration, stroke_color, stroke_width, fill_color, font_size, font_weight, group_id, sync_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        id, input.boardId, input.type, input.x, input.y,
        input.width ?? 0, input.height ?? 0, zIndex,
        input.content ?? null, input.imageUri ?? null,
        input.audioUri ?? null, input.audioDuration ?? null,
        input.strokeColor ?? null, input.strokeWidth ?? null,
        input.fillColor ?? null, input.fontSize ?? null,
        input.fontWeight ?? null, input.groupId ?? null,
        now, now,
      ]
    )

    return this.getItemById(id) as Promise<BoardItem>
  }

  async getItemById(id: string): Promise<BoardItem | null> {
    const row = await this.db.getFirstAsync<BoardItemRow>(
      `SELECT * FROM board_items WHERE id = ? AND deleted_at IS NULL`,
      [id]
    )
    if (!row) return null
    return this.mapToItem(row)
  }

  async getItemsByBoard(boardId: string): Promise<BoardItem[]> {
    const rows = await this.db.getAllAsync<BoardItemRow>(
      `SELECT * FROM board_items WHERE board_id = ? AND deleted_at IS NULL ORDER BY z_index ASC`,
      [boardId]
    )
    return rows.map((row) => this.mapToItem(row))
  }

  async updateItem(id: string, input: UpdateBoardItemInput): Promise<BoardItem | null> {
    const updates: string[] = []
    const values: (string | number | null)[] = []

    if (input.x !== undefined) { updates.push('x = ?'); values.push(input.x) }
    if (input.y !== undefined) { updates.push('y = ?'); values.push(input.y) }
    if (input.width !== undefined) { updates.push('width = ?'); values.push(input.width) }
    if (input.height !== undefined) { updates.push('height = ?'); values.push(input.height) }
    if (input.rotation !== undefined) { updates.push('rotation = ?'); values.push(input.rotation) }
    if (input.zIndex !== undefined) { updates.push('z_index = ?'); values.push(input.zIndex) }
    if (input.content !== undefined) { updates.push('content = ?'); values.push(input.content) }
    if (input.strokeColor !== undefined) { updates.push('stroke_color = ?'); values.push(input.strokeColor) }
    if (input.strokeWidth !== undefined) { updates.push('stroke_width = ?'); values.push(input.strokeWidth) }
    if (input.fillColor !== undefined) { updates.push('fill_color = ?'); values.push(input.fillColor) }
    if (input.fontSize !== undefined) { updates.push('font_size = ?'); values.push(input.fontSize) }
    if (input.fontWeight !== undefined) { updates.push('font_weight = ?'); values.push(input.fontWeight) }
    if (input.groupId !== undefined) { updates.push('group_id = ?'); values.push(input.groupId) }

    if (updates.length === 0) return this.getItemById(id)

    updates.push('sync_status = ?', 'updated_at = ?')
    values.push('pending', getTimestamp())

    await this.db.runAsync(
      `UPDATE board_items SET ${updates.join(', ')} WHERE id = ?`,
      [...values, id]
    )

    return this.getItemById(id)
  }

  async deleteItem(id: string): Promise<void> {
    const now = getTimestamp()
    // Also delete connections involving this item
    await this.db.runAsync(
      `UPDATE board_connections SET deleted_at = ?, updated_at = ? WHERE (from_item_id = ? OR to_item_id = ?) AND deleted_at IS NULL`,
      [now, now, id, id]
    )
    await this.db.runAsync(
      `UPDATE board_items SET deleted_at = ?, sync_status = 'pending', updated_at = ? WHERE id = ?`,
      [now, now, id]
    )
  }

  // ── Strokes ──────────────────────────────────────────────

  async createStroke(input: CreateBoardStrokeInput): Promise<BoardStroke> {
    const id = generateUUID()
    const now = getTimestamp()

    const maxZ = await this.db.getFirstAsync<{ max_z: number | null }>(
      `SELECT MAX(z_index) as max_z FROM board_strokes WHERE board_id = ? AND deleted_at IS NULL`,
      [input.boardId]
    )
    const zIndex = input.zIndex ?? (maxZ?.max_z ?? 0) + 1

    await this.db.runAsync(
      `INSERT INTO board_strokes (id, board_id, path_data, color, width, opacity, z_index, x_offset, y_offset, group_id, sync_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [id, input.boardId, input.pathData, input.color, input.width, input.opacity ?? 1, zIndex, input.xOffset ?? 0, input.yOffset ?? 0, input.groupId ?? null, now, now]
    )

    return this.getStrokeById(id) as Promise<BoardStroke>
  }

  async getStrokeById(id: string): Promise<BoardStroke | null> {
    const row = await this.db.getFirstAsync<BoardStrokeRow>(
      `SELECT * FROM board_strokes WHERE id = ? AND deleted_at IS NULL`,
      [id]
    )
    if (!row) return null
    return this.mapToStroke(row)
  }

  async getStrokesByBoard(boardId: string): Promise<BoardStroke[]> {
    const rows = await this.db.getAllAsync<BoardStrokeRow>(
      `SELECT * FROM board_strokes WHERE board_id = ? AND deleted_at IS NULL ORDER BY z_index ASC`,
      [boardId]
    )
    return rows.map((row) => this.mapToStroke(row))
  }

  async updateStroke(id: string, input: { xOffset?: number; yOffset?: number }): Promise<void> {
    const updates: string[] = []
    const values: (string | number)[] = []

    if (input.xOffset !== undefined) { updates.push('x_offset = ?'); values.push(input.xOffset) }
    if (input.yOffset !== undefined) { updates.push('y_offset = ?'); values.push(input.yOffset) }

    if (updates.length === 0) return

    updates.push('sync_status = ?', 'updated_at = ?')
    values.push('pending', getTimestamp())

    await this.db.runAsync(
      `UPDATE board_strokes SET ${updates.join(', ')} WHERE id = ?`,
      [...values, id]
    )
  }

  async deleteStroke(id: string): Promise<void> {
    const now = getTimestamp()
    await this.db.runAsync(
      `UPDATE board_strokes SET deleted_at = ?, sync_status = 'pending', updated_at = ? WHERE id = ?`,
      [now, now, id]
    )
  }

  // ── Connections ──────────────────────────────────────────

  async createConnection(input: CreateBoardConnectionInput): Promise<BoardConnection> {
    const id = generateUUID()
    const now = getTimestamp()

    await this.db.runAsync(
      `INSERT INTO board_connections (id, board_id, from_item_id, to_item_id, from_side, to_side, color, stroke_width, arrow_start, arrow_end, sync_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [id, input.boardId, input.fromItemId, input.toItemId, input.fromSide, input.toSide, input.color ?? '#888888', input.strokeWidth ?? 2, input.arrowStart ? 1 : 0, input.arrowEnd !== false ? 1 : 0, now, now]
    )

    return this.getConnectionById(id) as Promise<BoardConnection>
  }

  async getConnectionById(id: string): Promise<BoardConnection | null> {
    const row = await this.db.getFirstAsync<BoardConnectionRow>(
      `SELECT * FROM board_connections WHERE id = ? AND deleted_at IS NULL`,
      [id]
    )
    if (!row) return null
    return this.mapToConnection(row)
  }

  async getConnectionsByBoard(boardId: string): Promise<BoardConnection[]> {
    const rows = await this.db.getAllAsync<BoardConnectionRow>(
      `SELECT * FROM board_connections WHERE board_id = ? AND deleted_at IS NULL`,
      [boardId]
    )
    return rows.map((row) => this.mapToConnection(row))
  }

  async updateConnection(id: string, input: UpdateBoardConnectionInput): Promise<void> {
    const updates: string[] = []
    const values: (string | number)[] = []

    if (input.fromSide !== undefined) { updates.push('from_side = ?'); values.push(input.fromSide) }
    if (input.toSide !== undefined) { updates.push('to_side = ?'); values.push(input.toSide) }
    if (input.color !== undefined) { updates.push('color = ?'); values.push(input.color) }
    if (input.strokeWidth !== undefined) { updates.push('stroke_width = ?'); values.push(input.strokeWidth) }
    if (input.arrowStart !== undefined) { updates.push('arrow_start = ?'); values.push(input.arrowStart ? 1 : 0) }
    if (input.arrowEnd !== undefined) { updates.push('arrow_end = ?'); values.push(input.arrowEnd ? 1 : 0) }

    if (updates.length === 0) return

    updates.push('sync_status = ?', 'updated_at = ?')
    values.push('pending', getTimestamp())

    await this.db.runAsync(
      `UPDATE board_connections SET ${updates.join(', ')} WHERE id = ?`,
      [...values, id]
    )
  }

  async deleteConnection(id: string): Promise<void> {
    const now = getTimestamp()
    await this.db.runAsync(
      `UPDATE board_connections SET deleted_at = ?, sync_status = 'pending', updated_at = ? WHERE id = ?`,
      [now, now, id]
    )
  }

  // ── Batch Operations ──────────────────────────────────────

  async setGroupForItems(itemIds: string[], groupId: string | null): Promise<void> {
    if (itemIds.length === 0) return
    const now = getTimestamp()
    const placeholders = itemIds.map(() => '?').join(', ')
    await this.db.runAsync(
      `UPDATE board_items SET group_id = ?, sync_status = 'pending', updated_at = ? WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
      [groupId, now, ...itemIds]
    )
  }

  async setGroupForStrokes(strokeIds: string[], groupId: string | null): Promise<void> {
    if (strokeIds.length === 0) return
    const now = getTimestamp()
    const placeholders = strokeIds.map(() => '?').join(', ')
    await this.db.runAsync(
      `UPDATE board_strokes SET group_id = ?, sync_status = 'pending', updated_at = ? WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
      [groupId, now, ...strokeIds]
    )
  }

  async deleteItems(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const now = getTimestamp()
    const placeholders = ids.map(() => '?').join(', ')
    // Also delete connections involving these items
    await this.db.runAsync(
      `UPDATE board_connections SET deleted_at = ?, updated_at = ? WHERE (from_item_id IN (${placeholders}) OR to_item_id IN (${placeholders})) AND deleted_at IS NULL`,
      [now, now, ...ids, ...ids]
    )
    await this.db.runAsync(
      `UPDATE board_items SET deleted_at = ?, sync_status = 'pending', updated_at = ? WHERE id IN (${placeholders})`,
      [now, now, ...ids]
    )
  }

  async deleteStrokes(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const now = getTimestamp()
    const placeholders = ids.map(() => '?').join(', ')
    await this.db.runAsync(
      `UPDATE board_strokes SET deleted_at = ?, sync_status = 'pending', updated_at = ? WHERE id IN (${placeholders})`,
      [now, now, ...ids]
    )
  }

  async updateItemPositions(updates: { id: string; x: number; y: number; width: number; height: number }[]): Promise<void> {
    if (updates.length === 0) return
    const now = getTimestamp()
    for (const u of updates) {
      await this.db.runAsync(
        `UPDATE board_items SET x = ?, y = ?, width = ?, height = ?, sync_status = 'pending', updated_at = ? WHERE id = ?`,
        [u.x, u.y, u.width, u.height, now, u.id]
      )
    }
  }

  // ── Mappers ──────────────────────────────────────────────

  private mapToBoard(row: BoardRow): Board {
    return {
      id: row.id,
      serverId: row.server_id,
      name: row.name,
      icon: row.icon,
      patternType: row.pattern_type as BoardPatternType,
      isLocked: !!row.is_locked,
      viewport: { x: row.viewport_x, y: row.viewport_y, zoom: row.viewport_zoom },
      syncStatus: row.sync_status as SyncStatus,
      deletedAt: row.deleted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  private mapToItem(row: BoardItemRow): BoardItem {
    return {
      id: row.id,
      boardId: row.board_id,
      type: row.type as BoardItemType,
      x: row.x,
      y: row.y,
      width: row.width,
      height: row.height,
      rotation: row.rotation,
      zIndex: row.z_index,
      content: row.content,
      imageUri: row.image_uri,
      audioUri: row.audio_uri,
      audioDuration: row.audio_duration,
      strokeColor: row.stroke_color,
      strokeWidth: row.stroke_width,
      fillColor: row.fill_color,
      fontSize: row.font_size,
      fontWeight: row.font_weight,
      groupId: row.group_id,
      syncStatus: row.sync_status as SyncStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  private mapToStroke(row: BoardStrokeRow): BoardStroke {
    return {
      id: row.id,
      boardId: row.board_id,
      pathData: row.path_data,
      color: row.color,
      width: row.width,
      opacity: row.opacity,
      zIndex: row.z_index,
      xOffset: row.x_offset,
      yOffset: row.y_offset,
      groupId: row.group_id,
      syncStatus: row.sync_status as SyncStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  private mapToConnection(row: BoardConnectionRow): BoardConnection {
    return {
      id: row.id,
      boardId: row.board_id,
      fromItemId: row.from_item_id,
      toItemId: row.to_item_id,
      fromSide: row.from_side,
      toSide: row.to_side,
      color: row.color,
      strokeWidth: row.stroke_width,
      arrowStart: !!row.arrow_start,
      arrowEnd: !!row.arrow_end,
      syncStatus: row.sync_status as SyncStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}

// Singleton instance holder
let boardRepositoryInstance: BoardRepository | null = null

export function getBoardRepository(db: SQLiteDatabase): BoardRepository {
  if (!boardRepositoryInstance) {
    boardRepositoryInstance = new BoardRepository(db)
  }
  return boardRepositoryInstance
}
