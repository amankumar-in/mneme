import { useCallback, useEffect, useRef } from 'react'
import { ScrollView, View, Pressable, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native'
import { YStack, XStack, Text, Button } from 'tamagui'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Leaf } from 'lucide-react-native'
import { ScreenBackground } from '../../components/ScreenBackground'
import { useThemeColor } from '../../hooks/useThemeColor'
import { useAppTheme } from '../../contexts/ThemeContext'
import { useNoteFontScale } from '../../contexts/FontScaleContext'
import { useNoteViewStyle } from '../../contexts/NoteViewContext'
import { useAppFont } from '../../contexts/FontFamilyContext'
import { useThreadViewStyle } from '../../contexts/ThreadViewContext'
import { useMinimalMode } from '../../contexts/MinimalModeContext'
import { useLinkPreviewMode } from '../../contexts/LinkPreviewContext'
import { FONT_SCALE_STEPS, type FontScale, type NoteViewStyle, type AppFont, type ThreadViewStyle, type LinkPreviewMode } from '../../services/storage'
import { useUser, useUpdateUser } from '../../hooks/useUser'

const MOCKUP_HEIGHT = 150
const MOCKUP_WIDTH = 88

const lightBg = '#f2f2f7'
const lightBorder = '#c6c6c8'
const darkBg = '#1c1c1e'
const darkBorder = '#38383a'

function HomeMockup({ variant }: { variant: 'light' | 'dark' | 'auto' }) {
  if (variant === 'auto') {
    return (
      <XStack width={MOCKUP_WIDTH} height={MOCKUP_HEIGHT}>
        <View
          style={{
            flex: 1,
            backgroundColor: lightBg,
            borderTopLeftRadius: 8,
            borderBottomLeftRadius: 8,
            overflow: 'hidden',
            padding: 4,
          }}
        >
          <View style={{ height: 10, backgroundColor: lightBorder, borderRadius: 3, marginBottom: 3 }} />
          <View style={{ height: 14, backgroundColor: lightBorder, borderRadius: 6, marginBottom: 3, opacity: 0.7 }} />
          <XStack gap={2} marginBottom={2}>
            <View style={{ width: 20, height: 10, backgroundColor: lightBorder, borderRadius: 5, opacity: 0.8 }} />
            <View
              style={{
                width: 16,
                height: 10,
                backgroundColor: 'transparent',
                borderRadius: 5,
                borderWidth: 1,
                borderColor: lightBorder,
              }}
            />
          </XStack>
          <View style={{ height: 8, backgroundColor: lightBorder, borderRadius: 2, opacity: 0.5, marginTop: 2 }} />
          <View style={{ height: 8, backgroundColor: lightBorder, borderRadius: 2, opacity: 0.4, marginTop: 1 }} />
        </View>
        <View
          style={{
            flex: 1,
            backgroundColor: darkBg,
            borderTopRightRadius: 8,
            borderBottomRightRadius: 8,
            overflow: 'hidden',
            padding: 4,
          }}
        >
          <View style={{ height: 10, backgroundColor: darkBorder, borderRadius: 3, marginBottom: 3 }} />
          <View style={{ height: 14, backgroundColor: darkBorder, borderRadius: 6, marginBottom: 3, opacity: 0.7 }} />
          <XStack gap={2} marginBottom={2}>
            <View style={{ width: 20, height: 10, backgroundColor: darkBorder, borderRadius: 5, opacity: 0.8 }} />
            <View
              style={{
                width: 16,
                height: 10,
                backgroundColor: 'transparent',
                borderRadius: 5,
                borderWidth: 1,
                borderColor: darkBorder,
              }}
            />
          </XStack>
          <View style={{ height: 8, backgroundColor: darkBorder, borderRadius: 2, opacity: 0.5, marginTop: 2 }} />
          <View style={{ height: 8, backgroundColor: darkBorder, borderRadius: 2, opacity: 0.4, marginTop: 1 }} />
        </View>
      </XStack>
    )
  }

  const isLight = variant === 'light'
  const bg = isLight ? lightBg : darkBg
  const bar = isLight ? lightBorder : darkBorder

  return (
    <View
      style={{
        width: MOCKUP_WIDTH,
        height: MOCKUP_HEIGHT,
        backgroundColor: bg,
        borderRadius: 8,
        padding: 4,
        overflow: 'hidden',
      }}
    >
      <View style={{ height: 10, backgroundColor: bar, borderRadius: 3, marginBottom: 3 }} />
      <View style={{ height: 14, backgroundColor: bar, borderRadius: 6, marginBottom: 3, opacity: 0.7 }} />
      <XStack gap={2} marginBottom={2}>
        <View style={{ width: 20, height: 10, backgroundColor: bar, borderRadius: 5, opacity: 0.8 }} />
        <View
          style={{ width: 16, height: 10, backgroundColor: 'transparent', borderRadius: 5, borderWidth: 1, borderColor: bar }}
        />
      </XStack>
      <View style={{ height: 8, backgroundColor: bar, borderRadius: 2, opacity: 0.5, marginTop: 2 }} />
      <View style={{ height: 8, backgroundColor: bar, borderRadius: 2, opacity: 0.4, marginTop: 1 }} />
    </View>
  )
}

