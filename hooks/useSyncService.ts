import { useCallback, useEffect, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useDb } from '@/contexts/DatabaseContext'
import { getSyncService, type SyncService } from '@/services/sync/sync.service'

interface SyncServiceHook {
  sync: () => Promise<void>
  pull: () => Promise<void>
  push: () => Promise<void>
  schedulePush: () => void
}

/**
 * Hook to access and use the sync service
 */
export function useSyncService(): SyncServiceHook {
  const db = useDb()
  const queryClient = useQueryClient()
  const syncServiceRef = useRef<SyncService | null>(null)

  // Get or create sync service instance
  if (!syncServiceRef.current) {
    syncServiceRef.current = getSyncService(db)
  }

  const syncService = syncServiceRef.current

  const invalidateAllQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['threads'] })
    queryClient.invalidateQueries({ queryKey: ['notes'] })
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
    queryClient.invalidateQueries({ queryKey: ['user'] })
    queryClient.invalidateQueries({ queryKey: ['search'] })
  }, [queryClient])

  const sync = useCallback(async () => {
    await syncService.sync()
    invalidateAllQueries()
  }, [syncService, invalidateAllQueries])

  const pull = useCallback(async () => {
    await syncService.pull()
    invalidateAllQueries()
  }, [syncService, invalidateAllQueries])

  const push = useCallback(async () => {
    await syncService.push()
    invalidateAllQueries()
  }, [syncService])

  const schedulePush = useCallback(() => {
    syncService.schedulePush()
  }, [syncService])

  return { sync, pull, push, schedulePush }
}

/**
 * Hook to auto-sync when app comes to foreground
 * NOTE: Sync is blocked by the sync service if user has no identity set
 */
export function useAutoSync() {
  const { pull } = useSyncService()
  const appStateRef = useRef<AppStateStatus>(AppState.currentState)

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      // App came to foreground
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // Sync service will check identity internally
        pull().catch((error) => {
          if (error?.message === 'AUTH_CLEARED') return
          console.log('[AutoSync] Pull failed (offline?):', error.message)
        })
      }

      appStateRef.current = nextAppState
    })

    // Initial pull on mount (sync service will check identity internally)
    pull().catch((error) => {
      // AUTH_CLEARED means token was invalid and cleared - this is handled silently
      if (error?.message === 'AUTH_CLEARED') return
      console.log('[AutoSync] Initial pull failed (offline?):', error.message)
    })

    return () => {
      subscription.remove()
    }
  }, [pull])
}
