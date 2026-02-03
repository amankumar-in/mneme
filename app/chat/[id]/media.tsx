import { useCallback } from 'react'
import { YStack, XStack, Text, Button } from 'tamagui'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useThemeColor } from '../../../hooks/useThemeColor'

export default function MediaFilesScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const { iconColorStrong, iconColor } = useThemeColor()

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  return (
    <YStack flex={1} backgroundColor="$background">
      <XStack
        paddingTop={insets.top + 8}
        paddingHorizontal="$4"
        paddingBottom="$2"
        backgroundColor="$background"
        alignItems="center"
        gap="$3"
      >
        <Button
          size="$3"
          circular
          chromeless
          onPress={handleBack}
          icon={<Ionicons name="arrow-back" size={24} color={iconColorStrong} />}
        />
        <Text fontSize="$5" fontWeight="600" color="$color" flex={1}>
          Media, Links & Docs
        </Text>
      </XStack>

      <YStack flex={1} justifyContent="center" alignItems="center" padding="$6">
        <Ionicons name="images-outline" size={64} color={iconColor} />
        <Text fontSize="$5" color="$colorSubtle" marginTop="$4" textAlign="center">
          Coming soon
        </Text>
        <Text fontSize="$3" color="$colorMuted" marginTop="$2" textAlign="center">
          View all media, links and documents shared in this chat
        </Text>
      </YStack>
    </YStack>
  )
}
