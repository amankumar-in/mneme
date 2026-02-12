import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../api/client'
import { useConnectionStore } from '../store/connectionStore'
import type { NoteWithDetails } from '../api/types'

export function useSearch(query: string) {
  const status = useConnectionStore((s) => s.status)
  return useQuery<NoteWithDetails[]>({
    queryKey: ['search', query],
    queryFn: () =>
      apiClient
        .get('/api/search', { params: { q: query } })
        .then((r) => r.data),
    enabled: status === 'connected' && query.length >= 2,
  })
}
