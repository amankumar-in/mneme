import { useQuery } from '@tanstack/react-query'
import { useDb } from '@/contexts/DatabaseContext'
import { getNoteRepository, getThreadRepository } from '@/services/repositories'

export function useSearch(
  query: string,
  params?: {
    type?: 'all' | 'threads' | 'notes'
    page?: number
    limit?: number
  }
) {
  const db = useDb()
  const noteRepo = getNoteRepository(db)
  const threadRepo = getThreadRepository(db)

  return useQuery({
    queryKey: ['search', query, params],
    queryFn: async () => {
      const type = params?.type ?? 'all'

      if (type === 'threads') {
        const threads = await threadRepo.getAll({ search: query, page: params?.page, limit: params?.limit })
        return {
          threads: threads.data,
          notes: [],
          total: threads.total,
        }
      }

      if (type === 'notes') {
        const notes = await noteRepo.search({ query, page: params?.page, limit: params?.limit })
        return {
          threads: [],
          notes: notes.data,
          total: notes.total,
        }
      }

      // 'all' - search both
      const [threads, notes] = await Promise.all([
        threadRepo.getAll({ search: query, page: params?.page, limit: params?.limit }),
        noteRepo.search({ query, page: params?.page, limit: params?.limit }),
      ])

      return {
        threads: threads.data,
        notes: notes.data,
        total: threads.total + notes.total,
      }
    },
    enabled: query.length >= 2,
  })
}

export function useSearchInThread(
  threadId: string,
  query: string,
  params?: { page?: number; limit?: number }
) {
  const db = useDb()
  const noteRepo = getNoteRepository(db)

  return useQuery({
    queryKey: ['search', 'thread', threadId, query, params],
    queryFn: async () => {
      const result = await noteRepo.searchInThread(threadId, query, params)
      return {
        notes: result.data,
        total: result.total,
      }
    },
    enabled: query.length >= 2 && !!threadId,
  })
}
