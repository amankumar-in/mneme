import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { useDb } from '@/contexts/DatabaseContext'
import { getNoteRepository, getThreadRepository, getUserRepository } from '@/services/repositories'
import { useSyncService } from './useSyncService'
import {
  scheduleTaskReminder,
  cancelReminder,
} from '@/services/notifications/notification.service'
import type { NoteWithDetails, PaginatedResult, NoteType, CreateNoteInput } from '@/services/database/types'
import { deleteAttachment } from '@/services/fileStorage'

export function useNotes(threadId: string, params?: { limit?: number; isSystemThread?: boolean }) {
  const db = useDb()
  const noteRepo = getNoteRepository(db)
  const limit = params?.limit ?? 50

  return useInfiniteQuery({
    queryKey: ['notes', threadId, params],
    queryFn: async ({ pageParam }) => {
      const result = params?.isSystemThread
        ? await noteRepo.getAllLocked({ before: pageParam, limit })
        : await noteRepo.getByThread(threadId, { before: pageParam, limit })
      return {
        notes: result.data,
        hasMore: result.hasMore,
        total: result.total,
      }
    },
    getNextPageParam: (lastPage: { notes: NoteWithDetails[]; hasMore: boolean }) => {
      if (!lastPage.hasMore || lastPage.notes.length === 0) return undefined
      const oldestNote = lastPage.notes[lastPage.notes.length - 1]
      return oldestNote?.createdAt
    },
    initialPageParam: undefined as string | undefined,
    enabled: !!threadId,
  })
}

export function useThreadMedia(threadId: string, types: NoteType[], limit?: number) {
  const db = useDb()
  const noteRepo = getNoteRepository(db)

  return useQuery({
    queryKey: ['thread-media', threadId, types],
    queryFn: () => noteRepo.getMediaByThread(threadId, types, 1, limit),
    enabled: !!threadId,
  })
}

export function useSendNote(threadId: string) {
  const db = useDb()
  const noteRepo = getNoteRepository(db)
  const threadRepo = getThreadRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: async (data: {
      content?: string
      type: NoteType
      attachment?: CreateNoteInput['attachment']
      location?: CreateNoteInput['location']
    }) => {
      const note = await noteRepo.create({
        threadId,
        content: data.content,
        type: data.type,
        attachment: data.attachment,
        location: data.location,
      })

      // Build meaningful lastNote content for non-text types
      let lastNoteContent = data.content ?? null
      if (!lastNoteContent) {
        switch (data.type) {
          case 'image': lastNoteContent = 'Photo'; break
          case 'video': lastNoteContent = 'Video'; break
          case 'file': lastNoteContent = data.attachment?.filename || 'File'; break
          case 'location': lastNoteContent = data.location?.address || 'Location'; break
          case 'contact': lastNoteContent = data.attachment?.filename || 'Contact'; break
          case 'audio': lastNoteContent = data.attachment?.filename || 'Audio'; break
          case 'voice': lastNoteContent = 'Voice note'; break
        }
      }

      // Update thread's last note
      await threadRepo.updateLastNote(
        threadId,
        lastNoteContent,
        data.type,
        note.createdAt
      )

      return note
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', threadId] })
      queryClient.invalidateQueries({ queryKey: ['thread-media', threadId] })
      queryClient.invalidateQueries({ queryKey: ['threads'] })
      schedulePush()
    },
  })
}

export function useUpdateNote(threadId: string) {
  const db = useDb()
  const noteRepo = getNoteRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: ({ noteId, content }: { noteId: string; content: string }) =>
      noteRepo.update(noteId, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', threadId] })
      queryClient.invalidateQueries({ queryKey: ['thread-media', threadId] })
      queryClient.invalidateQueries({ queryKey: ['threads'] })
      schedulePush()
    },
  })
}

