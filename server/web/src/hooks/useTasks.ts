import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client'
import { useConnectionStore } from '../store/connectionStore'
import type { NoteWithDetails } from '../api/types'

export function useTasks() {
  const status = useConnectionStore((s) => s.status)
  return useQuery<NoteWithDetails[]>({
    queryKey: ['tasks'],
    queryFn: () => apiClient.get('/api/tasks').then((r) => r.data),
    enabled: status === 'connected',
  })
}

export function useToggleTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isCompleted }: { id: string; isCompleted: boolean }) =>
      apiClient.patch(`/api/notes/${id}`, { task: { isCompleted } }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}
