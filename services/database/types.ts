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

// ── Board Types ──────────────────────────────────────────────

export type BoardPatternType = 'plain' | 'rules' | 'grid' | 'dots'
export type BoardItemType = 'text' | 'image' | 'shape' | 'audio'

// Database row types (snake_case)
export interface BoardRow {
  id: string
  server_id: string | null
  name: string
  icon: string | null
  pattern_type: string
  viewport_x: number
  viewport_y: number
  viewport_zoom: number
  sync_status: string
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface BoardItemRow {
  id: string
  board_id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  z_index: number
  content: string | null
  image_uri: string | null
  audio_uri: string | null
  audio_duration: number | null
  stroke_color: string | null
  stroke_width: number | null
  fill_color: string | null
  font_size: number | null
  font_weight: string | null
  sync_status: string
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface BoardStrokeRow {
  id: string
  board_id: string
  path_data: string
  color: string
  width: number
  opacity: number
  z_index: number
  x_offset: number
  y_offset: number
  sync_status: string
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface BoardConnectionRow {
  id: string
  board_id: string
  from_item_id: string
  to_item_id: string
  from_side: string
  to_side: string
  color: string
  stroke_width: number
  sync_status: string
  deleted_at: string | null
  created_at: string
  updated_at: string
}

// App types (camelCase)
export interface Board {
  id: string
  serverId: string | null
  name: string
  icon: string | null
  patternType: BoardPatternType
  viewport: { x: number; y: number; zoom: number }
  syncStatus: SyncStatus
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface BoardItem {
  id: string
  boardId: string
  type: BoardItemType
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  content: string | null
  imageUri: string | null
  audioUri: string | null
  audioDuration: number | null
  strokeColor: string | null
  strokeWidth: number | null
  fillColor: string | null
  fontSize: number | null
  fontWeight: string | null
  syncStatus: SyncStatus
  createdAt: string
  updatedAt: string
}

export interface BoardStroke {
  id: string
  boardId: string
  pathData: string
  color: string
  width: number
  opacity: number
  zIndex: number
  xOffset: number
  yOffset: number
  syncStatus: SyncStatus
  createdAt: string
  updatedAt: string
}

export interface BoardConnection {
  id: string
  boardId: string
  fromItemId: string
  toItemId: string
  fromSide: string
  toSide: string
  color: string
  strokeWidth: number
  syncStatus: SyncStatus
  createdAt: string
  updatedAt: string
}

// Input types
export interface CreateBoardInput {
  name: string
  icon?: string | null
}

export interface UpdateBoardInput {
  name?: string
  icon?: string | null
  patternType?: BoardPatternType
}

export interface CreateBoardItemInput {
  boardId: string
  type: BoardItemType
  x: number
  y: number
  width?: number
  height?: number
  content?: string | null
  imageUri?: string | null
  audioUri?: string | null
  audioDuration?: number | null
  strokeColor?: string | null
  strokeWidth?: number | null
  fillColor?: string | null
  fontSize?: number | null
  fontWeight?: string | null
}

export interface UpdateBoardItemInput {
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  zIndex?: number
  content?: string | null
  strokeColor?: string | null
  strokeWidth?: number | null
  fillColor?: string | null
  fontSize?: number | null
  fontWeight?: string | null
}

export interface CreateBoardStrokeInput {
  boardId: string
  pathData: string
  color: string
  width: number
  opacity?: number
  zIndex?: number
  xOffset?: number
  yOffset?: number
}

export interface CreateBoardConnectionInput {
  boardId: string
  fromItemId: string
  toItemId: string
  fromSide: string
  toSide: string
  color?: string
  strokeWidth?: number
}
