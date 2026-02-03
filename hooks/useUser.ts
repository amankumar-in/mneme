import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDb } from '@/contexts/DatabaseContext'
import { getUserRepository } from '@/services/repositories'
import { getDeviceId, clearAll, getAuthToken, clearAuthToken } from '@/services/storage'
import { deleteAccount as deleteAccountApi, resetApiInstance, logout as logoutApi } from '@/services/api'
import { resetSyncService } from '@/services/sync/sync.service'
import type { UserProfile } from '@/services/database/types'

/**
 * Get current user from LOCAL database only
 * No server calls - app works fully offline
 */
export function useUser() {
  const db = useDb()
  const userRepo = getUserRepository(db)

  return useQuery({
    queryKey: ['user'],
    queryFn: () => userRepo.get(),
  })
}

/**
 * Initialize local user on app start
 * Creates a local-only user in SQLite if none exists
 * NO SERVER CALLS - device ID is local-only
 */
export function useInitializeLocalUser() {
  const db = useDb()
  const userRepo = getUserRepository(db)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const deviceId = await getDeviceId()

      // Check if user already exists locally
      let user = await userRepo.getByDeviceId(deviceId)
      const isNew = !user

      if (!user) {
        // Create new local user - NO SERVER CALL
        user = await userRepo.upsert({
          deviceId,
          name: 'Me',
        })
      }

      return { user, isNew }
    },
    onSuccess: async (data) => {
      queryClient.setQueryData(['user'], data.user)
      // NOTE: No sync here - sync only happens after identity is set
    },
  })
}

/**
 * Check if user is authenticated (has valid token)
 */
export function useIsAuthenticated() {
  return useQuery({
    queryKey: ['isAuthenticated'],
    queryFn: async () => {
      const token = await getAuthToken()
      return !!token
    },
  })
}

/**
 * Update user profile (local only until authenticated)
 */
export function useUpdateUser() {
  const db = useDb()
  const userRepo = getUserRepository(db)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<UserProfile>) =>
      userRepo.update({
        name: data.name,
        username: data.username,
        email: data.email,
        phone: data.phone,
        avatar: data.avatar,
        settings: data.settings,
      }),
    onSuccess: (user) => {
      queryClient.setQueryData(['user'], user)
      queryClient.invalidateQueries({ queryKey: ['user'] })
      // NOTE: Sync push is handled separately - only when authenticated
    },
  })
}

/**
 * Logout - clear auth token but keep local data
 */
export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await logoutApi()
      resetSyncService()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['isAuthenticated'] })
    },
  })
}

/**
 * Delete account - clears everything (local + remote if authenticated)
 */
export function useDeleteAccount() {
  const db = useDb()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      // Try to delete from server if authenticated
      const token = await getAuthToken()
      if (token) {
        try {
          await deleteAccountApi()
        } catch (error: any) {
          // If server fails, still proceed with local deletion
          console.warn('[DeleteAccount] Server deletion failed:', error.message)
        }
      }

      // Delete ALL local SQLite data
      await db.runAsync('DELETE FROM messages')
      await db.runAsync('DELETE FROM chats')
      await db.runAsync('DELETE FROM user')
      await db.runAsync('UPDATE sync_meta SET last_sync_timestamp = NULL, is_syncing = 0')

      // Clear AsyncStorage (device ID, cached user, auth token)
      await clearAll()

      // Reset cached API instances
      resetApiInstance()
      resetSyncService()
    },
    onSuccess: () => {
      queryClient.clear()
    },
  })
}

// Keep old name as alias for backwards compatibility
export const useRegisterDevice = useInitializeLocalUser
