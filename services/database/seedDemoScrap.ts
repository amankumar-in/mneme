import type { SQLiteDatabase } from 'expo-sqlite'
import { Asset } from 'expo-asset'
import { Directory, File, Paths } from 'expo-file-system'
import demoData from '../../assets/demo-scrap/scrap-export.json'
import { ensureDirectories } from '../fileStorage'

// Static require so metro bundles the image
const DEMO_IMAGE = require('../../assets/demo-scrap/demo-image.jpeg')

// The relative path the exported JSON references for the image
const ORIGINAL_IMAGE_URI = 'laterbox/attachments/images/fa7e5c85-879e-42ca-92bc-abf09bb5a757.jpg'

// Fixed ID so we can check if demo already exists (idempotent)
const DEMO_BOARD_ID = 'demo-scrap-00000000-0000-0000-0000-000000000001'

export async function seedDemoScrap(db: SQLiteDatabase): Promise<void> {
  // 1. Always ensure the demo image exists on disk
  await ensureDirectories()
  const imagesDir = new Directory(Paths.document, 'laterbox/attachments/images')
  const destFilename = ORIGINAL_IMAGE_URI.split('/').pop()!
  const destFile = new File(imagesDir, destFilename)

  if (!destFile.exists) {
    const asset = Asset.fromModule(DEMO_IMAGE)
    await asset.downloadAsync()

    if (asset.localUri) {
      const sourceFile = new File(asset.localUri)
      sourceFile.copy(destFile)
    }
  }

  // 2. Check if demo scrap already exists (skip DB inserts if so)
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM boards WHERE id = ?',
    [DEMO_BOARD_ID]
  )
  if (existing) return

  // 3. Insert all data in a transaction
  const { board, items, strokes, connections } = demoData as any
  const now = new Date().toISOString()

  await db.execAsync('BEGIN TRANSACTION')

  try {
    // Insert board with fixed ID
    await db.runAsync(
      `INSERT INTO boards (id, server_id, name, icon, pattern_type, is_locked, viewport_x, viewport_y, viewport_zoom, sync_status, created_at, updated_at)
       VALUES (?, NULL, ?, ?, ?, 0, ?, ?, ?, 'synced', ?, ?)`,
      [
        DEMO_BOARD_ID,
        board.name,
        board.icon ?? null,
        board.patternType,
        board.viewport.x,
        board.viewport.y,
        board.viewport.zoom,
        now,
        now,
      ]
    )

    // Build a map from old item IDs to new fixed IDs (so connections still work)
    const itemIdMap: Record<string, string> = {}
    for (let i = 0; i < items.length; i++) {
      itemIdMap[items[i].id] = `demo-item-${String(i + 1).padStart(4, '0')}`
    }

    // Insert items
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const newId = itemIdMap[item.id]

      await db.runAsync(
        `INSERT INTO board_items (id, board_id, type, x, y, width, height, rotation, z_index, content, image_uri, audio_uri, audio_duration, stroke_color, stroke_width, fill_color, font_size, font_weight, group_id, sync_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?)`,
        [
          newId,
          DEMO_BOARD_ID,
          item.type,
          item.x,
          item.y,
          item.width,
          item.height,
          item.rotation,
          item.zIndex,
          item.content ?? null,
          item.imageUri ?? null,
          item.audioUri ?? null,
          item.audioDuration ?? null,
          item.strokeColor ?? null,
          item.strokeWidth ?? null,
          item.fillColor ?? null,
          item.fontSize ?? null,
          item.fontWeight ?? null,
          item.groupId ?? null,
          now,
          now,
        ]
      )
    }

    // Insert strokes
    for (let i = 0; i < strokes.length; i++) {
      const stroke = strokes[i]

      await db.runAsync(
        `INSERT INTO board_strokes (id, board_id, path_data, color, width, opacity, z_index, x_offset, y_offset, group_id, sync_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?)`,
        [
          `demo-stroke-${String(i + 1).padStart(4, '0')}`,
          DEMO_BOARD_ID,
          stroke.pathData,
          stroke.color,
          stroke.width,
          stroke.opacity,
          stroke.zIndex,
          stroke.xOffset,
          stroke.yOffset,
          stroke.groupId ?? null,
          now,
          now,
        ]
      )
    }

    // Insert connections (remap item IDs)
    for (let i = 0; i < connections.length; i++) {
      const conn = connections[i]
      const fromId = itemIdMap[conn.fromItemId]
      const toId = itemIdMap[conn.toItemId]

      if (!fromId || !toId) continue

      await db.runAsync(
        `INSERT INTO board_connections (id, board_id, from_item_id, to_item_id, from_side, to_side, color, stroke_width, arrow_start, arrow_end, sync_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?)`,
        [
          `demo-conn-${String(i + 1).padStart(4, '0')}`,
          DEMO_BOARD_ID,
          fromId,
          toId,
          conn.fromSide,
          conn.toSide,
          conn.color,
          conn.strokeWidth,
          conn.arrowStart ? 1 : 0,
          conn.arrowEnd ? 1 : 0,
          now,
          now,
        ]
      )
    }

    await db.execAsync('COMMIT')
  } catch (error) {
    await db.execAsync('ROLLBACK')
    console.error('Failed to seed demo scrap:', error)
  }
}