// Ruler dial constants
const STEP_COUNT = FONT_SCALE_STEPS.length
const MINOR_PER_INTERVAL = 3
const TICKS_PER_INTERVAL = MINOR_PER_INTERVAL + 1
const TOTAL_TICKS = (STEP_COUNT - 1) * TICKS_PER_INTERVAL + 1
const TICK_SPACING = 16
const RULER_WIDTH = (TOTAL_TICKS - 1) * TICK_SPACING
const DIAL_VISIBLE = 160
const DIAL_HALF = DIAL_VISIBLE / 2
const DIAL_HEIGHT = 30
const MAJOR_OFFSETS = FONT_SCALE_STEPS.map((_, i) => i * TICKS_PER_INTERVAL * TICK_SPACING)
const STOP_LABELS = ['1', '2', '3', '4', '5']
const SCALE_LABELS = ['Smallest', 'Small', 'Default', 'Large', 'Largest']

function FontScaleSelector() {
  const { fontScale, setFontScale } = useNoteFontScale()
  const { accentColor } = useThemeColor()
  const scrollRef = useRef<ScrollView>(null)
  const selectedIndex = FONT_SCALE_STEPS.indexOf(fontScale)
  const lastMajorRef = useRef(selectedIndex)

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: MAJOR_OFFSETS[selectedIndex], animated: false })
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  const getNearestMajor = (scrollX: number) => {
    let nearest = 0
    let minDist = Infinity
    for (let i = 0; i < MAJOR_OFFSETS.length; i++) {
      const dist = Math.abs(scrollX - MAJOR_OFFSETS[i])
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
    setFontScale(FONT_SCALE_STEPS[nearest])
  }, [setFontScale])

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
        <Ionicons name="text" size={20} color={accentColor} />
      </XStack>

      <YStack flex={1} gap="$0.5">
        <Text fontSize="$4" color="$color">
          Notes font size
        </Text>
        <Text fontSize="$2" color="$colorSubtle">
          {SCALE_LABELS[selectedIndex]}
        </Text>
      </YStack>

      {/* Scrollable ruler dial */}
      <View style={{ width: DIAL_VISIBLE, height: DIAL_HEIGHT, overflow: 'hidden' }}>
        {/* Triangle below active stop */}
        <View
          style={{
            position: 'absolute',
            left: DIAL_HALF - 4,
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
          snapToOffsets={MAJOR_OFFSETS}
          decelerationRate="fast"
          onScroll={handleScroll}
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={handleScrollEnd}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingHorizontal: DIAL_HALF }}
        >
          <View style={{ width: RULER_WIDTH, height: DIAL_HEIGHT }}>
            {Array.from({ length: TOTAL_TICKS }, (_, i) => {
              const isMajor = i % TICKS_PER_INTERVAL === 0
              const majorIndex = i / TICKS_PER_INTERVAL

              if (isMajor) {
                return (
                  <View
                    key={i}
                    style={{
                      position: 'absolute',
                      left: i * TICK_SPACING,
                      top: 0,
                      height: DIAL_HEIGHT,
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: [{ translateX: -8 }],
                      width: 16,
                    }}
                  >
                    <Text
                      fontSize={12}
                      fontWeight="600"
                      color="$color"
                      textAlign="center"
                    >
                      {STOP_LABELS[majorIndex]}
                    </Text>
                  </View>
                )
              }

              return (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    left: i * TICK_SPACING,
                    top: (DIAL_HEIGHT - 10) / 2,
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

const FONT_OPTIONS: { value: AppFont; label: string; preview: string }[] = [
  { value: 'inter', label: 'Inter', preview: 'Inter' },
  { value: 'lora', label: 'Lora', preview: 'Lora' },
  { value: 'jetbrains-mono', label: 'JetBrains Mono', preview: 'JetBrainsMono' },
  { value: 'poppins', label: 'Poppins', preview: 'Poppins' },
  { value: 'nunito', label: 'Nunito', preview: 'Nunito' },
]

const FONT_CARD_WIDTH = 100
const FONT_CARD_GAP = 10

function FontFamilySelector() {
  const { fontFamily, setFontFamily } = useAppFont()
  const { accentColor } = useThemeColor()
  const fontScrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    const selectedIndex = FONT_OPTIONS.findIndex((f) => f.value === fontFamily)
    if (selectedIndex > 0) {
      const timer = setTimeout(() => {
        fontScrollRef.current?.scrollTo({
          x: selectedIndex * (FONT_CARD_WIDTH + FONT_CARD_GAP),
          animated: false,
        })
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [])

  return (
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
          <Ionicons name="language-outline" size={20} color={accentColor} />
        </XStack>

        <YStack flex={1} gap="$0.5">
          <Text fontSize="$4" color="$color">
            Font style
          </Text>
          <Text fontSize="$2" color="$colorSubtle">
            May restart app to apply
          </Text>
        </YStack>
      </XStack>

      <ScrollView ref={fontScrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: FONT_CARD_GAP }}>
        {FONT_OPTIONS.map((opt) => {
          const selected = fontFamily === opt.value
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                if (opt.value !== fontFamily) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setFontFamily(opt.value)
                }
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
              <YStack
                width={100}
                height={64}
                borderRadius="$3"
                borderWidth={2}
                borderColor={selected ? accentColor : '$borderColor'}
                backgroundColor={selected ? '$brandBackground' : '$backgroundStrong'}
                alignItems="center"
                justifyContent="center"
                gap="$1"
              >
                <Text
                  fontSize={16}
                  fontFamily={opt.preview}
                  fontWeight="600"
                  color={selected ? '$color' : '$colorSubtle'}
                >
                  Aa
                </Text>
                <Text
                  fontSize={10}
                  fontFamily={opt.preview}
                  color={selected ? '$color' : '$colorSubtle'}
                >
                  {opt.label}
                </Text>
              </YStack>
              {selected && (
                <XStack justifyContent="center" marginTop="$1">
                  <Ionicons name="checkmark-circle" size={14} color={accentColor} />
                </XStack>
              )}
            </Pressable>
          )
        })}
      </ScrollView>
    </YStack>
  )
}

const VIEW_OPTIONS: { value: NoteViewStyle; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'bubble', label: 'Bubble', icon: 'chatbubble' },
  { value: 'paper', label: 'Paper', icon: 'document-text' },
]

function NoteViewSelector() {
  const { noteViewStyle, setViewStyle } = useNoteViewStyle()
  const { accentColor, iconColor, background } = useThemeColor()

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
        <Ionicons name="newspaper-outline" size={20} color={accentColor} />
      </XStack>

      <YStack flex={1} gap="$0.5">
        <Text fontSize="$4" color="$color">
          Note view
        </Text>
        <Text fontSize="$2" color="$colorSubtle">
          {noteViewStyle === 'bubble' ? 'Chat-style bubbles' : 'Clean full-width cards'}
        </Text>
      </YStack>

      <XStack
        backgroundColor="$backgroundStrong"
        borderRadius="$4"
        borderWidth={1}
        borderColor="$borderColor"
        padding="$1"
        gap="$1"
      >
        {VIEW_OPTIONS.map((opt) => {
          const selected = noteViewStyle === opt.value
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                if (opt.value !== noteViewStyle) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setViewStyle(opt.value)
                }
              }}
              style={{
                backgroundColor: selected ? accentColor : 'transparent',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Ionicons
                name={opt.icon}
                size={14}
                color={selected ? background : iconColor}
              />
              <Text
                fontSize="$2"
                fontWeight={selected ? '600' : '400'}
                color={selected ? background : '$colorSubtle'}
              >
                {opt.label}
              </Text>
            </Pressable>
          )
        })}
      </XStack>
    </XStack>
  )
}

