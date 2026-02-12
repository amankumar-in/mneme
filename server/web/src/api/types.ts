export type NoteType = 'text' | 'image' | 'video' | 'voice' | 'file' | 'location' | 'contact' | 'audio'

export interface ThreadWithLastNote {
  id: string
  serverId: string | null
  name: string
  icon: string | null
  isPinned: boolean
  isSystemThread: boolean
  isLocked: boolean
  wallpaper: string | null
  lastNote: { content: string | null; type: NoteType; timestamp: string } | null
  syncStatus: string
  createdAt: string
  updatedAt: string
}

export interface Attachment {
  url: string
  filename: string | null
  mimeType: string | null
  size: number | null
  duration: number | null
  thumbnail: string | null
  width: number | null
  height: number | null
  waveform?: number[] | null
}

export interface NoteWithDetails {
  id: string
  serverId: string | null
  threadId: string
  threadName: string | null
  content: string | null
  type: NoteType
  attachment: Attachment | null
  location: { latitude: number; longitude: number; address?: string } | null
  isLocked: boolean
  isStarred: boolean
  isEdited: boolean
  isPinned: boolean
  task: { isTask: boolean; reminderAt?: string | null; isCompleted: boolean; completedAt?: string | null }
  linkPreview: { url: string; title?: string; description?: string; image?: string } | null
  syncStatus: string
  createdAt: string
  updatedAt: string
}

export interface PaginatedResult<T> {
  data: T[]
  hasMore: boolean
  nextCursor?: string
}

export interface CreateNoteInput {
  threadId: string
  content?: string
  type: NoteType
  attachment?: Partial<Attachment>
}
