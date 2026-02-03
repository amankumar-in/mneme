import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import {
  getMessages,
  sendMessage,
  updateMessage,
  deleteMessage,
  lockMessage,
  starMessage,
  setMessageTask,
  completeTask,
  MessagesResponse,
} from '../services/api'
import type { Message, MessageType } from '../types'

export function useMessages(chatId: string, params?: { limit?: number }) {
  return useInfiniteQuery({
    queryKey: ['messages', chatId, params],
    queryFn: ({ pageParam }) =>
      getMessages(chatId, {
        before: pageParam,
        limit: params?.limit || 50,
      }),
    getNextPageParam: (lastPage: MessagesResponse) => {
      if (!lastPage.hasMore || lastPage.messages.length === 0) return undefined
      const oldestMessage = lastPage.messages[lastPage.messages.length - 1]
      return oldestMessage?.createdAt
    },
    initialPageParam: undefined as string | undefined,
    enabled: !!chatId,
  })
}

export function useSendMessage(chatId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { content?: string; type: MessageType }) =>
      sendMessage(chatId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
      queryClient.invalidateQueries({ queryKey: ['chats'] })
    },
  })
}

export function useUpdateMessage(chatId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      updateMessage(chatId, messageId, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
      queryClient.invalidateQueries({ queryKey: ['chats'] })
    },
  })
}

export function useDeleteMessage(chatId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (messageId: string) => deleteMessage(chatId, messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
      queryClient.invalidateQueries({ queryKey: ['chats'] })
    },
  })
}

export function useLockMessage(chatId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ messageId, isLocked }: { messageId: string; isLocked: boolean }) =>
      lockMessage(chatId, messageId, isLocked),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
    },
  })
}

export function useStarMessage(chatId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ messageId, isStarred }: { messageId: string; isStarred: boolean }) =>
      starMessage(chatId, messageId, isStarred),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
    },
  })
}

export function useSetMessageTask(chatId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      messageId,
      isTask,
      reminderAt,
    }: {
      messageId: string
      isTask: boolean
      reminderAt?: string
    }) => setMessageTask(chatId, messageId, { isTask, reminderAt }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useCompleteTask(chatId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (messageId: string) => completeTask(chatId, messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}
