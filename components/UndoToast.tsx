import { useCallback, useEffect, useRef } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated'
import { Text, XStack } from 'tamagui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const TOAST_DURATION = 5000

interface UndoToastProps {
  visible: boolean
  message: string
  onUndo: () => void
  onDismiss: () => void
}

export function UndoToast({ visible, message, onUndo, onDismiss }: UndoToastProps) {
  const insets = useSafeAreaInsets()
  const opacity = useSharedValue(0)
  const translateY = useSharedValue(20)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 })
      translateY.value = withTiming(0, { duration: 200 })
      timerRef.current = setTimeout(onDismiss, TOAST_DURATION)
    } else {
      opacity.value = withTiming(0, { duration: 150 })
      translateY.value = withTiming(20, { duration: 150 })
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [visible])

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  const handleUndo = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    onUndo()
  }, [onUndo])

  if (!visible) return null

  return (
    <Animated.View
      style={[
        styles.container,
        { bottom: insets.bottom + 80 },
        animStyle,
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <XStack
        backgroundColor="$backgroundStrong"
        paddingHorizontal="$4"
        paddingVertical="$3"
        borderRadius="$4"
        alignItems="center"
        justifyContent="space-between"
        gap="$3"
        elevation={4}
        borderWidth={1}
        borderColor="$borderColor"
      >
        <Text color="$color" fontSize="$3" flex={1} numberOfLines={1}>
          {message}
        </Text>
        <Pressable onPress={handleUndo}>
          <Text color="$accentColor" fontSize="$3" fontWeight="700">
            Undo
          </Text>
        </Pressable>
      </XStack>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 999,
  },
})
