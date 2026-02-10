import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  getHomeWallpaper,
  setHomeWallpaper as storeHomeWallpaper,
  getHomeWallpaperOverlay,
  setHomeWallpaperOverlay as storeHomeOverlay,
  getHomeWallpaperOpacity,
  setHomeWallpaperOpacity as storeHomeOpacity,
  getThreadWallpaper,
  setThreadWallpaper as storeThreadWallpaper,
  getThreadWallpaperOverlay,
  setThreadWallpaperOverlay as storeThreadOverlay,
  getThreadWallpaperOpacity,
  setThreadWallpaperOpacity as storeThreadOpacity,
  type WallpaperImage,
  type WallpaperOverlay,
} from '@/services/storage'

interface WallpaperContextValue {
  homeWallpaper: WallpaperImage
  homeOverlayColor: WallpaperOverlay
  homeOverlayOpacity: number
  threadWallpaper: WallpaperImage
  threadOverlayColor: WallpaperOverlay
  threadOverlayOpacity: number
  setHomeWallpaper: (v: WallpaperImage) => Promise<void>
  setHomeOverlayColor: (v: WallpaperOverlay) => Promise<void>
  setHomeOverlayOpacity: (v: number) => Promise<void>
  setThreadWallpaper: (v: WallpaperImage) => Promise<void>
  setThreadOverlayColor: (v: WallpaperOverlay) => Promise<void>
  setThreadOverlayOpacity: (v: number) => Promise<void>
}

const WallpaperContext = createContext<WallpaperContextValue | null>(null)

export function WallpaperProvider({ children }: { children: React.ReactNode }) {
  const [homeWallpaper, setHomeWallpaperState] = useState<WallpaperImage>(null)
  const [homeOverlayColor, setHomeOverlayState] = useState<WallpaperOverlay>('neutral')
  const [homeOverlayOpacity, setHomeOpacityState] = useState(70)
  const [threadWallpaper, setThreadWallpaperState] = useState<WallpaperImage>(null)
  const [threadOverlayColor, setThreadOverlayState] = useState<WallpaperOverlay>('neutral')
  const [threadOverlayOpacity, setThreadOpacityState] = useState(70)

  useEffect(() => {
    Promise.all([
      getHomeWallpaper(),
      getHomeWallpaperOverlay(),
      getHomeWallpaperOpacity(),
      getThreadWallpaper(),
      getThreadWallpaperOverlay(),
      getThreadWallpaperOpacity(),
    ]).then(([hw, hoc, hop, tw, toc, top]) => {
      setHomeWallpaperState(hw)
      setHomeOverlayState(hoc)
      setHomeOpacityState(hop)
      setThreadWallpaperState(tw)
      setThreadOverlayState(toc)
      setThreadOpacityState(top)
    })
  }, [])

  const setHomeWallpaper = useCallback(async (v: WallpaperImage) => {
    setHomeWallpaperState(v)
    await storeHomeWallpaper(v)
  }, [])

  const setHomeOverlayColor = useCallback(async (v: WallpaperOverlay) => {
    setHomeOverlayState(v)
    await storeHomeOverlay(v)
  }, [])

  const setHomeOverlayOpacity = useCallback(async (v: number) => {
    setHomeOpacityState(v)
    await storeHomeOpacity(v)
  }, [])

  const setThreadWallpaper = useCallback(async (v: WallpaperImage) => {
    setThreadWallpaperState(v)
    await storeThreadWallpaper(v)
  }, [])

  const setThreadOverlayColor = useCallback(async (v: WallpaperOverlay) => {
    setThreadOverlayState(v)
    await storeThreadOverlay(v)
  }, [])

  const setThreadOverlayOpacity = useCallback(async (v: number) => {
    setThreadOpacityState(v)
    await storeThreadOpacity(v)
  }, [])

  const value = useMemo<WallpaperContextValue>(
    () => ({
      homeWallpaper,
      homeOverlayColor,
      homeOverlayOpacity,
      threadWallpaper,
      threadOverlayColor,
      threadOverlayOpacity,
      setHomeWallpaper,
      setHomeOverlayColor,
      setHomeOverlayOpacity,
      setThreadWallpaper,
      setThreadOverlayColor,
      setThreadOverlayOpacity,
    }),
    [
      homeWallpaper,
      homeOverlayColor,
      homeOverlayOpacity,
      threadWallpaper,
      threadOverlayColor,
      threadOverlayOpacity,
      setHomeWallpaper,
      setHomeOverlayColor,
      setHomeOverlayOpacity,
      setThreadWallpaper,
      setThreadOverlayColor,
      setThreadOverlayOpacity,
    ]
  )

  return <WallpaperContext.Provider value={value}>{children}</WallpaperContext.Provider>
}

export function useWallpaper(): WallpaperContextValue {
  const ctx = useContext(WallpaperContext)
  if (!ctx) throw new Error('useWallpaper must be used within WallpaperProvider')
  return ctx
}
