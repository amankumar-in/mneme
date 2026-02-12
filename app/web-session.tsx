import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Text, XStack, YStack } from 'tamagui'
import { stopLocalServer, isLocalServerRunning, getLocalServerSession } from '@/services/localServer'
import { useThemeColor } from '@/hooks/useThemeColor'

export default function WebSessionScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ ip: string; port: string }>()
  const [elapsed, setElapsed] = useState(0)
  const [isConnected, setIsConnected] = useState(true)
  const { iconColorStrong, colorSubtle: subtleColor } = useThemeColor()

  useEffect(() => {
    const interval = setInterval(() => {
      const session = getLocalServerSession()
      if (session) {
        setElapsed(Math.floor((Date.now() - session.startedAt) / 1000))
        setIsConnected(true)
      } else {
        setIsConnected(false)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const handleDisconnect = useCallback(async () => {
    await stopLocalServer()
    setIsConnected(false)
    router.back()
  }, [router])

  const handleBack = useCallback(() => {
    // Go back without disconnecting — server keeps running in background
    router.back()
  }, [router])

  const formatDuration = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    }
    return `${seconds}s`
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      {/* Header */}
      <XStack
        paddingTop={insets.top}
        paddingHorizontal="$4"
        paddingBottom="$4"
        alignItems="center"
        gap="$3"
        borderBottomWidth={1}
        borderBottomColor="$borderColor"
      >
        <Button
          size="$3"
          circular
          chromeless
          onPress={handleBack}
          icon={<Ionicons name="arrow-back" size={24} color={subtleColor} />}
        />
        <Text fontSize="$6" fontWeight="700" color="$color" flex={1}>
          Web Client
        </Text>
      </XStack>

      <YStack flex={1} justifyContent="center" alignItems="center" padding="$8" gap="$6">
        {/* Status icon */}
        <YStack
          width={120}
          height={120}
          borderRadius={60}
          backgroundColor={isConnected ? '$green3' : '$red3'}
          alignItems="center"
          justifyContent="center"
        >
          <Ionicons
            name={isConnected ? 'desktop-outline' : 'close-circle-outline'}
            size={56}
            color={isConnected ? iconColorStrong : '#ef4444'}
          />
        </YStack>

        {/* Status text */}
        <YStack alignItems="center" gap="$2">
          <Text fontSize="$7" fontWeight="700" color="$color">
            {isConnected ? 'Web Client Connected' : 'Disconnected'}
          </Text>
          {isConnected && (
            <Text fontSize="$4" color="$colorSubtle">
              Connected for {formatDuration(elapsed)}
            </Text>
          )}
        </YStack>

        {/* Connection info */}
        {isConnected && (
          <YStack
            backgroundColor="$backgroundFocus"
            borderRadius="$4"
            padding="$4"
            width="100%"
            maxWidth={350}
            gap="$3"
          >
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize="$3" color="$colorSubtle">
                IP Address
              </Text>
              <Text fontSize="$3" color="$color" fontFamily="$mono">
                {params.ip}
              </Text>
            </XStack>
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize="$3" color="$colorSubtle">
                Port
              </Text>
              <Text fontSize="$3" color="$color" fontFamily="$mono">
                {params.port}
              </Text>
            </XStack>
          </YStack>
        )}

        {/* Info */}
        <YStack
          backgroundColor="$backgroundFocus"
          borderRadius="$4"
          padding="$4"
          width="100%"
          maxWidth={350}
          gap="$2"
        >
          <XStack gap="$2" alignItems="flex-start">
            <Ionicons name="information-circle-outline" size={18} color={subtleColor} />
            <Text fontSize="$2" color="$colorSubtle" flex={1}>
              Your notes are served directly from this device over your local network. No data goes through the cloud.
            </Text>
          </XStack>
          <XStack gap="$2" alignItems="flex-start">
            <Ionicons name="timer-outline" size={18} color={subtleColor} />
            <Text fontSize="$2" color="$colorSubtle" flex={1}>
              The server runs until you manually disconnect. You can leave the app in the background.
            </Text>
          </XStack>
        </YStack>
      </YStack>

      {/* Disconnect button */}
      <YStack padding="$4" paddingBottom={insets.bottom + 16}>
        <Button
          size="$5"
          backgroundColor="$red9"
          borderRadius="$4"
          onPress={handleDisconnect}
        >
          <XStack gap="$2" alignItems="center">
            <Ionicons name="close-circle" size={20} color="#ffffff" />
            <Text color="#ffffff" fontWeight="600" fontSize="$4">
              Disconnect
            </Text>
          </XStack>
        </Button>
      </YStack>
    </YStack>
  )
}
