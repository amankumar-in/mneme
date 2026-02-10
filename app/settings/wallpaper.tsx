import { useCallback, useEffect, useRef, useState } from 'react'
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, View, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native'
import { YStack, XStack, Text, Button } from 'tamagui'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'

import { useThemeColor } from '../../hooks/useThemeColor'
import { useWallpaper } from '../../contexts/WallpaperContext'
import { useAppTheme } from '../../contexts/ThemeContext'
import { WALLPAPERS, WALLPAPER_COUNT, OVERLAY_COLOR_OPTIONS, getOverlaySwatchColor, resolveOverlayHex } from '../../constants/wallpapers'
import type { WallpaperImage, WallpaperOverlay } from '../../services/storage'

type Tab = 'home' | 'threads'

// Opacity ruler dial constants — range 30-90, labeled 1-7 for simplicity
const OPACITY_STEPS = [30, 40, 50, 60, 70, 80, 90] as const
const OP_STEP_COUNT = OPACITY_STEPS.length
const OP_MINOR_PER_INTERVAL = 3
const OP_TICKS_PER_INTERVAL = OP_MINOR_PER_INTERVAL + 1
const OP_TOTAL_TICKS = (OP_STEP_COUNT - 1) * OP_TICKS_PER_INTERVAL + 1
const OP_TICK_SPACING = 16
const OP_RULER_WIDTH = (OP_TOTAL_TICKS - 1) * OP_TICK_SPACING
const OP_DIAL_VISIBLE = 160
const OP_DIAL_HALF = OP_DIAL_VISIBLE / 2
const OP_DIAL_HEIGHT = 30
const OP_MAJOR_OFFSETS = OPACITY_STEPS.map((_, i) => i * OP_TICKS_PER_INTERVAL * OP_TICK_SPACING)
const OP_STOP_LABELS = OPACITY_STEPS.map((_, i) => String(i + 1))

function OpacityRuler({ value, onChange, accentColor }: { value: number; onChange: (v: number) => void; accentColor: string }) {
  const scrollRef = useRef<ScrollView>(null)
  const selectedIndex = OPACITY_STEPS.indexOf(value as (typeof OPACITY_STEPS)[number])
  const lastMajorRef = useRef(selectedIndex >= 0 ? selectedIndex : 2)

  useEffect(() => {
    const idx = selectedIndex >= 0 ? selectedIndex : 2
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: OP_MAJOR_OFFSETS[idx], animated: false })
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  const getNearestMajor = (scrollX: number) => {
    let nearest = 0
    let minDist = Infinity
    for (let i = 0; i < OP_MAJOR_OFFSETS.length; i++) {
      const dist = Math.abs(scrollX - OP_MAJOR_OFFSETS[i])
      if (dist < minDist) {
        minDist = dist
        nearest = i
      }
    }
    return nearest
  }

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x
    const nearest = getNearestMajor(x)
    if (nearest !== lastMajorRef.current) {
      lastMajorRef.current = nearest
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
  }, [])

  const handleScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x
    const nearest = getNearestMajor(x)
    lastMajorRef.current = nearest
    onChange(OPACITY_STEPS[nearest])
  }, [onChange])

  return (
    <XStack
      paddingHorizontal="$4"
      paddingVertical="$3"
      gap="$3"
      alignItems="center"
    >
      <XStack
        width={36}
        height={36}
        borderRadius="$2"
        backgroundColor="$backgroundStrong"
        alignItems="center"
        justifyContent="center"
      >
        <Ionicons name="contrast-outline" size={20} color={accentColor} />
      </XStack>

      <YStack flex={1} gap="$0.5">
        <Text fontSize="$4" color="$color">
          Overlay opacity
        </Text>
        <Text fontSize="$2" color="$colorSubtle">
          Level {OPACITY_STEPS.indexOf(value as (typeof OPACITY_STEPS)[number]) + 1}
        </Text>
      </YStack>

      <View style={{ width: OP_DIAL_VISIBLE, height: OP_DIAL_HEIGHT, overflow: 'hidden' }}>
        <View
          style={{
            position: 'absolute',
            left: OP_DIAL_HALF - 4,
            bottom: 0,
            zIndex: 2,
            width: 0,
            height: 0,
            borderLeftWidth: 4,
            borderRightWidth: 4,
            borderBottomWidth: 5,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: accentColor,
          }}
        />

        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToOffsets={OP_MAJOR_OFFSETS}
          decelerationRate="fast"
          onScroll={handleScroll}
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={handleScrollEnd}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingHorizontal: OP_DIAL_HALF }}
        >
          <View style={{ width: OP_RULER_WIDTH, height: OP_DIAL_HEIGHT }}>
            {Array.from({ length: OP_TOTAL_TICKS }, (_, i) => {
              const isMajor = i % OP_TICKS_PER_INTERVAL === 0
              const majorIndex = i / OP_TICKS_PER_INTERVAL

              if (isMajor) {
                return (
                  <View
                    key={i}
                    style={{
                      position: 'absolute',
                      left: i * OP_TICK_SPACING,
                      top: 0,
                      height: OP_DIAL_HEIGHT,
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: [{ translateX: -12 }],
                      width: 24,
                    }}
                  >
                    <Text
                      fontSize={10}
                      fontWeight="600"
                      color="$color"
                      textAlign="center"
                    >
                      {OP_STOP_LABELS[majorIndex]}
                    </Text>
                  </View>
                )
              }

              return (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    left: i * OP_TICK_SPACING,
                    top: (OP_DIAL_HEIGHT - 10) / 2,
                    width: 1.5,
                    height: 10,
                    backgroundColor: accentColor,
                    opacity: 0.35,
                    borderRadius: 1,
                  }}
                />
              )
            })}
          </View>
        </ScrollView>
      </View>
    </XStack>
  )
}

