import axios from 'axios'
import { useConnectionStore } from '../store/connectionStore'

export const apiClient = axios.create({ timeout: 30000 })

apiClient.interceptors.request.use((config) => {
  const { phoneUrl, token } = useConnectionStore.getState()
  if (phoneUrl) config.baseURL = phoneUrl
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      useConnectionStore.getState().disconnect('session_expired')
    }
    return Promise.reject(error)
  },
)
