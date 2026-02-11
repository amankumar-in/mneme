import { useCallback } from 'react'
import { Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { XStack, YStack, Text } from 'tamagui'
import { Ionicons } from '@expo/vector-icons'
import { useThemeColor } from '../../hooks/useThemeColor'
import { useAppTheme } from '../../contexts/ThemeContext'

// Theme-aware color swatches — each has a light and dark variant
// Black/white is the same swatch, flips with theme
export const COLOR_SWATCHES: { light: string; dark: string }[] = [
  { light: '#000000', dark: '#ffffff' }, // black/white — same swatch
  { light: '#b91c1c', dark: '#fca5a5' }, // red
  { light: '#1d4ed8', dark: '#93c5fd' }, // blue
  { light: '#15803d', dark: '#86efac' }, // green
  { light: '#a16207', dark: '#fde047' }, // yellow
  { light: '#7e22ce', dark: '#d8b4fe' }, // purple
  { light: '#c2410c', dark: '#fdba74' }, // orange
]

// Build a lookup: any swatch color → { light, dark }
const SWATCH_LOOKUP = new Map<string, { light: string; dark: string }>()
COLOR_SWATCHES.forEach((s) => {
  SWATCH_LOOKUP.set(s.light.toLowerCase(), s)
  SWATCH_LOOKUP.set(s.dark.toLowerCase(), s)
})

/** Resolve a stored stroke color to its current-theme variant */
export function resolveStrokeColor(storedColor: string, isDark: boolean): string {
  const swatch = SWATCH_LOOKUP.get(storedColor.toLowerCase())
  if (!swatch) return storedColor
  return isDark ? swatch.dark : swatch.light
}

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
  // Text editing (shown when a text item is selected)
  textSelected?: boolean
  textFontSize?: number
  textBold?: boolean
  onFontSizeChange?: (size: number) => void
  onBoldToggle?: () => void
  // Delete button (shown when something is selected)
  showDelete?: boolean
  onDelete?: () => void
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
  textSelected,
  textFontSize = 16,
  textBold = false,
  onFontSizeChange,
  onBoldToggle,
  showDelete,
  onDelete,
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

  const handleFontSizeUp = useCallback(() => {
    const newSize = Math.min(72, textFontSize + 4)
    onFontSizeChange?.(newSize)
  }, [textFontSize, onFontSizeChange])

  const handleFontSizeDown = useCallback(() => {
    const newSize = Math.max(8, textFontSize - 4)
    onFontSizeChange?.(newSize)
  }, [textFontSize, onFontSizeChange])

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
      {/* Color swatches row - left aligned */}
      <XStack justifyContent="space-between" alignItems="center">
        <XStack gap="$2">
          {COLOR_SWATCHES.map((swatch, i) => {
            const color = getSwatchColor(swatch)
            const isSelected = selectedColor === color
            return (
              <Pressable
                key={i}
                onPress={() => onColorChange(color)}
              >
                <YStack
                  width={24}
                  height={24}
                  borderRadius={12}
                  backgroundColor={color as any}
                  borderWidth={isSelected ? 3 : 1}
                  borderColor={isSelected ? '$accentColor' : '$borderColor'}
                />
              </Pressable>
            )
          })}
        </XStack>

        {/* Right side: thickness OR text controls */}
        {textSelected ? (
          /* Text formatting controls */
          <XStack gap="$3" alignItems="center">
            {/* Font size control group */}
            <XStack
              backgroundColor="$backgroundTinted"
              borderRadius="$3"
              alignItems="center"
              height={36}
              overflow="hidden"
            >
              <Pressable onPress={handleFontSizeDown}>
                <YStack width={34} height={36} alignItems="center" justifyContent="center">
                  <Ionicons name="remove" size={16} color={iconColorStrong} />
                </YStack>
              </Pressable>
              {/* Small-A big-A icon */}
              <XStack alignItems="baseline" paddingHorizontal="$1">
                <Text color="$color" fontSize={11} fontWeight="600">A</Text>
                <Text color="$color" fontSize={17} fontWeight="600">A</Text>
              </XStack>
              <Pressable onPress={handleFontSizeUp}>
                <YStack width={34} height={36} alignItems="center" justifyContent="center">
                  <Ionicons name="add" size={16} color={iconColorStrong} />
                </YStack>
              </Pressable>
            </XStack>

            {/* Bold toggle */}
            <Pressable onPress={onBoldToggle}>
              <YStack
                width={36}
                height={36}
                borderRadius="$3"
                alignItems="center"
                justifyContent="center"
                backgroundColor={textBold ? '$accentColor' : '$backgroundTinted'}
              >
                <Text
                  color={textBold ? 'white' : '$color'}
                  fontSize={16}
                  fontWeight="800"
                >
                  B
                </Text>
              </YStack>
            </Pressable>
          </XStack>
        ) : (
          /* Stroke thickness controls */
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
        )}
      </XStack>

      {/* Second row: undo/redo centered + delete on right */}
      <XStack justifyContent="space-between" alignItems="center">
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

        {/* Delete button on right */}
        {showDelete && (
          <Pressable onPress={onDelete}>
            <YStack
              width={36}
              height={36}
              borderRadius={18}
              alignItems="center"
              justifyContent="center"
              backgroundColor="rgba(239,68,68,0.9)"
            >
              <Ionicons name="trash-outline" size={18} color="white" />
            </YStack>
          </Pressable>
        )}
      </XStack>
    </YStack>
  )
}

// Export for use in canvas to get the initial color
export function getDefaultDrawColor(isDark: boolean): string {
  return isDark ? '#ffffff' : '#000000'
}