const THREAD_VIEW_OPTIONS: { value: ThreadViewStyle; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'list', label: 'List', icon: 'list' },
  { value: 'icons', label: 'Icons', icon: 'grid-outline' },
]

function ThreadViewSelector() {
  const { threadViewStyle, setViewStyle } = useThreadViewStyle()
  const { accentColor, iconColor, background } = useThemeColor()

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
        <Ionicons name="albums-outline" size={20} color={accentColor} />
      </XStack>

      <YStack flex={1} gap="$0.5">
        <Text fontSize="$4" color="$color">
          Thread view
        </Text>
        <Text fontSize="$2" color="$colorSubtle">
          {threadViewStyle === 'list' ? 'Scrollable list' : 'Icon grid'}
        </Text>
      </YStack>

      <XStack
        backgroundColor="$backgroundStrong"
        borderRadius="$4"
        borderWidth={1}
        borderColor="$borderColor"
        padding="$1"
        gap="$1"
      >
        {THREAD_VIEW_OPTIONS.map((opt) => {
          const selected = threadViewStyle === opt.value
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                if (opt.value !== threadViewStyle) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setViewStyle(opt.value)
                }
              }}
              style={{
                backgroundColor: selected ? accentColor : 'transparent',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Ionicons
                name={opt.icon}
                size={14}
                color={selected ? background : iconColor}
              />
              <Text
                fontSize="$2"
                fontWeight={selected ? '600' : '400'}
                color={selected ? background : '$colorSubtle'}
              >
                {opt.label}
              </Text>
            </Pressable>
          )
        })}
      </XStack>
    </XStack>
  )
}

