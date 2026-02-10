import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useCallback, useEffect } from 'react'
import { Dimensions, Pressable, StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  clamp,
} from 'react-native-reanimated'
import { Text } from 'tamagui'
import { useSwipeableRow } from '../contexts/SwipeableRowContext'
import { useThemeColor } from '../hooks/useThemeColor'

const ACTION_WIDTH = 80
const SNAP_THRESHOLD = ACTION_WIDTH * 0.4
const FULL_SWIPE_THRESHOLD = 200
const DIRECTION_LOCK_THRESHOLD = 8
const SPRING_CONFIG = { damping: 25, stiffness: 200, overshootClamping: true }
const SCREEN_WIDTH = Dimensions.get('window').width

interface SwipeableRowProps {
  children: React.ReactNode
  rowId: string
  onPress?: () => void
  onLongPress?: () => void
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onFullSwipeLeft?: () => void
  onFullSwipeRight?: () => void
  leftIcon?: keyof typeof Ionicons.glyphMap
  rightIcon?: keyof typeof Ionicons.glyphMap
  leftColor?: string
  rightColor?: string
  leftLabel?: string
  rightLabel?: string
  enabled?: boolean
}

export function SwipeableRow({
  children,
  rowId,
  onPress,
  onLongPress,
  onSwipeLeft,
  onSwipeRight,
  onFullSwipeLeft,
  onFullSwipeRight,
  leftIcon = 'bookmark',
  rightIcon = 'trash',
  leftColor = '#F59E0B',
  rightColor = '#EF4444',
  leftLabel = 'Pin',
  rightLabel = 'Delete',
  enabled = true,
}: SwipeableRowProps) {
  const translateX = useSharedValue(0)
  const startX = useSharedValue(0)
  const directionLocked = useSharedValue(0) // 0=unlocked, 1=right, -1=left
  const hapticFired = useSharedValue(false)
  const fullSwipeHapticFired = useSharedValue(false)
  const swipeCtx = useSwipeableRow()
  const isAnyRowOpen = swipeCtx?.isAnyOpen
  const { color: themeColor } = useThemeColor()

  const fireHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [])

  const fireFullSwipeHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
  }, [])

  const closeRow = useCallback(() => {
    translateX.value = withSpring(0, SPRING_CONFIG)
  }, [translateX])

  // Reset position when rowId changes (FlatList recycling)
  useEffect(() => {
    translateX.value = 0
    startX.value = 0
    directionLocked.value = 0
  }, [rowId])

  // Close row when disabled (e.g. entering selection mode)
  useEffect(() => {
    if (!enabled && translateX.value !== 0) {
      translateX.value = withSpring(0, SPRING_CONFIG)
    }
  }, [enabled])

  const notifyOpen = useCallback((id: string, fn: () => void) => {
    swipeCtx?.registerOpen(id, fn)
  }, [swipeCtx])

  const executeFullSwipeRight = useCallback(() => {
    onFullSwipeRight?.()
  }, [onFullSwipeRight])

  const executeFullSwipeLeft = useCallback(() => {
    onFullSwipeLeft?.()
  }, [onFullSwipeLeft])

  const handlePress = useCallback(() => {
    onPress?.()
  }, [onPress])

  const handleLongPress = useCallback(() => {
    onLongPress?.()
  }, [onLongPress])

  const closeAllRows = useCallback(() => {
    swipeCtx?.closeAll()
  }, [swipeCtx])

  // --- Gesture composition: Pan races with (LongPress exclusive over Tap) ---

  const panGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-5, 5])
    .onStart(() => {
      cancelAnimation(translateX)

      // Always quantize to nearest detent — no intermediate values
      const current = translateX.value
      if (current > ACTION_WIDTH / 2) {
        startX.value = ACTION_WIDTH
      } else if (current < -ACTION_WIDTH / 2) {
        startX.value = -ACTION_WIDTH
      } else {
        startX.value = 0
      }
      translateX.value = startX.value

      directionLocked.value = 0
      hapticFired.value = false
      fullSwipeHapticFired.value = false
    })
    .onUpdate((e) => {
      let x = startX.value + e.translationX

      if (startX.value > 0) {
        // Was open right — can only go back to 0
        x = clamp(x, 0, ACTION_WIDTH)
      } else if (startX.value < 0) {
        // Was open left — can only go back to 0
        x = clamp(x, -ACTION_WIDTH, 0)
      } else {
        // Starting from CLOSED — apply direction lock
        if (directionLocked.value === 0) {
          if (e.translationX > DIRECTION_LOCK_THRESHOLD && onSwipeRight) {
            directionLocked.value = 1
          } else if (e.translationX < -DIRECTION_LOCK_THRESHOLD && onSwipeLeft) {
            directionLocked.value = -1
          }
        }

        if (directionLocked.value === 1) {
          x = Math.max(0, x)
          if (!onSwipeRight) x = 0
        } else if (directionLocked.value === -1) {
          x = Math.min(0, x)
          if (!onSwipeLeft) x = 0
        } else {
          // Not yet locked — stay at zero
          x = 0
        }

        // Rubber-band past action width
        if (x > ACTION_WIDTH) {
          x = ACTION_WIDTH + (x - ACTION_WIDTH) * 0.3
        } else if (x < -ACTION_WIDTH) {
          x = -(ACTION_WIDTH + (-x - ACTION_WIDTH) * 0.3)
        }
      }

      translateX.value = x

      // Haptic at snap threshold (from closed only)
      if (startX.value === 0 && directionLocked.value !== 0) {
        if (Math.abs(x) >= SNAP_THRESHOLD && !hapticFired.value) {
          hapticFired.value = true
          runOnJS(fireHaptic)()
        } else if (Math.abs(x) < SNAP_THRESHOLD) {
          hapticFired.value = false
        }
      }

      // Full-swipe haptic
      if (startX.value === 0 && Math.abs(x) >= FULL_SWIPE_THRESHOLD && !fullSwipeHapticFired.value) {
        fullSwipeHapticFired.value = true
        runOnJS(fireFullSwipeHaptic)()
      } else if (Math.abs(x) < FULL_SWIPE_THRESHOLD) {
        fullSwipeHapticFired.value = false
      }
    })
    .onEnd(() => {
      // From open — always close
      if (startX.value !== 0) {
        translateX.value = withSpring(0, SPRING_CONFIG)
        return
      }

      // Full-swipe — slide off and execute
      if (translateX.value >= FULL_SWIPE_THRESHOLD && onFullSwipeRight) {
        translateX.value = withTiming(SCREEN_WIDTH, { duration: 200 }, () => {
          runOnJS(executeFullSwipeRight)()
          translateX.value = 0
        })
        return
      }
      if (translateX.value <= -FULL_SWIPE_THRESHOLD && onFullSwipeLeft) {
        translateX.value = withTiming(-SCREEN_WIDTH, { duration: 200 }, () => {
          runOnJS(executeFullSwipeLeft)()
          translateX.value = 0
        })
        return
      }

      // Normal snap-open or close
      if (translateX.value > SNAP_THRESHOLD && onSwipeRight) {
        translateX.value = withSpring(ACTION_WIDTH, SPRING_CONFIG)
        runOnJS(notifyOpen)(rowId, closeRow)
      } else if (translateX.value < -SNAP_THRESHOLD && onSwipeLeft) {
        translateX.value = withSpring(-ACTION_WIDTH, SPRING_CONFIG)
        runOnJS(notifyOpen)(rowId, closeRow)
      } else {
        translateX.value = withSpring(0, SPRING_CONFIG)
      }
    })

  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .onEnd((_e, success) => {
      if (!success) return
      // If ANY row is open (this one or another), close all and don't forward
      const anyOpen = isAnyRowOpen ? isAnyRowOpen.value : false
      if (anyOpen || Math.abs(translateX.value) > 2) {
        runOnJS(closeAllRows)()
        cancelAnimation(translateX)
        translateX.value = withSpring(0, SPRING_CONFIG)
        return
      }
      // Nothing open — forward tap
      if (onPress) runOnJS(handlePress)()
    })

  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .onEnd((_e, success) => {
      if (!success) return
      if (Math.abs(translateX.value) <= 2 && onLongPress) {
        runOnJS(handleLongPress)()
      }
    })

  // Pan wins if it activates (20px horizontal). Otherwise longPress has priority over tap.
  const composedGesture = Gesture.Race(
    panGesture,
    Gesture.Exclusive(longPressGesture, tapGesture),
  )

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  const leftActionStyle = useAnimatedStyle(() => {
    const p = clamp(translateX.value / ACTION_WIDTH, 0, 1.5)
    return {
      opacity: interpolate(p, [0, 0.3, 1], [0, 0.6, 1]),
      transform: [{ scale: interpolate(p, [0, 0.5, 1, 1.5], [0.6, 0.8, 1, 1.3]) }],
    }
  })

  const rightActionStyle = useAnimatedStyle(() => {
    const p = clamp(-translateX.value / ACTION_WIDTH, 0, 1.5)
    return {
      opacity: interpolate(p, [0, 0.3, 1], [0, 0.6, 1]),
      transform: [{ scale: interpolate(p, [0, 0.5, 1, 1.5], [0.6, 0.8, 1, 1.3]) }],
    }
  })

  const leftBgStyle = useAnimatedStyle(() => ({
    width: Math.max(0, translateX.value),
  }))

  const rightBgStyle = useAnimatedStyle(() => ({
    width: Math.max(0, -translateX.value),
  }))

  const handleActionPress = useCallback((direction: 'left' | 'right') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    if (direction === 'right' && onSwipeRight) onSwipeRight()
    else if (direction === 'left' && onSwipeLeft) onSwipeLeft()
    translateX.value = withSpring(0, SPRING_CONFIG)
  }, [onSwipeLeft, onSwipeRight, translateX])

  if (!enabled) return <>{children}</>

  return (
    <GestureDetector gesture={composedGesture}>
      <View style={styles.container}>
        {onSwipeRight && (
          <Animated.View style={[styles.leftBg, { backgroundColor: leftColor }, leftBgStyle]} />
        )}
        {onSwipeLeft && (
          <Animated.View style={[styles.rightBg, { backgroundColor: rightColor }, rightBgStyle]} />
        )}

        {onSwipeRight && (
          <Pressable style={[styles.actionPane, styles.leftPane]} onPress={() => handleActionPress('right')}>
            <Animated.View style={[styles.actionContent, leftActionStyle]}>
              <Ionicons name={leftIcon} size={22} color={themeColor} />
              <Text color="$color" fontSize="$2" fontWeight="600">{leftLabel}</Text>
            </Animated.View>
          </Pressable>
        )}
        {onSwipeLeft && (
          <Pressable style={[styles.actionPane, styles.rightPane]} onPress={() => handleActionPress('left')}>
            <Animated.View style={[styles.actionContent, rightActionStyle]}>
              <Ionicons name={rightIcon} size={22} color={themeColor} />
              <Text color="$color" fontSize="$2" fontWeight="600">{rightLabel}</Text>
            </Animated.View>
          </Pressable>
        )}

        <Animated.View style={[styles.content, contentStyle]}>
          {children}
        </Animated.View>
      </View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  content: {
    backgroundColor: 'transparent',
  },
  leftBg: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  rightBg: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
  },
  actionPane: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  leftPane: {
    left: 0,
  },
  rightPane: {
    right: 0,
  },
})
