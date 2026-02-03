import type { SQLiteDatabase } from 'expo-sqlite'
import {
  generateUUID,
  getTimestamp,
  toBoolean,
  fromBoolean,
  type UserRow,
  type UserProfile,
  type SyncStatus,
} from '../database'

export class UserRepository {
  constructor(private db: SQLiteDatabase) {}

  /**
   * Get the current user (there's only one)
   */
  async get(): Promise<UserProfile | null> {
    const row = await this.db.getFirstAsync<UserRow>(
      `SELECT * FROM user WHERE deleted_at IS NULL LIMIT 1`
    )

    if (!row) return null
    return this.mapToUser(row)
  }

  /**
   * Get user by device ID
   */
  async getByDeviceId(deviceId: string): Promise<UserProfile | null> {
    const row = await this.db.getFirstAsync<UserRow>(
      `SELECT * FROM user WHERE device_id = ? AND deleted_at IS NULL`,
      [deviceId]
    )

    if (!row) return null
    return this.mapToUser(row)
  }

  /**
   * Create or update the local user
   */
  async upsert(data: {
    deviceId: string
    name: string
    username?: string | null
    email?: string | null
    phone?: string | null
    avatar?: string | null
    settings?: {
      theme?: 'light' | 'dark' | 'system'
      notifications?: {
        taskReminders?: boolean
        sharedMessages?: boolean
      }
      privacy?: {
        visibility?: 'public' | 'private' | 'contacts'
      }
    }
  }): Promise<UserProfile> {
    const existing = await this.getByDeviceId(data.deviceId)
    const now = getTimestamp()

    if (existing) {
      // Update existing user
      await this.db.runAsync(
        `UPDATE user SET
           name = ?,
           username = ?,
           email = ?,
           phone = ?,
           avatar = ?,
           settings_theme = ?,
           settings_notifications_task_reminders = ?,
           settings_notifications_shared_messages = ?,
           settings_privacy_visibility = ?,
           sync_status = 'pending',
           updated_at = ?
         WHERE device_id = ?`,
        [
          data.name,
          data.username ?? existing.username,
          data.email ?? existing.email,
          data.phone ?? existing.phone,
          data.avatar ?? existing.avatar,
          data.settings?.theme ?? existing.settings.theme,
          fromBoolean(
            data.settings?.notifications?.taskReminders ??
              existing.settings.notifications.taskReminders
          ),
          fromBoolean(
            data.settings?.notifications?.sharedMessages ??
              existing.settings.notifications.sharedMessages
          ),
          data.settings?.privacy?.visibility ?? existing.settings.privacy.visibility,
          now,
          data.deviceId,
        ]
      )
    } else {
      // Create new user
      const id = generateUUID()
      await this.db.runAsync(
        `INSERT INTO user (
           id, device_id, name, username, email, phone, avatar,
           settings_theme, settings_notifications_task_reminders,
           settings_notifications_shared_messages, settings_privacy_visibility,
           sync_status, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
        [
          id,
          data.deviceId,
          data.name,
          data.username ?? null,
          data.email ?? null,
          data.phone ?? null,
          data.avatar ?? null,
          data.settings?.theme ?? 'system',
          fromBoolean(data.settings?.notifications?.taskReminders ?? true),
          fromBoolean(data.settings?.notifications?.sharedMessages ?? true),
          data.settings?.privacy?.visibility ?? 'private',
          now,
          now,
        ]
      )
    }

    return this.getByDeviceId(data.deviceId) as Promise<UserProfile>
  }

  /**
   * Update user profile
   */
  async update(data: {
    name?: string
    username?: string | null
    email?: string | null
    phone?: string | null
    avatar?: string | null
    settings?: {
      theme?: 'light' | 'dark' | 'system'
      notifications?: {
        taskReminders?: boolean
        sharedMessages?: boolean
      }
      privacy?: {
        visibility?: 'public' | 'private' | 'contacts'
      }
    }
  }): Promise<UserProfile | null> {
    const existing = await this.get()
    if (!existing) return null

    const updates: string[] = []
    const values: (string | number | null)[] = []

    if (data.name !== undefined) {
      updates.push('name = ?')
      values.push(data.name)
    }
    if (data.username !== undefined) {
      updates.push('username = ?')
      values.push(data.username)
    }
    if (data.email !== undefined) {
      updates.push('email = ?')
      values.push(data.email)
    }
    if (data.phone !== undefined) {
      updates.push('phone = ?')
      values.push(data.phone)
    }
    if (data.avatar !== undefined) {
      updates.push('avatar = ?')
      values.push(data.avatar)
    }
    if (data.settings?.theme !== undefined) {
      updates.push('settings_theme = ?')
      values.push(data.settings.theme)
    }
    if (data.settings?.notifications?.taskReminders !== undefined) {
      updates.push('settings_notifications_task_reminders = ?')
      values.push(fromBoolean(data.settings.notifications.taskReminders))
    }
    if (data.settings?.notifications?.sharedMessages !== undefined) {
      updates.push('settings_notifications_shared_messages = ?')
      values.push(fromBoolean(data.settings.notifications.sharedMessages))
    }
    if (data.settings?.privacy?.visibility !== undefined) {
      updates.push('settings_privacy_visibility = ?')
      values.push(data.settings.privacy.visibility)
    }

    if (updates.length === 0) return existing

    // Mark as pending sync and update timestamp
    updates.push('sync_status = ?', 'updated_at = ?')
    values.push('pending', getTimestamp())

    await this.db.runAsync(
      `UPDATE user SET ${updates.join(', ')} WHERE id = ?`,
      [...values, existing.id]
    )

    return this.get()
  }

  /**
   * Delete user (soft delete)
   */
  async delete(): Promise<void> {
    const now = getTimestamp()

    await this.db.runAsync(
      `UPDATE user SET deleted_at = ?, sync_status = 'pending', updated_at = ?`,
      [now, now]
    )
  }

  /**
   * Get user with pending sync status
   */
  async getPendingSync(): Promise<UserRow | null> {
    return this.db.getFirstAsync<UserRow>(
      `SELECT * FROM user WHERE sync_status = 'pending' AND deleted_at IS NULL`
    )
  }

  /**
   * Mark user as synced with server ID
   */
  async markSynced(serverId: string): Promise<void> {
    await this.db.runAsync(
      `UPDATE user SET server_id = ?, sync_status = 'synced' WHERE deleted_at IS NULL`,
      [serverId]
    )
  }

  /**
   * Upsert user from server data (for sync)
   * Server no longer sends deviceId - we find user by server_id or update current user
   */
  async upsertFromServer(serverUser: {
    _id: string
    name: string
    username?: string
    email?: string
    phone?: string
    avatar?: string
    settings: {
      theme: 'light' | 'dark' | 'system'
      notifications: {
        taskReminders: boolean
        sharedMessages: boolean
      }
      privacy: {
        visibility: 'public' | 'private' | 'contacts'
      }
    }
    createdAt: string
    updatedAt: string
  }): Promise<void> {
    // First try to find by server_id, then fall back to current user
    let existing = await this.db.getFirstAsync<UserRow>(
      `SELECT * FROM user WHERE server_id = ? AND deleted_at IS NULL`,
      [serverUser._id]
    )

    if (!existing) {
      // No user with this server_id, update the current local user
      existing = await this.db.getFirstAsync<UserRow>(
        `SELECT * FROM user WHERE deleted_at IS NULL LIMIT 1`
      )
    }

    if (existing) {
      // Update existing
      await this.db.runAsync(
        `UPDATE user SET
           server_id = ?,
           name = ?,
           username = ?,
           email = ?,
           phone = ?,
           avatar = ?,
           settings_theme = ?,
           settings_notifications_task_reminders = ?,
           settings_notifications_shared_messages = ?,
           settings_privacy_visibility = ?,
           sync_status = 'synced',
           updated_at = ?
         WHERE id = ?`,
        [
          serverUser._id,
          serverUser.name,
          serverUser.username ?? null,
          serverUser.email ?? null,
          serverUser.phone ?? null,
          serverUser.avatar ?? null,
          serverUser.settings.theme,
          fromBoolean(serverUser.settings.notifications.taskReminders),
          fromBoolean(serverUser.settings.notifications.sharedMessages),
          serverUser.settings.privacy.visibility,
          serverUser.updatedAt,
          existing.id,
        ]
      )
    }
    // If no existing user, we don't create one from server data
    // The local user should already exist from app initialization
  }

  /**
   * Map database row to UserProfile
   */
  private mapToUser(row: UserRow): UserProfile {
    return {
      id: row.id,
      serverId: row.server_id,
      deviceId: row.device_id,
      name: row.name,
      username: row.username,
      email: row.email,
      phone: row.phone,
      avatar: row.avatar,
      settings: {
        theme: row.settings_theme as 'light' | 'dark' | 'system',
        notifications: {
          taskReminders: toBoolean(row.settings_notifications_task_reminders),
          sharedMessages: toBoolean(row.settings_notifications_shared_messages),
        },
        privacy: {
          visibility: row.settings_privacy_visibility as 'public' | 'private' | 'contacts',
        },
      },
      syncStatus: row.sync_status as SyncStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}

// Singleton instance holder
let userRepositoryInstance: UserRepository | null = null

/**
 * Get or create UserRepository instance
 */
export function getUserRepository(db: SQLiteDatabase): UserRepository {
  if (!userRepositoryInstance) {
    userRepositoryInstance = new UserRepository(db)
  }
  return userRepositoryInstance
}
