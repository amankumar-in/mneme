import { useEffect } from 'react'
import { Pressable } from 'react-native'
import { XStack, YStack } from 'tamagui'
import { Ionicons } from '@expo/vector-icons'
import { useThemeColor } from '../../hooks/useThemeColor'
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated'

interface FlyMenuProps {
  visible: boolean
  x: number
  y: number
  onImage: () => void
  onRectangle: () => void
  onAudio: () => void
  onDismiss: () => void
}

export function FlyMenu({ visible, x, y, onImage, onRectangle, onAudio, onDismiss }: FlyMenuProps) {
  const { iconColorStrong } = useThemeColor()
  const opacity = useSharedValue(0)

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 150 })
  }, [visible])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: 0.9 + opacity.value * 0.1 }],
  }))

  if (!visible) return null

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x - 75,
          top: y - 50,
          zIndex: 1000,
        },
        animatedStyle,
      ]}
    >
      <XStack
        backgroundColor="$backgroundStrong"
        borderRadius="$4"
        padding="$2"
        gap="$1"
        elevation={8}
        borderWidth={1}
        borderColor="$borderColor"
      >
        <Pressable onPress={onImage}>
          <YStack
            width={44}
            height={44}
            borderRadius="$2"
            alignItems="center"
            justifyContent="center"
            pressStyle={{ backgroundColor: '$backgroundHover' }}
          >
            <Ionicons name="image-outline" size={22} color={iconColorStrong} />
          </YStack>
        </Pressable>
        <Pressable onPress={onRectangle}>
          <YStack
            width={44}
            height={44}
            borderRadius="$2"
            alignItems="center"
            justifyContent="center"
            pressStyle={{ backgroundColor: '$backgroundHover' }}
          >
            <Ionicons name="square-outline" size={22} color={iconColorStrong} />
          </YStack>
        </Pressable>
        <Pressable onPress={onAudio}>
          <YStack
            width={44}
            height={44}
            borderRadius="$2"
            alignItems="center"
            justifyContent="center"
            pressStyle={{ backgroundColor: '$backgroundHover' }}
          >
            <Ionicons name="mic-outline" size={22} color={iconColorStrong} />
          </YStack>
        </Pressable>
      </XStack>
    </Animated.View>
  )
}
