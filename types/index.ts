export type NoteType = 'text' | 'image' | 'voice' | 'file' | 'location'

// Re-export local database types for components that need them
export type {
  ThreadWithLastNote,
  NoteWithDetails,
  UserProfile,
  SyncStatus,
  TaskFilter,
} from '@/services/database/types'

// Legacy server types (used by sync service and API compatibility)
export interface ServerThread {
  _id: string
  name: string
  icon?: string
  ownerId: string
  participants: string[]
  isShared: boolean
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

export interface ServerNote {
  _id: string
  threadId: string
  threadName?: string
  senderId: string
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

export interface ServerUser {
  _id: string
  deviceId: string
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

// Alias for backward compatibility (components use these)
export type Thread = ServerThread
export type Note = ServerNote
export type User = ServerUser

export type ThreadFilter = 'threads' | 'tasks'
