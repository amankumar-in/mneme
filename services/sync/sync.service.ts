import { Platform } from 'react-native'
import axios, { AxiosInstance } from 'axios'
import type { SQLiteDatabase } from 'expo-sqlite'
import { getAuthToken } from '../storage'
import {
  getChatRepository,
  getMessageRepository,
  getUserRepository,
} from '../repositories'
import type {
  ChatRow,
  MessageRow,
  UserRow,
  MessageType,
} from '../database/types'

// Server response types
interface ServerChat {
  _id: string
  name: string
  icon?: string
  isPinned: boolean
  wallpaper?: string
  lastMessage?: {
    content: string
    type: MessageType
    timestamp: string
  }
  createdAt: string
  updatedAt: string
}

interface ServerMessage {
  _id: string
  chatId: string
  content?: string
  type: MessageType
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

interface ServerUser {
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
}

interface SyncChangesResponse {
  user?: ServerUser
  chats: ServerChat[]
  messages: ServerMessage[]
  deletedChatIds: string[]
  deletedMessageIds: string[]
  serverTime: string
}

interface SyncPushResponse {
  user?: { localId: string; serverId: string }
  chats: Array<{ localId: string; serverId: string }>
  messages: Array<{ localId: string; serverId: string }>
}

const getDefaultUrl = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api'
  }
  return 'http://localhost:3000/api'
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || getDefaultUrl()

export class SyncService {
  private api: AxiosInstance | null = null
  private pushTimeout: ReturnType<typeof setTimeout> | null = null
  private pushDebounceMs = 5000 // 5 second debounce for push

  constructor(private db: SQLiteDatabase) {}

  /**
   * Reset cached API instance (call after logging out)
   */
  resetApi(): void {
    this.api = null
  }

