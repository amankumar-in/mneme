import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client'
import { useConnectionStore } from '../store/connectionStore'
import type { ThreadWithLastNote } from '../api/types'

export function useThreads(search?: string) {
  const status = useConnectionStore((s) => s.status)
  return useQuery<ThreadWithLastNote[]>({
    queryKey: ['threads', search],
    queryFn: () =>
      apiClient
        .get('/api/threads', { params: search ? { search } : undefined })
        .then((r) => r.data.data),
    enabled: status === 'connected',
  })
}

export function useCreateThread() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; icon?: string }) =>
      apiClient.post('/api/threads', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threads'] })
    },
  })
}

export function useUpdateThread() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; icon?: string; isPinned?: boolean; isLocked?: boolean }) =>
      apiClient.patch(`/api/threads/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threads'] })
    },
  })
}

export function useDeleteThread() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/api/threads/${id}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threads'] })
    },
  })
}