function MinimalModeSelector() {
  const { isMinimalMode, enableMinimalMode, disableMinimalMode } = useMinimalMode()
  const { accentColor, iconColor, background } = useThemeColor()

  const handleToggle = useCallback(async (enabled: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (enabled) {
      await enableMinimalMode()
    } else {
      await disableMinimalMode()
    }
  }, [enableMinimalMode, disableMinimalMode])

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
        <Leaf size={20} color={accentColor} />
      </XStack>

      <YStack flex={1} gap="$0.5">
        <Text fontSize="$4" color="$color">
          Minimal mode
        </Text>
        <Text fontSize="$2" color="$colorSubtle">
          {isMinimalMode ? 'On' : 'Quick capture on home screen'}
        </Text>
      </YStack>

      <XStack
        backgroundColor="$backgroundStrong"
        borderRadius="$4"
        borderWidth={1}
        borderColor="$borderColor"
        padding="$1"
        gap="$1"
      >
        {[
          { value: false, label: 'Off' },
          { value: true, label: 'On' },
        ].map((opt) => {
          const selected = isMinimalMode === opt.value
          return (
            <Pressable
              key={String(opt.value)}
              onPress={() => {
                if (isMinimalMode !== opt.value) handleToggle(opt.value)
              }}
              style={{
                backgroundColor: selected ? accentColor : 'transparent',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Text
                fontSize="$2"
                fontWeight={selected ? '600' : '400'}
                color={selected ? background : '$colorSubtle'}
              >
                {opt.label}
              </Text>
            </Pressable>
          )
        })}
      </XStack>
    </XStack>
  )
}

const LINK_PREVIEW_OPTIONS: { value: LinkPreviewMode; label: string }[] = [
  { value: 'text+image', label: 'Text & Image' },
  { value: 'text', label: 'Text' },
  { value: 'off', label: 'Off' },
]

function LinkPreviewSelector() {
  const { linkPreviewMode, setLinkPreviewMode } = useLinkPreviewMode()
  const { accentColor, iconColor, background } = useThemeColor()

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
        <Ionicons name="link-outline" size={20} color={accentColor} />
      </XStack>

      <YStack flex={1} gap="$0.5">
        <Text fontSize="$4" color="$color">
          URL Previews
        </Text>
        <Text fontSize="$2" color="$colorSubtle">
          {linkPreviewMode === 'off' ? 'Disabled' : linkPreviewMode === 'text' ? 'Title & description only' : 'Full preview with image'}
        </Text>
      </YStack>

      <XStack
        backgroundColor="$backgroundStrong"
        borderRadius="$4"
        borderWidth={1}
        borderColor="$borderColor"
        padding="$1"
        gap="$1"
      >
        {LINK_PREVIEW_OPTIONS.map((opt) => {
          const selected = linkPreviewMode === opt.value
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                if (opt.value !== linkPreviewMode) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setLinkPreviewMode(opt.value)
                }
              }}
              style={{
                backgroundColor: selected ? accentColor : 'transparent',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Text
                fontSize="$2"
                fontWeight={selected ? '600' : '400'}
                color={selected ? background : '$colorSubtle'}
              >
                {opt.label}
              </Text>
            </Pressable>
          )
        })}
      </XStack>
    </XStack>
  )
}

