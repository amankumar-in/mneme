import { useEffect } from 'react'
import { Pressable, View } from 'react-native'
import { XStack, YStack } from 'tamagui'
import { Ionicons } from '@expo/vector-icons'
import { useThemeColor } from '../../hooks/useThemeColor'
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated'

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
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
      }}
    >
      {/* The menu pill */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: x - 55,
            top: y - 42,
          },
          animatedStyle,
        ]}
      >
        <XStack
          backgroundColor="$backgroundStrong"
          borderRadius={10}
          paddingHorizontal={4}
          paddingVertical={2}
          gap={0}
          elevation={8}
          borderWidth={1}
          borderColor="$borderColor"
        >
          <Pressable onPress={onImage}>
            <YStack
              width={34}
              height={30}
              alignItems="center"
              justifyContent="center"
            >
              <Ionicons name="image-outline" size={22} color={iconColorStrong} />
            </YStack>
          </Pressable>
          <Pressable onPress={onRectangle}>
            <YStack
              width={34}
              height={30}
              alignItems="center"
              justifyContent="center"
            >
              <Ionicons name="square-outline" size={22} color={iconColorStrong} />
            </YStack>
          </Pressable>
          <Pressable onPress={onAudio}>
            <YStack
              width={34}
              height={30}
              alignItems="center"
              justifyContent="center"
            >
              <Ionicons name="mic-outline" size={22} color={iconColorStrong} />
            </YStack>
          </Pressable>
        </XStack>
      </Animated.View>
    </View>
  )
}