export function useDeleteNote(threadId: string) {
  const db = useDb()
  const noteRepo = getNoteRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: async (noteId: string) => {
      const note = await noteRepo.getById(noteId)
      // Cancel any scheduled notification before deleting
      if (note?.task.notificationId) {
        await cancelReminder(note.task.notificationId)
      }
      // Delete local attachment file if exists (relative paths or file:// URIs)
      if (note?.attachment?.url && !note.attachment.url.startsWith('http')) {
        await deleteAttachment(note.attachment.url)
        // Also delete thumbnail if present
        if (note.attachment.thumbnail && !note.attachment.thumbnail.startsWith('http')) {
          await deleteAttachment(note.attachment.thumbnail)
        }
      }
      await noteRepo.delete(noteId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', threadId] })
      queryClient.invalidateQueries({ queryKey: ['thread-media', threadId] })
      queryClient.invalidateQueries({ queryKey: ['threads'] })
      schedulePush()
    },
  })
}

export function useLockNote(threadId: string) {
  const db = useDb()
  const noteRepo = getNoteRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: ({ noteId, isLocked }: { noteId: string; isLocked: boolean }) =>
      noteRepo.setLocked(noteId, isLocked),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', threadId] })
      queryClient.invalidateQueries({ queryKey: ['thread-media', threadId] })
      // Protected Notes aggregates all locked notes — invalidate its cache too
      queryClient.invalidateQueries({ queryKey: ['notes', 'system-protected-notes'] })
      queryClient.invalidateQueries({ queryKey: ['threads'] })
      schedulePush()
    },
  })
}

export function useStarNote(threadId: string) {
  const db = useDb()
  const noteRepo = getNoteRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: ({ noteId, isStarred }: { noteId: string; isStarred: boolean }) =>
      noteRepo.setStarred(noteId, isStarred),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', threadId] })
      schedulePush()
    },
  })
}

export function useSetNoteTask(threadId: string) {
  const db = useDb()
  const noteRepo = getNoteRepository(db)
  const userRepo = getUserRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: async ({
      noteId,
      isTask,
      reminderAt,
      isCompleted,
    }: {
      noteId: string
      isTask: boolean
      reminderAt?: string
      isCompleted?: boolean
    }) => {
      // Cancel any existing notification for this note
      const existingNote = await noteRepo.getById(noteId)
      if (existingNote?.task.notificationId) {
        await cancelReminder(existingNote.task.notificationId)
        await noteRepo.clearNotificationId(noteId)
      }

      // Update the task in DB
      return noteRepo.setTask(noteId, { isTask, reminderAt, isCompleted })
    },
    onSuccess: (updatedNote, { noteId, isTask, reminderAt, isCompleted }) => {
      console.log('[Task] onSuccess:', { noteId, isTask, reminderAt, isCompleted })
      queryClient.invalidateQueries({ queryKey: ['notes', threadId] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      schedulePush()

      // Schedule notification async — don't block UI updates
      console.log('[Task] Notification check:', { isTask, hasReminderAt: !!reminderAt, isCompleted })
      if (isTask && reminderAt && !isCompleted) {
        ;(async () => {
          try {
            const user = await userRepo.get()
            console.log('[Task] User taskReminders:', user?.settings?.notifications?.taskReminders)
            if (user?.settings?.notifications?.taskReminders === false) return

            const notificationId = await scheduleTaskReminder(
              noteId,
              updatedNote?.content || '',
              new Date(reminderAt),
              updatedNote?.threadName
            )
            console.log('[Task] Notification result:', notificationId)
            if (notificationId) {
              await noteRepo.saveNotificationId(noteId, notificationId)
            }
          } catch (error) {
            console.error('[Task] Notification scheduling error:', error)
          }
        })()
      }
    },
  })
}

export function useCompleteTask(threadId: string) {
  const db = useDb()
  const noteRepo = getNoteRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: async (noteId: string) => {
      // Cancel any scheduled notification
      const note = await noteRepo.getById(noteId)
      if (note?.task.notificationId) {
        await cancelReminder(note.task.notificationId)
        await noteRepo.clearNotificationId(noteId)
      }

      return noteRepo.completeTask(noteId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', threadId] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      schedulePush()
    },
  })
}
