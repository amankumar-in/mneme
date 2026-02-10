// Local database types for offline-first architecture

export type SyncStatus = 'pending' | 'synced'
export type NoteType = 'text' | 'image' | 'video' | 'voice' | 'file' | 'location' | 'contact' | 'audio'

// Database row types (snake_case to match SQLite columns)
export interface ThreadRow {
  id: string
  server_id: string | null
  name: string
  icon: string | null
  is_pinned: number
  is_system_thread: number
  is_locked: number
  wallpaper: string | null
  last_note_content: string | null
  last_note_type: string | null
  last_note_timestamp: string | null
  sync_status: string
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface NoteRow {
  id: string
  server_id: string | null
  thread_id: string
  content: string | null
  type: string
  attachment_url: string | null
  attachment_filename: string | null
  attachment_mime_type: string | null
  attachment_size: number | null
  attachment_duration: number | null
  attachment_thumbnail: string | null
  attachment_width: number | null
  attachment_height: number | null
  location_latitude: number | null
  location_longitude: number | null
  location_address: string | null
  is_locked: number
  is_starred: number
  is_edited: number
  is_pinned: number
  is_task: number
  reminder_at: string | null
  is_completed: number
  completed_at: string | null
  notification_id: string | null
  // Link preview fields
  link_preview_url: string | null
  link_preview_title: string | null
  link_preview_description: string | null
  link_preview_image: string | null
  attachment_waveform: string | null
  sync_status: string
  deleted_at: string | null
  created_at: string
  updated_at: string
  thread_name?: string // Joined from threads table
}

export interface UserRow {
  id: string
  server_id: string | null
  device_id: string
  name: string
  username: string | null
  email: string | null
  phone: string | null
  avatar: string | null
  settings_theme: string
  settings_notifications_task_reminders: number
  settings_notifications_shared_notes: number
  settings_privacy_visibility: string
  sync_status: string
  deleted_at: string | null
  created_at: string
  updated_at: string
}

// Base type for entities that can be synced (camelCase for app use)
export interface SyncableEntity {
  id: string // Local UUID
  serverId: string | null // MongoDB _id, null until synced
  syncStatus: SyncStatus
  deletedAt: string | null // Soft delete timestamp
  createdAt: string
  updatedAt: string
}

export interface LocalThread extends SyncableEntity {
  name: string
  icon: string | null
  isPinned: number // SQLite doesn't have boolean, use 0/1
  isSystemThread: number
  isLocked: number
  wallpaper: string | null
  lastNoteContent: string | null
  lastNoteType: NoteType | null
  lastNoteTimestamp: string | null
}

export interface LocalNote extends SyncableEntity {
  threadId: string // Local thread UUID
  content: string | null
  type: NoteType
  // Attachment fields (flattened for SQLite)
  attachmentUrl: string | null
  attachmentFilename: string | null
  attachmentMimeType: string | null
  attachmentSize: number | null
  attachmentDuration: number | null
  attachmentThumbnail: string | null
  attachmentWidth: number | null
  attachmentHeight: number | null
  // Location fields
  locationLatitude: number | null
  locationLongitude: number | null
  locationAddress: string | null
  // Flags
  isLocked: number
  isStarred: number
  isEdited: number
  // Task fields
  isTask: number
  reminderAt: string | null
  isCompleted: number
  completedAt: string | null
  // Link preview fields
  linkPreviewUrl: string | null
  linkPreviewTitle: string | null
  linkPreviewDescription: string | null
  linkPreviewImage: string | null
}

export interface LocalUser extends SyncableEntity {
  deviceId: string
  name: string
  username: string | null
  email: string | null
  phone: string | null
  avatar: string | null
  // Settings (flattened)
  settingsTheme: 'light' | 'dark' | 'system'
  settingsNotificationsTaskReminders: number
  settingsNotificationsSharedNotes: number
  settingsPrivacyVisibility: 'public' | 'private' | 'contacts'
}

export interface SyncMeta {
  id: number
  lastSyncTimestamp: string | null
  lastPushTimestamp: string | null
  isSyncing: number
}

// Input types for creating entities (without auto-generated fields)
export interface CreateThreadInput {
  name: string
  icon?: string | null
}

export interface UpdateThreadInput {
  name?: string
  icon?: string | null
  isPinned?: boolean
  isLocked?: boolean
  wallpaper?: string | null
}

export interface CreateNoteInput {
  threadId: string
  content?: string | null
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
    waveform?: number[]
  } | null
  location?: {
    latitude: number
    longitude: number
    address?: string
  } | null
  linkPreview?: {
    url: string
    title?: string
    description?: string
    image?: string
  } | null
}

export interface UpdateNoteInput {
  content?: string
}

export interface TaskInput {
  isTask: boolean
  reminderAt?: string | null
  isCompleted?: boolean
}

// Query result types that match the app's expected format
export interface ThreadWithLastNote {
  id: string
  serverId: string | null
  name: string
  icon: string | null
  isPinned: boolean
  isSystemThread: boolean
  isLocked: boolean
  wallpaper: string | null
  lastNote: {
    content: string
    type: NoteType
    timestamp: string
  } | null
  syncStatus: SyncStatus
  createdAt: string
  updatedAt: string
}

export interface NoteWithDetails {
  id: string
  serverId: string | null
  threadId: string
  threadName?: string // For task queries
  content: string | null
  type: NoteType
  attachment: {
    url: string
    filename?: string
    mimeType?: string
    size?: number
    duration?: number
    thumbnail?: string
    width?: number
    height?: number
    waveform?: number[]
  } | null
  location: {
    latitude: number
    longitude: number
    address?: string
  } | null
  isLocked: boolean
  isStarred: boolean
  isEdited: boolean
  isPinned: boolean
  task: {
    isTask: boolean
    reminderAt?: string
    isCompleted: boolean
    completedAt?: string
    notificationId?: string
  }
  linkPreview: {
    url: string
    title?: string
    description?: string
    image?: string
  } | null
  syncStatus: SyncStatus
  createdAt: string
  updatedAt: string
}

export interface UserProfile {
  id: string
  serverId: string | null
  deviceId: string
  name: string
  username: string | null
  email: string | null
  phone: string | null
  avatar: string | null
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
  syncStatus: SyncStatus
  createdAt: string
  updatedAt: string
}

// Pagination types
export interface PaginatedResult<T> {
  data: T[]
  hasMore: boolean
  total: number
}

export interface NoteCursor {
  before?: string
  after?: string
  limit?: number
}

// Task filter types
export type TaskFilter = 'pending' | 'completed' | 'overdue' | 'all'
