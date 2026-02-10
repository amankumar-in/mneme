import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react'
import { useSharedValue, type SharedValue } from 'react-native-reanimated'

interface SwipeableRowContextValue {
  registerOpen: (rowId: string, closeFn: () => void) => void
  closeAll: () => void
  /** true when any row is swiped open — readable from worklets */
  isAnyOpen: SharedValue<boolean>
  /** true if closeAll() actually closed something (for back handler) */
  closeAllIfOpen: () => boolean
}

const SwipeableRowContext = createContext<SwipeableRowContextValue | null>(null)

export function useSwipeableRowController() {
  const openRowRef = useRef<{ id: string; close: () => void } | null>(null)
  const isAnyOpen = useSharedValue(false)

  const registerOpen = useCallback((rowId: string, closeFn: () => void) => {
    if (openRowRef.current && openRowRef.current.id !== rowId) {
      openRowRef.current.close()
    }
    openRowRef.current = { id: rowId, close: closeFn }
    isAnyOpen.value = true
  }, [])

  const closeAll = useCallback(() => {
    if (openRowRef.current) {
      openRowRef.current.close()
      openRowRef.current = null
    }
    isAnyOpen.value = false
  }, [])

  const closeAllIfOpen = useCallback(() => {
    if (openRowRef.current) {
      openRowRef.current.close()
      openRowRef.current = null
      isAnyOpen.value = false
      return true
    }
    return false
  }, [])

  return useMemo(() => ({ registerOpen, closeAll, isAnyOpen, closeAllIfOpen }), [registerOpen, closeAll, isAnyOpen, closeAllIfOpen])
}

export function SwipeableRowProvider({
  controller,
  children,
}: {
  controller: SwipeableRowContextValue
  children: React.ReactNode
}) {
  return (
    <SwipeableRowContext.Provider value={controller}>
      {children}
    </SwipeableRowContext.Provider>
  )
}

export function useSwipeableRow() {
  return useContext(SwipeableRowContext)
}
