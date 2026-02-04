import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { useDb } from '@/contexts/DatabaseContext'
import { getThreadRepository } from '@/services/repositories'
import { useSyncService } from './useSyncService'
import type { ThreadWithLastNote, PaginatedResult } from '@/services/database/types'

export function useThreads(params?: {
  search?: string
  filter?: 'all' | 'tasks' | 'pinned'
}) {
  const db = useDb()
  const threadRepo = getThreadRepository(db)

  return useQuery({
    queryKey: ['threads', params],
    queryFn: async (): Promise<PaginatedResult<ThreadWithLastNote>> => {
      return threadRepo.getAll({ search: params?.search })
    },
  })
}

export function useInfiniteThreads(params?: {
  search?: string
  filter?: 'all' | 'tasks' | 'pinned'
  limit?: number
}) {
  const db = useDb()
  const threadRepo = getThreadRepository(db)
  const limit = params?.limit ?? 20

  return useInfiniteQuery({
    queryKey: ['threads', 'infinite', params],
    queryFn: async ({ pageParam = 1 }) => {
      const result = await threadRepo.getAll({
        search: params?.search,
        page: pageParam,
        limit,
      })
      return { ...result, page: pageParam }
    },
    getNextPageParam: (lastPage: PaginatedResult<ThreadWithLastNote> & { page: number }) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
  })
}

export function useThread(id: string) {
  const db = useDb()
  const threadRepo = getThreadRepository(db)

  return useQuery({
    queryKey: ['thread', id],
    queryFn: () => threadRepo.getById(id),
    enabled: !!id,
  })
}

export function useCreateThread() {
  const db = useDb()
  const threadRepo = getThreadRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: (data: { name: string; icon?: string }) => threadRepo.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threads'] })
      schedulePush()
    },
  })
}

export function useUpdateThread() {
  const db = useDb()
  const threadRepo = getThreadRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<{ name: string; icon: string | null; isPinned: boolean; wallpaper: string | null }>
    }) => threadRepo.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['threads'] })
      queryClient.invalidateQueries({ queryKey: ['thread', id] })
      schedulePush()
    },
  })
}

export function useDeleteThread() {
  const db = useDb()
  const threadRepo = getThreadRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: (id: string) => threadRepo.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threads'] })
      schedulePush()
    },
  })
}
