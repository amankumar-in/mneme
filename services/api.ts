import { Platform } from 'react-native'
import axios, { AxiosInstance, AxiosError } from 'axios'
import { getAuthToken, setAuthToken, clearAuthToken } from './storage'
import type { Thread, Note, User, NoteType } from '../types'

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

export async function deleteRemoteData(): Promise<{ threadsDeleted: number; notesDeleted: number }> {
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

// Phone auth (no token required)
export async function sendPhoneCode(phone: string): Promise<{ isExisting: boolean }> {
  const api = await getApi()
  const response = await api.post('/auth/phone/send', { phone })
  return response.data
}

export async function verifyPhoneCode(phone: string, code: string, name?: string): Promise<{ token: string; user: User; isNew: boolean }> {
  const api = await getApi()
  const response = await api.post('/auth/phone/verify', { phone, code, name })
  await updateApiToken(response.data.token)
  return response.data
}

// Email auth (no token required)
export async function sendEmailCode(email: string): Promise<{ isExisting: boolean }> {
  const api = await getApi()
  const response = await api.post('/auth/email/send', { email })
  return response.data
}

export async function verifyEmailCode(email: string, code: string, name?: string): Promise<{ token: string; user: User; isNew: boolean }> {
  const api = await getApi()
  const response = await api.post('/auth/email/verify', { email, code, name })
  await updateApiToken(response.data.token)
  return response.data
}

// Check if user is authenticated (has valid token)
export async function isAuthenticated(): Promise<boolean> {
  const token = await getAuthToken()
  return !!token
}

// Threads
export interface ThreadsResponse {
  threads: Thread[]
  total: number
  page: number
  hasMore: boolean
}

export async function getThreads(params?: {
  search?: string
  filter?: 'all' | 'tasks' | 'pinned'
  page?: number
  limit?: number
}): Promise<ThreadsResponse> {
  const api = await getApi()
  const response = await api.get('/threads', { params })
  return response.data
}

export async function getThread(id: string): Promise<Thread> {
  const api = await getApi()
  const response = await api.get(`/threads/${id}`)
  return response.data.thread
}

export async function createThread(data: { name: string; icon?: string }): Promise<Thread> {
  const api = await getApi()
  const response = await api.post('/threads', data)
  return response.data.thread
}

export async function updateThread(
  id: string,
  data: Partial<Pick<Thread, 'name' | 'icon' | 'isPinned' | 'wallpaper'>>
): Promise<Thread> {
  const api = await getApi()
  const response = await api.put(`/threads/${id}`, data)
  return response.data.thread
}

export async function deleteThread(
  id: string
): Promise<{ success: boolean; lockedNotesCount: number }> {
  const api = await getApi()
  const response = await api.delete(`/threads/${id}`)
  return response.data
}

// Notes
export interface NotesResponse {
  notes: Note[]
  hasMore: boolean
}

export async function getNotes(
  threadId: string,
  params?: { before?: string; after?: string; limit?: number }
): Promise<NotesResponse> {
  const api = await getApi()
  const response = await api.get(`/threads/${threadId}/notes`, { params })
  return response.data
}

export async function sendNote(
  threadId: string,
  data: { content?: string; type: NoteType }
): Promise<Note> {
  const api = await getApi()
  const response = await api.post(`/threads/${threadId}/notes`, data)
  return response.data.note
}

export async function updateNote(
  threadId: string,
  noteId: string,
  data: { content: string }
): Promise<Note> {
  const api = await getApi()
  const response = await api.put(`/threads/${threadId}/notes/${noteId}`, data)
  return response.data.note
}

export async function deleteNote(threadId: string, noteId: string): Promise<void> {
  const api = await getApi()
  await api.delete(`/threads/${threadId}/notes/${noteId}`)
}

export async function lockNote(
  threadId: string,
  noteId: string,
  isLocked: boolean
): Promise<Note> {
  const api = await getApi()
  const response = await api.put(`/threads/${threadId}/notes/${noteId}/lock`, {
    isLocked,
  })
  return response.data.note
}

export async function starNote(
  threadId: string,
  noteId: string,
  isStarred: boolean
): Promise<Note> {
  const api = await getApi()
  const response = await api.put(`/threads/${threadId}/notes/${noteId}/star`, {
    isStarred,
  })
  return response.data.note
}

export async function setNoteTask(
  threadId: string,
  noteId: string,
  data: { isTask: boolean; reminderAt?: string; isCompleted?: boolean }
): Promise<Note> {
  const api = await getApi()
  const response = await api.put(`/threads/${threadId}/notes/${noteId}/task`, data)
  return response.data.note
}

export async function completeTask(threadId: string, noteId: string): Promise<Note> {
  const api = await getApi()
  const response = await api.put(`/threads/${threadId}/notes/${noteId}/task/complete`)
  return response.data.note
}

// Tasks
export interface TasksResponse {
  tasks: Note[]
  total: number
}

export async function getTasks(params?: {
  filter?: 'pending' | 'completed' | 'overdue'
  threadId?: string
  page?: number
  limit?: number
}): Promise<TasksResponse> {
  const api = await getApi()
  const response = await api.get('/tasks', { params })
  return response.data
}

export async function getUpcomingTasks(days?: number): Promise<{ tasks: Note[] }> {
  const api = await getApi()
  const response = await api.get('/tasks/upcoming', { params: { days } })
  return response.data
}

// Search
export interface SearchResponse {
  results: {
    threads: Thread[]
    notes: Note[]
  }
  total: number
}

export async function search(params: {
  q: string
  type?: 'all' | 'threads' | 'notes'
  page?: number
  limit?: number
}): Promise<SearchResponse> {
  const api = await getApi()
  const response = await api.get('/search', { params })
  return response.data
}

export async function searchInThread(
  threadId: string,
  params: { q: string; page?: number; limit?: number }
): Promise<{ notes: Note[]; total: number }> {
  const api = await getApi()
  const response = await api.get(`/search/thread/${threadId}`, { params })
  return response.data
}

// Export
export async function exportThread(
  threadId: string,
  format: 'txt' | 'json' = 'txt'
): Promise<string> {
  const api = await getApi()
  const response = await api.get(`/threads/${threadId}/export`, {
    params: { format },
    responseType: 'text',
  })
  return response.data
}
