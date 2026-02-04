import { Platform } from 'react-native'
import axios, { AxiosInstance } from 'axios'
import type { SQLiteDatabase } from 'expo-sqlite'
import { getAuthToken } from '../storage'
import {
  getThreadRepository,
  getNoteRepository,
  getUserRepository,
} from '../repositories'
import type {
  ThreadRow,
  NoteRow,
  UserRow,
  NoteType,
} from '../database/types'

// Server response types
interface ServerThread {
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
}

interface ServerNote {
  _id: string
  threadId: string
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
      sharedNotes: boolean
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
  threads: ServerThread[]
  notes: ServerNote[]
  deletedThreadIds: string[]
  deletedNoteIds: string[]
  serverTime: string
}

interface SyncPushResponse {
  user?: { localId: string; serverId: string }
  threads: Array<{ localId: string; serverId: string }>
  notes: Array<{ localId: string; serverId: string }>
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

      const { user, threads: serverThreads, notes: serverNotes, deletedThreadIds: deletedThreadServerIds, deletedNoteIds: deletedNoteServerIds, serverTime } =
        response.data

      const threadRepo = getThreadRepository(this.db)
      const noteRepo = getNoteRepository(this.db)
      const userRepo = getUserRepository(this.db)

      // Process user
      if (user) {
        await userRepo.upsertFromServer(user)
      }

      // Process deleted threads first
      for (const serverId of deletedThreadServerIds) {
        const thread = await threadRepo.getByServerId(serverId)
        if (thread) {
          await this.db.runAsync(
            'UPDATE threads SET deleted_at = ?, sync_status = ? WHERE server_id = ?',
            [serverTime, 'synced', serverId]
          )
        }
      }

      // Process deleted notes
      for (const serverId of deletedNoteServerIds) {
        await this.db.runAsync(
          'UPDATE notes SET deleted_at = ?, sync_status = ? WHERE server_id = ?',
          [serverTime, 'synced', serverId]
        )
      }

      // Process threads
      for (const serverThread of serverThreads) {
        await threadRepo.upsertFromServer(serverThread)
      }

      // Process notes - need to map server threadId to local threadId
      for (const serverNote of serverNotes) {
        // Find local thread by server ID
        const localThread = await threadRepo.getByServerId(serverNote.threadId)
        if (localThread) {
          await noteRepo.upsertFromServer(localThread.id, serverNote)
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

      const threadRepo = getThreadRepository(this.db)
      const noteRepo = getNoteRepository(this.db)
      const userRepo = getUserRepository(this.db)

      // Gather pending changes
      const pendingThreads = await threadRepo.getPendingSync()
      const pendingNotes = await noteRepo.getPendingSync()
      const pendingUser = await userRepo.getPendingSync()

      // Include threads referenced by pending notes so server can resolve threadLocalId
      const pendingThreadIds = new Set(pendingThreads.map((t) => t.id))
      const referencedThreadIds = [
        ...new Set(pendingNotes.map((n) => n.thread_id)),
      ].filter((id) => !pendingThreadIds.has(id))
      const referencedThreads = (
        await Promise.all(
          referencedThreadIds.map((id) => threadRepo.getRowById(id))
        )
      ).filter((t): t is ThreadRow => t != null)
      // Include any thread that has never been synced (no server_id) so we always send it
      const neverSyncedThreads = await threadRepo.getNeverSynced()
      const alreadyIncluded = new Set([
        ...pendingThreadIds,
        ...referencedThreads.map((t) => t.id),
      ])
      const extraNeverSynced = neverSyncedThreads.filter((t) => !alreadyIncluded.has(t.id))
      const threadsToSend = [...pendingThreads, ...referencedThreads, ...extraNeverSynced]

      if (!pendingUser && threadsToSend.length === 0 && pendingNotes.length === 0) {
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
        threads: threadsToSend.map((thread) => ({
          localId: thread.id,
          serverId: thread.server_id,
          data: this.mapThreadToServer(thread),
          deleted: thread.deleted_at !== null,
        })),
        notes: pendingNotes.map((note) => ({
          localId: note.id,
          serverId: note.server_id,
          threadLocalId: note.thread_id,
          data: this.mapNoteToServer(note),
          deleted: note.deleted_at !== null,
        })),
      })

      // Update local records with server IDs
      const result = response.data

      if (result.user) {
        await userRepo.markSynced(result.user.serverId)
      }

      for (const { localId, serverId } of result.threads) {
        await threadRepo.markSynced(localId, serverId)
      }

      for (const { localId, serverId } of result.notes) {
        await noteRepo.markSynced(localId, serverId)
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
          sharedNotes: user.settings_notifications_shared_notes === 1,
        },
        privacy: {
          visibility: user.settings_privacy_visibility,
        },
      },
    }
  }

  private mapThreadToServer(thread: ThreadRow) {
    return {
      name: thread.name,
      icon: thread.icon,
      isPinned: thread.is_pinned === 1,
      wallpaper: thread.wallpaper,
    }
  }

  private mapNoteToServer(note: NoteRow) {
    return {
      content: note.content,
      type: note.type,
      attachment: note.attachment_url
        ? {
            url: note.attachment_url,
            filename: note.attachment_filename,
            mimeType: note.attachment_mime_type,
            size: note.attachment_size,
            duration: note.attachment_duration,
            thumbnail: note.attachment_thumbnail,
            width: note.attachment_width,
            height: note.attachment_height,
          }
        : undefined,
      location:
        note.location_latitude !== null
          ? {
              latitude: note.location_latitude,
              longitude: note.location_longitude,
              address: note.location_address,
            }
          : undefined,
      isLocked: note.is_locked === 1,
      isStarred: note.is_starred === 1,
      isEdited: note.is_edited === 1,
      task: {
        isTask: note.is_task === 1,
        reminderAt: note.reminder_at,
        isCompleted: note.is_completed === 1,
        completedAt: note.completed_at,
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