  private async getApi(): Promise<AxiosInstance | null> {
    const token = await getAuthToken()

    // No token = no API access (local-only mode)
    if (!token) {
      return null
    }

    if (this.api) return this.api

    this.api = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      timeout: 30000,
    })

    return this.api
  }

  /**
   * Get the last sync timestamp from local DB
   */
  private async getLastSyncTimestamp(): Promise<string | null> {
    const result = await this.db.getFirstAsync<{ last_sync_timestamp: string | null }>(
      'SELECT last_sync_timestamp FROM sync_meta WHERE id = 1'
    )
    return result?.last_sync_timestamp ?? null
  }

  /**
   * Update the last sync timestamp
   */
  private async setLastSyncTimestamp(timestamp: string): Promise<void> {
    await this.db.runAsync(
      'UPDATE sync_meta SET last_sync_timestamp = ? WHERE id = 1',
      [timestamp]
    )
  }

  /**
   * Check if currently syncing
   */
  private async isSyncing(): Promise<boolean> {
    const result = await this.db.getFirstAsync<{ is_syncing: number }>(
      'SELECT is_syncing FROM sync_meta WHERE id = 1'
    )
    return result?.is_syncing === 1
  }

  /**
   * Set syncing flag
   */
  private async setSyncing(syncing: boolean): Promise<void> {
    await this.db.runAsync(
      'UPDATE sync_meta SET is_syncing = ? WHERE id = 1',
      [syncing ? 1 : 0]
    )
  }

  /**
   * Check if sync is possible (user is authenticated)
   */
  async canSync(): Promise<boolean> {
    const token = await getAuthToken()
    return !!token
  }

  /**
   * Pull changes from server
   */
  async pull(): Promise<void> {
    // No API access if not authenticated
    const api = await this.getApi()
    if (!api) {
      console.log('[Sync] Pull skipped - not authenticated')
      return
    }

    if (await this.isSyncing()) {
      console.log('[Sync] Already syncing, skipping pull')
      return
    }

    try {
      await this.setSyncing(true)

      const lastSync = await this.getLastSyncTimestamp()

      const response = await api.get<SyncChangesResponse>('/sync/changes', {
        params: { since: lastSync },
      })

      const { user, chats, messages, deletedChatIds, deletedMessageIds, serverTime } =
        response.data

      const chatRepo = getChatRepository(this.db)
      const messageRepo = getMessageRepository(this.db)
      const userRepo = getUserRepository(this.db)

      // Process user
      if (user) {
        await userRepo.upsertFromServer(user)
      }

      // Process deleted chats first
      for (const serverId of deletedChatIds) {
        const chat = await chatRepo.getByServerId(serverId)
        if (chat) {
          await this.db.runAsync(
            'UPDATE chats SET deleted_at = ?, sync_status = ? WHERE server_id = ?',
            [serverTime, 'synced', serverId]
          )
        }
      }

      // Process deleted messages
      for (const serverId of deletedMessageIds) {
        await this.db.runAsync(
          'UPDATE messages SET deleted_at = ?, sync_status = ? WHERE server_id = ?',
          [serverTime, 'synced', serverId]
        )
      }

      // Process chats
      for (const chat of chats) {
        await chatRepo.upsertFromServer(chat)
      }

      // Process messages - need to map server chatId to local chatId
      for (const message of messages) {
        // Find local chat by server ID
        const localChat = await chatRepo.getByServerId(message.chatId)
        if (localChat) {
          await messageRepo.upsertFromServer(localChat.id, message)
        }
      }

      await this.setLastSyncTimestamp(serverTime)
      console.log('[Sync] Pull completed successfully')
    } catch (error: any) {
      // Network errors are expected when offline - don't treat as error
      if (error?.message?.includes('Network Error')) {
        console.log('[Sync] Pull skipped (offline)')
      } else if (error?.message === 'AUTH_CLEARED') {
        // Token was invalid and cleared - handled silently
      } else {
        console.warn('[Sync] Pull failed:', error?.message)
      }
      throw error
    } finally {
      await this.setSyncing(false)
    }
  }

  /**
   * Push local changes to server
   */
  async push(): Promise<void> {
    // No API access if not authenticated
    const api = await this.getApi()
    if (!api) {
      console.log('[Sync] Push skipped - not authenticated')
      return
    }

    if (await this.isSyncing()) {
      console.log('[Sync] Already syncing, skipping push')
      return
    }

    try {
      await this.setSyncing(true)

      const chatRepo = getChatRepository(this.db)
      const messageRepo = getMessageRepository(this.db)
      const userRepo = getUserRepository(this.db)

      // Gather pending changes
      const pendingChats = await chatRepo.getPendingSync()
      const pendingMessages = await messageRepo.getPendingSync()
      const pendingUser = await userRepo.getPendingSync()

      if (
        pendingChats.length === 0 &&
        pendingMessages.length === 0 &&
        !pendingUser
      ) {
        console.log('[Sync] No pending changes to push')
        return
      }

      // Push changes to server
      const response = await api.post<SyncPushResponse>('/sync/push', {
        user: pendingUser
          ? {
              localId: pendingUser.id,
              data: this.mapUserToServer(pendingUser),
            }
          : undefined,
        chats: pendingChats.map((chat) => ({
          localId: chat.id,
          serverId: chat.server_id,
          data: this.mapChatToServer(chat),
          deleted: chat.deleted_at !== null,
        })),
        messages: pendingMessages.map((msg) => ({
          localId: msg.id,
          serverId: msg.server_id,
          chatLocalId: msg.chat_id,
          data: this.mapMessageToServer(msg),
          deleted: msg.deleted_at !== null,
        })),
      })

      // Update local records with server IDs
      const result = response.data

      if (result.user) {
        await userRepo.markSynced(result.user.serverId)
      }

      for (const { localId, serverId } of result.chats) {
        await chatRepo.markSynced(localId, serverId)
      }

      for (const { localId, serverId } of result.messages) {
        await messageRepo.markSynced(localId, serverId)
      }

      console.log('[Sync] Push completed successfully')
    } catch (error: any) {
      // Network errors are expected when offline - don't treat as error
      if (error?.message?.includes('Network Error')) {
        console.log('[Sync] Push skipped (offline)')
      } else if (error?.message === 'AUTH_CLEARED') {
        // Token was invalid and cleared - handled silently
      } else {
        console.warn('[Sync] Push failed:', error?.message)
      }
      throw error
    } finally {
      await this.setSyncing(false)
    }
  }

  /**
   * Schedule a debounced push
   */
  schedulePush(): void {
    if (this.pushTimeout) {
      clearTimeout(this.pushTimeout)
    }

    this.pushTimeout = setTimeout(() => {
      this.push().catch((error) => {
        // Network errors are expected when offline - don't treat as error
        if (error?.message?.includes('Network Error')) {
          console.log('[Sync] Push skipped (offline)')
        } else if (error?.message === 'AUTH_CLEARED') {
          // Token was invalid and cleared - handled silently
        } else {
          console.warn('[Sync] Scheduled push failed:', error.message)
        }
      })
    }, this.pushDebounceMs)
  }

  /**
   * Cancel any scheduled push
   */
  cancelScheduledPush(): void {
    if (this.pushTimeout) {
      clearTimeout(this.pushTimeout)
      this.pushTimeout = null
    }
  }

  /**
   * Full sync (pull then push)
   */
  async sync(): Promise<void> {
    await this.pull()
    await this.push()
  }

  private mapUserToServer(user: UserRow) {
    return {
      name: user.name,
      username: user.username,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      settings: {
        theme: user.settings_theme,
        notifications: {
          taskReminders: user.settings_notifications_task_reminders === 1,
          sharedMessages: user.settings_notifications_shared_messages === 1,
        },
        privacy: {
          visibility: user.settings_privacy_visibility,
        },
      },
    }
  }

  private mapChatToServer(chat: ChatRow) {
    return {
      name: chat.name,
      icon: chat.icon,
      isPinned: chat.is_pinned === 1,
      wallpaper: chat.wallpaper,
    }
  }

  private mapMessageToServer(msg: MessageRow) {
    return {
      content: msg.content,
      type: msg.type,
      attachment: msg.attachment_url
        ? {
            url: msg.attachment_url,
            filename: msg.attachment_filename,
            mimeType: msg.attachment_mime_type,
            size: msg.attachment_size,
            duration: msg.attachment_duration,
            thumbnail: msg.attachment_thumbnail,
            width: msg.attachment_width,
            height: msg.attachment_height,
          }
        : undefined,
      location:
        msg.location_latitude !== null
          ? {
              latitude: msg.location_latitude,
              longitude: msg.location_longitude,
              address: msg.location_address,
            }
          : undefined,
      isLocked: msg.is_locked === 1,
      isStarred: msg.is_starred === 1,
      isEdited: msg.is_edited === 1,
      task: {
        isTask: msg.is_task === 1,
        reminderAt: msg.reminder_at,
        isCompleted: msg.is_completed === 1,
        completedAt: msg.completed_at,
      },
    }
  }
}

// Singleton instance holder
let syncServiceInstance: SyncService | null = null

/**
 * Get or create SyncService instance
 */
export function getSyncService(db: SQLiteDatabase): SyncService {
  if (!syncServiceInstance) {
    syncServiceInstance = new SyncService(db)
  }
  return syncServiceInstance
}

/**
 * Reset the sync service (call after logging out)
 */
export function resetSyncService(): void {
  if (syncServiceInstance) {
    syncServiceInstance.resetApi()
  }
  syncServiceInstance = null
}
