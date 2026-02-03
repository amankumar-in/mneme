export type MessageType = 'text' | 'image' | 'voice' | 'file' | 'location'

export interface Chat {
  _id: string
  name: string
  icon?: string
  ownerId: string
  participants: string[]
  isShared: boolean
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

export interface Message {
  _id: string
  chatId: string
  senderId: string
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

export interface User {
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
      sharedMessages: boolean
    }
    privacy: {
      visibility: 'public' | 'private' | 'contacts'
    }
  }
  createdAt: string
  updatedAt: string
}

export type ChatFilter = 'all' | 'tasks'