export default function WallpaperScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { iconColorStrong, accentColor, iconColor, background } = useThemeColor()
  const { resolvedTheme } = useAppTheme()
  const isDark = resolvedTheme === 'dark'
  const [activeTab, setActiveTab] = useState<Tab>('home')

  const {
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
  } = useWallpaper()

  const currentWallpaper = activeTab === 'home' ? homeWallpaper : threadWallpaper
  const currentOverlay = activeTab === 'home' ? homeOverlayColor : threadOverlayColor
  const currentOpacity = activeTab === 'home' ? homeOverlayOpacity : threadOverlayOpacity
  const liveOverlayHex = resolveOverlayHex(currentOverlay, isDark)

  const handleWallpaperSelect = useCallback(
    (value: WallpaperImage) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      if (activeTab === 'home') {
        setHomeWallpaper(value)
      } else {
        setThreadWallpaper(value)
      }
    },
    [activeTab, setHomeWallpaper, setThreadWallpaper]
  )

  const handleOverlaySelect = useCallback(
    (value: WallpaperOverlay) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      if (activeTab === 'home') {
        setHomeOverlayColor(value)
      } else {
        setThreadOverlayColor(value)
      }
    },
    [activeTab, setHomeOverlayColor, setThreadOverlayColor]
  )

  const handleOpacityChange = useCallback(
    (value: number) => {
      if (activeTab === 'home') {
        setHomeOverlayOpacity(value)
      } else {
        setThreadOverlayOpacity(value)
      }
    },
    [activeTab, setHomeOverlayOpacity, setThreadOverlayOpacity]
  )

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  return (
    <YStack flex={1} backgroundColor={currentWallpaper ? 'transparent' : '$background'}>
      {currentWallpaper && (
        <ImageBackground
          source={WALLPAPERS[currentWallpaper]}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        >
          {liveOverlayHex && (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: liveOverlayHex, opacity: currentOpacity / 100 },
              ]}
            />
          )}
        </ImageBackground>
      )}
      {/* Header */}
      <XStack
        paddingTop={insets.top + 8}
        paddingHorizontal="$4"
        paddingBottom="$2"
        alignItems="center"
        gap="$2"
        borderBottomWidth={StyleSheet.hairlineWidth}
        borderBottomColor="rgba(128,128,128,0.2)"
      >
        <Button
          size="$3"
          circular
          chromeless
          onPress={handleBack}
          icon={<Ionicons name="arrow-back" size={24} color={iconColorStrong} />}
        />
        <Text fontSize="$6" fontWeight="700" flex={1} color="$color">
          Wallpaper
        </Text>
      </XStack>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {/* Tab bar */}
        <XStack paddingHorizontal="$4" paddingTop="$4" paddingBottom="$2" justifyContent="center">
          <XStack
            backgroundColor="$backgroundStrong"
            borderRadius="$4"
            borderWidth={1}
            borderColor="$borderColor"
            padding="$1"
            gap="$1"
          >
            {(['home', 'threads'] as Tab[]).map((tab) => {
              const selected = activeTab === tab
              return (
                <Pressable
                  key={tab}
                  onPress={() => {
                    if (tab !== activeTab) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      setActiveTab(tab)
                    }
                  }}
                  style={{
                    backgroundColor: selected ? accentColor : 'transparent',
                    paddingHorizontal: 20,
                    paddingVertical: 8,
                    borderRadius: 6,
                  }}
                >
                  <Text
                    fontSize="$3"
                    fontWeight={selected ? '600' : '400'}
                    color={selected ? background : '$colorSubtle'}
                  >
                    {tab === 'home' ? 'Home & UI' : 'Threads'}
                  </Text>
                </Pressable>
              )
            })}
          </XStack>
        </XStack>

        {/* Image Picker */}
        <YStack paddingHorizontal="$4" paddingVertical="$3" gap="$3">
          <XStack gap="$3" alignItems="center">
            <XStack
              width={36}
              height={36}
              borderRadius="$2"
              backgroundColor="$backgroundStrong"
              alignItems="center"
              justifyContent="center"
            >
              <Ionicons name="image-outline" size={20} color={accentColor} />
            </XStack>
            <Text fontSize="$4" color="$color">
              Background image
            </Text>
          </XStack>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {/* None option */}
            <Pressable
              onPress={() => handleWallpaperSelect(null)}
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
              <YStack
                width={60}
                height={100}
                borderRadius="$3"
                borderWidth={2}
                borderColor={currentWallpaper === null ? accentColor : '$borderColor'}
                backgroundColor="$backgroundStrong"
                alignItems="center"
                justifyContent="center"
              >
                <Ionicons name="close" size={24} color={iconColor} />
                <Text fontSize={10} color="$colorSubtle" marginTop="$1">
                  None
                </Text>
              </YStack>
            </Pressable>

            {/* Wallpaper thumbnails */}
            {Array.from({ length: WALLPAPER_COUNT }, (_, i) => i + 1).map((num) => {
              const selected = currentWallpaper === num
              return (
                <Pressable
                  key={num}
                  onPress={() => handleWallpaperSelect(num)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                >
                  <YStack
                    width={60}
                    height={100}
                    borderRadius="$3"
                    borderWidth={2}
                    borderColor={selected ? accentColor : '$borderColor'}
                    overflow="hidden"
                  >
                    <Image
                      source={WALLPAPERS[num]}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                  </YStack>
                </Pressable>
              )
            })}
          </ScrollView>
        </YStack>

        {/* Overlay Color */}
        <YStack paddingHorizontal="$4" paddingVertical="$3" gap="$3">
          <XStack gap="$3" alignItems="center">
            <XStack
              width={36}
              height={36}
              borderRadius="$2"
              backgroundColor="$backgroundStrong"
              alignItems="center"
              justifyContent="center"
            >
              <Ionicons name="color-palette-outline" size={20} color={accentColor} />
            </XStack>
            <Text fontSize="$4" color="$color">
              Overlay color
            </Text>
          </XStack>

          <XStack gap={12} flexWrap="wrap">
            {OVERLAY_COLOR_OPTIONS.map((color) => {
              const selected = currentOverlay === color.key
              const isNone = color.key === null
              const swatchHex = getOverlaySwatchColor(color.key, isDark)
              return (
                <Pressable
                  key={color.label}
                  onPress={() => handleOverlaySelect(color.key)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: isNone ? 'transparent' : swatchHex!,
                      borderWidth: selected ? 3 : 1,
                      borderColor: selected ? accentColor : isNone ? iconColor : 'rgba(128,128,128,0.35)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isNone && (
                      <View
                        style={{
                          width: 30,
                          height: 1.5,
                          backgroundColor: iconColor,
                          transform: [{ rotate: '45deg' }],
                        }}
                      />
                    )}
                  </View>
                </Pressable>
              )
            })}
          </XStack>
        </YStack>

        {/* Overlay Opacity */}
        {currentOverlay !== null && (
          <OpacityRuler
            value={currentOpacity}
            onChange={handleOpacityChange}
            accentColor={accentColor}
          />
        )}
      </ScrollView>
    </YStack>
  )
}
