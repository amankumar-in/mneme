import { useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { useDb } from '@/contexts/DatabaseContext'
import { getNoteRepository, getThreadRepository } from '@/services/repositories'
import { useSyncService } from './useSyncService'
import type { NoteWithDetails, PaginatedResult, NoteType } from '@/services/database/types'

export function useNotes(threadId: string, params?: { limit?: number }) {
  const db = useDb()
  const noteRepo = getNoteRepository(db)
  const limit = params?.limit ?? 50

  return useInfiniteQuery({
    queryKey: ['notes', threadId, params],
    queryFn: async ({ pageParam }) => {
      const result = await noteRepo.getByThread(threadId, {
        before: pageParam,
        limit,
      })
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

export function useSendNote(threadId: string) {
  const db = useDb()
  const noteRepo = getNoteRepository(db)
  const threadRepo = getThreadRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: async (data: { content?: string; type: NoteType }) => {
      const note = await noteRepo.create({
        threadId,
        content: data.content,
        type: data.type,
      })

      // Update thread's last note
      await threadRepo.updateLastNote(
        threadId,
        data.content ?? null,
        data.type,
        note.createdAt
      )

      return note
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', threadId] })
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
    mutationFn: (noteId: string) => noteRepo.delete(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', threadId] })
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
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: ({
      noteId,
      isTask,
      reminderAt,
      isCompleted,
    }: {
      noteId: string
      isTask: boolean
      reminderAt?: string
      isCompleted?: boolean
    }) => noteRepo.setTask(noteId, { isTask, reminderAt, isCompleted }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', threadId] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      schedulePush()
    },
  })
}

export function useCompleteTask(threadId: string) {
  const db = useDb()
  const noteRepo = getNoteRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: (noteId: string) => noteRepo.completeTask(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', threadId] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      schedulePush()
    },
  })
}
