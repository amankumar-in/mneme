import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Text, XStack, YStack } from 'tamagui'

export default function QRScanScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const handleClose = useCallback(() => {
    router.back()
  }, [router])

  return (
    <YStack flex={1} backgroundColor="#000000">
      <XStack
        position="absolute"
        top={0}
        left={0}
        right={0}
        paddingTop={insets.top}
        paddingHorizontal="$4"
        paddingBottom="$4"
        zIndex={10}
      >
        <Button
          size="$4"
          circular
          backgroundColor="rgba(255,255,255,0.2)"
          pressStyle={{ backgroundColor: 'rgba(255,255,255,0.3)' }}
          onPress={handleClose}
          icon={<Ionicons name="close" size={24} color="#ffffff" />}
        />
      </XStack>

      <YStack flex={1} justifyContent="center" alignItems="center" padding="$8">
        <XStack
          width={250}
          height={250}
          borderWidth={2}
          borderColor="#ffffff"
          borderRadius="$4"
          alignItems="center"
          justifyContent="center"
        >
          <YStack alignItems="center" gap="$4">
            <Ionicons name="qr-code" size={80} color="#ffffff" />
            <Text color="#ffffff" fontSize="$3" textAlign="center">
              Camera permission required
            </Text>
          </YStack>
        </XStack>

        <Text color="#ffffff" fontSize="$4" marginTop="$6" textAlign="center">
          Scan QR code on web.laterbox.app
        </Text>
        <Text color="#94a3b8" fontSize="$3" marginTop="$2" textAlign="center">
          Access your notes from any browser
        </Text>
      </YStack>
    </YStack>
  )
}