type ThemeOption = 'system' | 'dark' | 'light'

const OPTIONS: { value: ThemeOption; label: string; variant: 'auto' | 'dark' | 'light' }[] = [
  { value: 'system', label: 'Auto', variant: 'auto' },
  { value: 'dark', label: 'Dark', variant: 'dark' },
  { value: 'light', label: 'Light', variant: 'light' },
]

export default function CustomizeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { iconColorStrong, accentColor, iconColor } = useThemeColor()
  const { theme, setTheme } = useAppTheme()
  const { data: user } = useUser()
  const updateUser = useUpdateUser()

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  const handleSelect = useCallback(
    (option: ThemeOption) => {
      setTheme(option)
      updateUser.mutate({
        settings: {
          ...user?.settings,
          theme: option,
        },
      })
    },
    [setTheme, updateUser, user?.settings]
  )

  return (
    <ScreenBackground>
      <XStack
        paddingTop={insets.top + 8}
        paddingHorizontal="$4"
        paddingBottom="$2"
        alignItems="center"
        gap="$2"
        borderBottomWidth={1}
        borderBottomColor="$borderColor"
      >
        <Button
          size="$3"
          circular
          chromeless
          onPress={handleBack}
          icon={<Ionicons name="arrow-back" size={24} color={iconColorStrong} />}
        />
        <Text fontSize="$6" fontWeight="700" flex={1} color="$color">
          Customize
        </Text>
      </XStack>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <YStack padding="$4" gap="$4">
          <Text fontSize="$3" color="$colorSubtle">
            Choose how the app looks. Auto follows your system light/dark setting.
          </Text>

          <XStack justifyContent="space-between" alignItems="flex-end" paddingHorizontal="$2">
            {OPTIONS.map((opt) => {
              const selected = theme === opt.value
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => handleSelect(opt.value)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                >
                  <YStack alignItems="center" gap="$1.5">
                    <YStack
                      padding="$1"
                      borderRadius={16}
                      borderWidth={2}
                      borderColor={selected ? accentColor : '$borderColor'}
                      backgroundColor={selected ? '$blue2' : 'transparent'}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <HomeMockup variant={opt.variant} />
                    </YStack>
                    <XStack alignItems="center" gap="$1">
                      <Text fontSize="$2" color={selected ? '$accentColor' : '$colorSubtle'} fontWeight={selected ? '600' : '400'}>
                        {opt.label}
                      </Text>
                      {selected && <Ionicons name="checkmark-circle" size={14} color={accentColor} />}
                    </XStack>
                  </YStack>
                </Pressable>
              )
            })}
          </XStack>

        </YStack>

        <Pressable
          onPress={() => router.push('/settings/wallpaper')}
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
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
              <Ionicons name="image-outline" size={20} color={accentColor} />
            </XStack>

            <YStack flex={1} gap="$0.5">
              <Text fontSize="$4" color="$color">
                Wallpaper
              </Text>
              <Text fontSize="$2" color="$colorSubtle">
                Set background images
              </Text>
            </YStack>

            <Ionicons name="chevron-forward" size={20} color={iconColor} />
          </XStack>
        </Pressable>

        <FontScaleSelector />

        <FontFamilySelector />

        <NoteViewSelector />

        <ThreadViewSelector />

        <MinimalModeSelector />

        <LinkPreviewSelector />
      </ScrollView>
    </ScreenBackground>
  )
}
