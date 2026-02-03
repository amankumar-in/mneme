import { Platform } from 'react-native'
import axios, { AxiosInstance, AxiosError } from 'axios'
import { getAuthToken, setAuthToken, clearAuthToken } from './storage'
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

// Reset the cached API instance (call after logging out)
export function resetApiInstance(): void {
  apiInstance = null
}

async function getApi(): Promise<AxiosInstance> {
  if (apiInstance) return apiInstance

  const token = await getAuthToken()

  apiInstance = axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  apiInstance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      // If server says user doesn't exist, clear the invalid token silently
      if (error.response?.status === 401) {
        const data = error.response?.data as any
        if (data?.error === 'User not found') {
          await clearAuthToken()
          resetApiInstance()
          // Don't log - this is expected when server DB is reset
          // Return a special error the sync service can identify
          const silentError = new Error('AUTH_CLEARED')
          return Promise.reject(silentError)
        }
      }
      console.error('API Error:', error.response?.data || error.message)
      return Promise.reject(error)
    }
  )

  return apiInstance
}

// Helper to update token in cached instance
async function updateApiToken(token: string): Promise<void> {
  await setAuthToken(token)
  // Reset instance so next call gets new token
  apiInstance = null
}

// Auth - No more registerDevice, use signup/login
export async function signup(data: { username: string; password: string; name?: string }): Promise<{ token: string; user: User }> {
  const api = await getApi()
  const response = await api.post('/auth/signup', data)
  await updateApiToken(response.data.token)
  return response.data
}

export async function login(data: { username: string; password: string }): Promise<{ token: string; user: User }> {
  const api = await getApi()
  const response = await api.post('/auth/login', data)
  await updateApiToken(response.data.token)
  return response.data
}

export async function logout(): Promise<void> {
  await clearAuthToken()
  resetApiInstance()
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
  await logout()
}

export async function deleteAccountInfo(): Promise<void> {
  const api = await getApi()
  await api.delete('/auth/account-info')
}

export async function deleteRemoteData(): Promise<{ chatsDeleted: number; messagesDeleted: number }> {
  const api = await getApi()
  const response = await api.delete('/sync/remote-data')
  return response.data.stats
}

export async function getPasswordStatus(): Promise<{ hasPassword: boolean; hasUsername: boolean }> {
  const api = await getApi()
  const response = await api.get('/verify/password-status')
  return response.data
}

export async function setPassword(password: string): Promise<void> {
  const api = await getApi()
  await api.post('/verify/set-password', { password })
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const api = await getApi()
  await api.post('/verify/change-password', { currentPassword, newPassword })
}

export async function checkUsername(username: string): Promise<{ available: boolean; username: string }> {
  const api = await getApi()
  const response = await api.post('/auth/check-username', { username })
  return response.data
}

// Check if user is authenticated (has valid token)
export async function isAuthenticated(): Promise<boolean> {
  const token = await getAuthToken()
  return !!token
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
  data: { isTask: boolean; reminderAt?: string; isCompleted?: boolean }
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
