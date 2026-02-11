import { useCallback } from 'react'
import { Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { XStack, YStack, Text } from 'tamagui'
import { Ionicons } from '@expo/vector-icons'
import { useThemeColor } from '../../hooks/useThemeColor'
import { useAppTheme } from '../../contexts/ThemeContext'

// Theme-aware color swatches — each has a light and dark variant
// Black/white is the same swatch, flips with theme
const COLOR_SWATCHES: { light: string; dark: string }[] = [
  { light: '#000000', dark: '#ffffff' }, // black/white — same swatch
  { light: '#b91c1c', dark: '#fca5a5' }, // red
  { light: '#1d4ed8', dark: '#93c5fd' }, // blue
  { light: '#15803d', dark: '#86efac' }, // green
  { light: '#a16207', dark: '#fde047' }, // yellow
  { light: '#7e22ce', dark: '#d8b4fe' }, // purple
  { light: '#c2410c', dark: '#fdba74' }, // orange
]

const THICKNESS_OPTIONS = [
  { key: 'thin', width: 2, display: 4 },
  { key: 'medium', width: 4, display: 8 },
  { key: 'thick', width: 8, display: 14 },
]

interface DrawingToolbarProps {
  selectedColor: string
  selectedWidth: number
  onColorChange: (color: string) => void
  onWidthChange: (width: number) => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}

export function DrawingToolbar({
  selectedColor,
  selectedWidth,
  onColorChange,
  onWidthChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: DrawingToolbarProps) {
  const { resolvedTheme } = useAppTheme()
  const { iconColor, iconColorStrong, background, accentColor } = useThemeColor()
  const insets = useSafeAreaInsets()
  const isDark = resolvedTheme === 'dark'

  const getSwatchColor = useCallback(
    (swatch: { light: string; dark: string }) => {
      return isDark ? swatch.dark : swatch.light
    },
    [isDark]
  )

  return (
    <YStack
      backgroundColor="$backgroundStrong"
      borderTopWidth={1}
      borderTopColor="$borderColor"
      paddingHorizontal="$3"
      paddingTop="$2"
      paddingBottom={8}
      gap="$2"
    >
      {/* Color swatches row */}
      <XStack justifyContent="space-between" alignItems="center">
        <XStack gap="$2" flex={1} justifyContent="center">
          {COLOR_SWATCHES.map((swatch, i) => {
            const color = getSwatchColor(swatch)
            const isSelected = selectedColor === color
            return (
              <Pressable
                key={i}
                onPress={() => onColorChange(color)}
              >
                <YStack
                  width={28}
                  height={28}
                  borderRadius={14}
                  backgroundColor={color as any}
                  borderWidth={isSelected ? 3 : 1}
                  borderColor={isSelected ? '$accentColor' : '$borderColor'}
                />
              </Pressable>
            )
          })}
        </XStack>
      </XStack>

      {/* Thickness + undo/redo row */}
      <XStack justifyContent="space-between" alignItems="center">
        <XStack gap="$3" alignItems="center">
          {THICKNESS_OPTIONS.map((opt) => {
            const isSelected = selectedWidth === opt.width
            return (
              <Pressable key={opt.key} onPress={() => onWidthChange(opt.width)}>
                <YStack
                  width={32}
                  height={32}
                  borderRadius={16}
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor={isSelected ? '$backgroundTinted' : 'transparent'}
                  borderWidth={isSelected ? 1 : 0}
                  borderColor="$accentColor"
                >
                  <YStack
                    width={opt.display}
                    height={opt.display}
                    borderRadius={opt.display / 2}
                    backgroundColor={selectedColor as any}
                  />
                </YStack>
              </Pressable>
            )
          })}
        </XStack>

        <XStack gap="$2">
          <Pressable onPress={onUndo} disabled={!canUndo}>
            <YStack
              width={36}
              height={36}
              borderRadius={18}
              alignItems="center"
              justifyContent="center"
              opacity={canUndo ? 1 : 0.3}
            >
              <Ionicons name="arrow-undo" size={20} color={iconColorStrong} />
            </YStack>
          </Pressable>
          <Pressable onPress={onRedo} disabled={!canRedo}>
            <YStack
              width={36}
              height={36}
              borderRadius={18}
              alignItems="center"
              justifyContent="center"
              opacity={canRedo ? 1 : 0.3}
            >
              <Ionicons name="arrow-redo" size={20} color={iconColorStrong} />
            </YStack>
          </Pressable>
        </XStack>
      </XStack>
    </YStack>
  )
}

// Export for use in canvas to get the initial color
export function getDefaultDrawColor(isDark: boolean): string {
  return isDark ? '#ffffff' : '#000000'
}
