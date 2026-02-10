import React from 'react'
import { ImageBackground, StyleSheet, View } from 'react-native'
import { YStack } from 'tamagui'
import { useWallpaper } from '../contexts/WallpaperContext'
import { useAppTheme } from '../contexts/ThemeContext'
import { WALLPAPERS, resolveOverlayHex } from '../constants/wallpapers'

interface ScreenBackgroundProps {
  children: React.ReactNode
  type?: 'home' | 'thread'
}

export function ScreenBackground({ children, type = 'home' }: ScreenBackgroundProps) {
  const {
    homeWallpaper, homeOverlayColor, homeOverlayOpacity,
    threadWallpaper, threadOverlayColor, threadOverlayOpacity,
  } = useWallpaper()
  const { resolvedTheme } = useAppTheme()
  const isDark = resolvedTheme === 'dark'

  const wallpaper = type === 'home' ? homeWallpaper : threadWallpaper
  const overlayKey = type === 'home' ? homeOverlayColor : threadOverlayColor
  const overlayOpacity = type === 'home' ? homeOverlayOpacity : threadOverlayOpacity
  const overlayHex = resolveOverlayHex(overlayKey, isDark)

  return (
    <YStack flex={1} backgroundColor={wallpaper ? 'transparent' : '$background'}>
      {wallpaper && (
        <ImageBackground
          source={WALLPAPERS[wallpaper]}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        >
          {overlayHex && (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: overlayHex, opacity: overlayOpacity / 100 },
              ]}
            />
          )}
        </ImageBackground>
      )}
      {children}
    </YStack>
  )
}
