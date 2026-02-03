import { Platform } from 'react-native'
import axios, { AxiosInstance, AxiosError } from 'axios'
import { getDeviceId } from './storage'
import type { Chat, Message, User, MessageType } from '../types'

// Android emulator uses 10.0.2.2 to reach host machine's localhost
const getDefaultUrl = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api'
  }
  return 'http://localhost:3000/api'
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || getDefaultUrl()

let apiInstance: AxiosInstance | null = null

async function getApi(): Promise<AxiosInstance> {
  if (apiInstance) return apiInstance

  const deviceId = await getDeviceId()

  apiInstance = axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json',
      'X-Device-ID': deviceId,
    },
  })

  apiInstance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      console.error('API Error:', error.response?.data || error.message)
      return Promise.reject(error)
    }
  )

  return apiInstance
}

// Auth
export async function registerDevice(): Promise<{ user: User; isNew: boolean }> {
  const api = await getApi()
  const deviceId = await getDeviceId()
  const response = await api.post('/auth/register', { deviceId })
  return response.data
}

export async function getCurrentUser(): Promise<User> {
  const api = await getApi()
  const response = await api.get('/auth/me')
  return response.data.user
}

export async function updateUser(data: Partial<User>): Promise<User> {
  const api = await getApi()
  const response = await api.put('/auth/me', data)
  return response.data.user
}

export async function deleteAccount(): Promise<void> {
  const api = await getApi()
  await api.delete('/auth/me')
}

// Chats
export interface ChatsResponse {
  chats: Chat[]
  total: number
  page: number
  hasMore: boolean
}

export async function getChats(params?: {
  search?: string
  filter?: 'all' | 'tasks' | 'pinned'
  page?: number
  limit?: number
}): Promise<ChatsResponse> {
  const api = await getApi()
  const response = await api.get('/chats', { params })
  return response.data
}

export async function getChat(id: string): Promise<Chat> {
  const api = await getApi()
  const response = await api.get(`/chats/${id}`)
  return response.data.chat
}

export async function createChat(data: { name: string; icon?: string }): Promise<Chat> {
  const api = await getApi()
  const response = await api.post('/chats', data)
  return response.data.chat
}

export async function updateChat(
  id: string,
  data: Partial<Pick<Chat, 'name' | 'icon' | 'isPinned' | 'wallpaper'>>
): Promise<Chat> {
  const api = await getApi()
  const response = await api.put(`/chats/${id}`, data)
  return response.data.chat
}

export async function deleteChat(
  id: string
): Promise<{ success: boolean; lockedMessagesCount: number }> {
  const api = await getApi()
  const response = await api.delete(`/chats/${id}`)
  return response.data
}

// Messages
export interface MessagesResponse {
  messages: Message[]
  hasMore: boolean
}

export async function getMessages(
  chatId: string,
  params?: { before?: string; after?: string; limit?: number }
): Promise<MessagesResponse> {
  const api = await getApi()
  const response = await api.get(`/chats/${chatId}/messages`, { params })
  return response.data
}

export async function sendMessage(
  chatId: string,
  data: { content?: string; type: MessageType }
): Promise<Message> {
  const api = await getApi()
  const response = await api.post(`/chats/${chatId}/messages`, data)
  return response.data.message
}

export async function updateMessage(
  chatId: string,
  messageId: string,
  data: { content: string }
): Promise<Message> {
  const api = await getApi()
  const response = await api.put(`/chats/${chatId}/messages/${messageId}`, data)
  return response.data.message
}

export async function deleteMessage(chatId: string, messageId: string): Promise<void> {
  const api = await getApi()
  await api.delete(`/chats/${chatId}/messages/${messageId}`)
}

export async function lockMessage(
  chatId: string,
  messageId: string,
  isLocked: boolean
): Promise<Message> {
  const api = await getApi()
  const response = await api.put(`/chats/${chatId}/messages/${messageId}/lock`, {
    isLocked,
  })
  return response.data.message
}

export async function starMessage(
  chatId: string,
  messageId: string,
  isStarred: boolean
): Promise<Message> {
  const api = await getApi()
  const response = await api.put(`/chats/${chatId}/messages/${messageId}/star`, {
    isStarred,
  })
  return response.data.message
}

export async function setMessageTask(
  chatId: string,
  messageId: string,
  data: { isTask: boolean; reminderAt?: string }
): Promise<Message> {
  const api = await getApi()
  const response = await api.put(`/chats/${chatId}/messages/${messageId}/task`, data)
  return response.data.message
}

export async function completeTask(chatId: string, messageId: string): Promise<Message> {
  const api = await getApi()
  const response = await api.put(`/chats/${chatId}/messages/${messageId}/task/complete`)
  return response.data.message
}

// Tasks
export interface TasksResponse {
  tasks: Message[]
  total: number
}

export async function getTasks(params?: {
  filter?: 'pending' | 'completed' | 'overdue'
  chatId?: string
  page?: number
  limit?: number
}): Promise<TasksResponse> {
  const api = await getApi()
  const response = await api.get('/tasks', { params })
  return response.data
}

export async function getUpcomingTasks(days?: number): Promise<{ tasks: Message[] }> {
  const api = await getApi()
  const response = await api.get('/tasks/upcoming', { params: { days } })
  return response.data
}

// Search
export interface SearchResponse {
  results: {
    chats: Chat[]
    messages: Message[]
  }
  total: number
}

export async function search(params: {
  q: string
  type?: 'all' | 'chats' | 'messages'
  page?: number
  limit?: number
}): Promise<SearchResponse> {
  const api = await getApi()
  const response = await api.get('/search', { params })
  return response.data
}

export async function searchInChat(
  chatId: string,
  params: { q: string; page?: number; limit?: number }
): Promise<{ messages: Message[]; total: number }> {
  const api = await getApi()
  const response = await api.get(`/search/chat/${chatId}`, { params })
  return response.data
}

// Share
export async function lookupUser(
  query: string
): Promise<{ user: { id: string; name: string; avatar?: string } | null }> {
  const api = await getApi()
  const response = await api.post('/share/lookup', { query })
  return response.data
}

export async function shareChat(
  chatId: string,
  data: { userId: string; permissions?: { canEdit?: boolean; canDelete?: boolean } }
): Promise<void> {
  const api = await getApi()
  await api.post(`/share/chat/${chatId}`, data)
}

export async function getPendingShares(): Promise<{ pendingShares: any[] }> {
  const api = await getApi()
  const response = await api.get('/share/pending')
  return response.data
}

export async function acceptShare(shareId: string): Promise<void> {
  const api = await getApi()
  await api.put(`/share/accept/${shareId}`)
}

export async function rejectShare(shareId: string): Promise<void> {
  const api = await getApi()
  await api.put(`/share/reject/${shareId}`)
}

// Export
export async function exportChat(
  chatId: string,
  format: 'txt' | 'json' = 'txt'
): Promise<string> {
  const api = await getApi()
  const response = await api.get(`/chats/${chatId}/export`, {
    params: { format },
    responseType: 'text',
  })
  return response.data
}
