import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDb } from '@/contexts/DatabaseContext'
import { getNoteRepository, getThreadRepository, getBoardRepository } from '@/services/repositories'
import { useSyncService } from './useSyncService'
import { deleteAttachment } from '@/services/fileStorage'

export function useDeletedThreads() {
  const db = useDb()
  const threadRepo = getThreadRepository(db)

  return useQuery({
    queryKey: ['trash', 'threads'],
    queryFn: () => threadRepo.getDeleted(),
  })
}

export function useDeletedNotes() {
  const db = useDb()
  const noteRepo = getNoteRepository(db)

  return useQuery({
    queryKey: ['trash', 'notes'],
    queryFn: () => noteRepo.getDeleted(),
  })
}

export function useRestoreThread() {
  const db = useDb()
  const threadRepo = getThreadRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: (id: string) => threadRepo.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash'] })
      queryClient.invalidateQueries({ queryKey: ['threads'] })
      schedulePush()
    },
  })
}

export function useRestoreNote() {
  const db = useDb()
  const noteRepo = getNoteRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: (id: string) => noteRepo.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash'] })
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      queryClient.invalidateQueries({ queryKey: ['threads'] })
      schedulePush()
    },
  })
}

export function usePermanentlyDeleteThread() {
  const db = useDb()
  const threadRepo = getThreadRepository(db)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => threadRepo.permanentlyDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash'] })
    },
  })
}

export function usePermanentlyDeleteNote() {
  const db = useDb()
  const noteRepo = getNoteRepository(db)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const note = await noteRepo.getById(id)
      // Delete local attachment file if exists
      if (note?.attachment?.url && !note.attachment.url.startsWith('http')) {
        await deleteAttachment(note.attachment.url)
        if (note.attachment.thumbnail && !note.attachment.thumbnail.startsWith('http')) {
          await deleteAttachment(note.attachment.thumbnail)
        }
      }
      await noteRepo.permanentlyDelete(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash'] })
    },
  })
}

export function useDeletedBoards() {
  const db = useDb()
  const boardRepo = getBoardRepository(db)

  return useQuery({
    queryKey: ['trash', 'boards'],
    queryFn: () => boardRepo.getDeleted(),
  })
}

export function useRestoreBoard() {
  const db = useDb()
  const boardRepo = getBoardRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: (id: string) => boardRepo.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash'] })
      queryClient.invalidateQueries({ queryKey: ['boards'] })
      schedulePush()
    },
  })
}

export function usePermanentlyDeleteBoard() {
  const db = useDb()
  const boardRepo = getBoardRepository(db)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => boardRepo.permanentlyDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash'] })
    },
  })
}

export function usePurgeOldTrash() {
  const db = useDb()
  const threadRepo = getThreadRepository(db)
  const noteRepo = getNoteRepository(db)
  const boardRepo = getBoardRepository(db)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (days: number = 30) => {
      const threadsPurged = await threadRepo.purgeOlderThan(days)
      const notesPurged = await noteRepo.purgeOlderThan(days)
      const boardsPurged = await boardRepo.purgeOlderThan(days)
      return { threadsPurged, notesPurged, boardsPurged }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash'] })
    },
  })
}
