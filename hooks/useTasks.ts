import { useQuery } from '@tanstack/react-query'
import { useDb } from '@/contexts/DatabaseContext'
import { getNoteRepository } from '@/services/repositories'
import type { TaskFilter } from '@/services/database/types'

export function useTasks(params?: {
  filter?: TaskFilter
  threadId?: string
  page?: number
  limit?: number
}) {
  const db = useDb()
  const noteRepo = getNoteRepository(db)

  return useQuery({
    queryKey: ['tasks', params],
    queryFn: async () => {
      const result = await noteRepo.getTasks(params)
      return {
        tasks: result.data,
        hasMore: result.hasMore,
        total: result.total,
      }
    },
  })
}

export function useUpcomingTasks(days?: number) {
  const db = useDb()
  const noteRepo = getNoteRepository(db)

  return useQuery({
    queryKey: ['tasks', 'upcoming', days],
    queryFn: async () => {
      const tasks = await noteRepo.getUpcomingTasks(days ?? 7)
      return { tasks }
    },
  })
}
