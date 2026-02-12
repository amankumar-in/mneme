import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDb } from '@/contexts/DatabaseContext'
import { getBoardRepository } from '@/services/repositories'
import { useSyncService } from './useSyncService'
import type {
  Board,
  BoardItem,
  BoardStroke,
  BoardConnection,
  CreateBoardInput,
  UpdateBoardInput,
  CreateBoardItemInput,
  UpdateBoardItemInput,
  CreateBoardStrokeInput,
  CreateBoardConnectionInput,
  UpdateBoardConnectionInput,
} from '@/services/database/types'
import { useCallback, useRef } from 'react'

// ── Board Queries ──────────────────────────────────────

export function useBoards(search?: string) {
  const db = useDb()
  const repo = getBoardRepository(db)

  return useQuery({
    queryKey: ['boards', search],
    queryFn: () => repo.getAll({ search }),
  })
}

export function useBoard(id: string) {
  const db = useDb()
  const repo = getBoardRepository(db)

  return useQuery({
    queryKey: ['board', id],
    queryFn: () => repo.getById(id),
    enabled: !!id,
  })
}

export function useBoardItems(boardId: string) {
  const db = useDb()
  const repo = getBoardRepository(db)

  return useQuery({
    queryKey: ['board-items', boardId],
    queryFn: () => repo.getItemsByBoard(boardId),
    enabled: !!boardId,
  })
}

export function useBoardStrokes(boardId: string) {
  const db = useDb()
  const repo = getBoardRepository(db)

  return useQuery({
    queryKey: ['board-strokes', boardId],
    queryFn: () => repo.getStrokesByBoard(boardId),
    enabled: !!boardId,
  })
}

export function useBoardConnections(boardId: string) {
  const db = useDb()
  const repo = getBoardRepository(db)

  return useQuery({
    queryKey: ['board-connections', boardId],
    queryFn: () => repo.getConnectionsByBoard(boardId),
    enabled: !!boardId,
  })
}

// ── Board Mutations ──────────────────────────────────────

export function useCreateBoard() {
  const db = useDb()
  const repo = getBoardRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: (data: CreateBoardInput) => repo.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] })
      schedulePush()
    },
  })
}

export function useUpdateBoard() {
  const db = useDb()
  const repo = getBoardRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBoardInput }) =>
      repo.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['boards'] })
      queryClient.invalidateQueries({ queryKey: ['board', id] })
      schedulePush()
    },
  })
}

export function useDeleteBoard() {
  const db = useDb()
  const repo = getBoardRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: (id: string) => repo.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] })
      queryClient.invalidateQueries({ queryKey: ['trash'] })
      schedulePush()
    },
  })
}

// ── Item Mutations ──────────────────────────────────────

export function useCreateBoardItem(boardId: string) {
  const db = useDb()
  const repo = getBoardRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: (data: Omit<CreateBoardItemInput, 'boardId'>) =>
      repo.createItem({ ...data, boardId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-items', boardId] })
      schedulePush()
    },
  })
}

export function useUpdateBoardItem(boardId: string) {
  const db = useDb()
  const repo = getBoardRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBoardItemInput }) =>
      repo.updateItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-items', boardId] })
      schedulePush()
    },
  })
}

export function useDeleteBoardItem(boardId: string) {
  const db = useDb()
  const repo = getBoardRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: (id: string) => repo.deleteItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-items', boardId] })
      queryClient.invalidateQueries({ queryKey: ['board-connections', boardId] })
      schedulePush()
    },
  })
}

// ── Stroke Mutations ──────────────────────────────────────

export function useCreateBoardStroke(boardId: string) {
  const db = useDb()
  const repo = getBoardRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: (data: Omit<CreateBoardStrokeInput, 'boardId'>) =>
      repo.createStroke({ ...data, boardId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-strokes', boardId] })
      schedulePush()
    },
  })
}

export function useUpdateBoardStroke(boardId: string) {
  const db = useDb()
  const repo = getBoardRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { xOffset?: number; yOffset?: number } }) =>
      repo.updateStroke(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-strokes', boardId] })
      schedulePush()
    },
  })
}

export function useDeleteBoardStroke(boardId: string) {
  const db = useDb()
  const repo = getBoardRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: (id: string) => repo.deleteStroke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-strokes', boardId] })
      schedulePush()
    },
  })
}

// ── Connection Mutations ──────────────────────────────────

export function useCreateBoardConnection(boardId: string) {
  const db = useDb()
  const repo = getBoardRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: (data: Omit<CreateBoardConnectionInput, 'boardId'>) =>
      repo.createConnection({ ...data, boardId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-connections', boardId] })
      schedulePush()
    },
  })
}

export function useUpdateBoardConnection(boardId: string) {
  const db = useDb()
  const repo = getBoardRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBoardConnectionInput }) =>
      repo.updateConnection(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-connections', boardId] })
      schedulePush()
    },
  })
}

export function useDeleteBoardConnection(boardId: string) {
  const db = useDb()
  const repo = getBoardRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: (id: string) => repo.deleteConnection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-connections', boardId] })
      schedulePush()
    },
  })
}

// ── Batch Operations ──────────────────────────────────────

export function useGroupItems(boardId: string) {
  const db = useDb()
  const repo = getBoardRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: async ({ itemIds, strokeIds, groupId }: { itemIds: string[]; strokeIds: string[]; groupId: string }) => {
      await repo.setGroupForItems(itemIds, groupId)
      await repo.setGroupForStrokes(strokeIds, groupId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-items', boardId] })
      queryClient.invalidateQueries({ queryKey: ['board-strokes', boardId] })
      schedulePush()
    },
  })
}

export function useUngroupItems(boardId: string) {
  const db = useDb()
  const repo = getBoardRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: async ({ itemIds, strokeIds }: { itemIds: string[]; strokeIds: string[] }) => {
      await repo.setGroupForItems(itemIds, null)
      await repo.setGroupForStrokes(strokeIds, null)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-items', boardId] })
      queryClient.invalidateQueries({ queryKey: ['board-strokes', boardId] })
      schedulePush()
    },
  })
}

export function useBatchDelete(boardId: string) {
  const db = useDb()
  const repo = getBoardRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: async ({ itemIds, strokeIds }: { itemIds: string[]; strokeIds: string[] }) => {
      await repo.deleteItems(itemIds)
      await repo.deleteStrokes(strokeIds)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-items', boardId] })
      queryClient.invalidateQueries({ queryKey: ['board-strokes', boardId] })
      queryClient.invalidateQueries({ queryKey: ['board-connections', boardId] })
      schedulePush()
    },
  })
}

export function useBatchUpdatePositions(boardId: string) {
  const db = useDb()
  const repo = getBoardRepository(db)
  const queryClient = useQueryClient()
  const { schedulePush } = useSyncService()

  return useMutation({
    mutationFn: (updates: { id: string; x: number; y: number; width: number; height: number }[]) =>
      repo.updateItemPositions(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-items', boardId] })
      schedulePush()
    },
  })
}

// ── Viewport (debounced, no sync) ──────────────────────────

export function useSaveViewport(boardId: string) {
  const db = useDb()
  const repo = getBoardRepository(db)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = useCallback(
    (viewport: { x: number; y: number; zoom: number }) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        repo.updateViewport(boardId, viewport)
      }, 500)
    },
    [boardId, repo]
  )

  return { saveViewport: save }
}
