import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { Button, Text, XStack, YStack } from 'tamagui'
import { ScreenBackground } from '@/components/ScreenBackground'
import { stopLocalServer, getLocalServerSession } from '@/services/localServer'
import { useThemeColor } from '@/hooks/useThemeColor'

const TRACK_WIDTH = 80
const DOT_SIZE = 4
const DOT_SPACING = 14
const DOT_COUNT = Math.ceil(TRACK_WIDTH / DOT_SPACING) + 2
const ROW_GAP = 6

function DataFlowAnimation({ iconColor, dotColor }: { iconColor: string; dotColor: string }) {
  const fwd = useSharedValue(0)
  const rev = useSharedValue(0)

  useEffect(() => {
    fwd.value = withRepeat(
      withTiming(DOT_SPACING, { duration: 600, easing: Easing.linear }),
      -1
    )
    rev.value = withRepeat(
      withTiming(-DOT_SPACING, { duration: 600, easing: Easing.linear }),
      -1
    )
  }, [fwd, rev])

  const fwdStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: fwd.value }],
  }))

  const revStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: rev.value }],
  }))

  const dots = Array.from({ length: DOT_COUNT }, (_, i) => (
    <View
      key={i}
      style={{
        position: 'absolute' as const,
        left: (i - 1) * DOT_SPACING,
        width: DOT_SIZE,
        height: DOT_SIZE,
        borderRadius: DOT_SIZE / 2,
        backgroundColor: dotColor,
      }}
    />
  ))

  return (
    <XStack
      alignItems="center"
      justifyContent="center"
      gap="$5"
      height={60}
    >
      <Ionicons name="phone-portrait-outline" size={36} color={iconColor} />

      <View style={{ width: TRACK_WIDTH, height: DOT_SIZE * 2 + ROW_GAP, overflow: 'hidden' }}>
        <Animated.View style={[{ height: DOT_SIZE, position: 'relative' as const }, fwdStyle]}>
          {dots}
        </Animated.View>
        <View style={{ height: ROW_GAP }} />
        <Animated.View style={[{ height: DOT_SIZE, position: 'relative' as const }, revStyle]}>
          {dots}
        </Animated.View>
      </View>

      <Ionicons name="desktop-outline" size={36} color={iconColor} />
    </XStack>
  )
}

export default function WebSessionScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [elapsed, setElapsed] = useState(0)
  const [isConnected, setIsConnected] = useState(true)
  const [serverIp, setServerIp] = useState<string | null>(null)
  const [serverPort, setServerPort] = useState<number | null>(null)
  const { iconColorStrong, colorSubtle: subtleColor, successColor } = useThemeColor()

  useEffect(() => {
    const session = getLocalServerSession()
    if (session) {
      setServerIp(session.ip)
      setServerPort(session.port)
    }

    const interval = setInterval(() => {
      const session = getLocalServerSession()
      if (session) {
        setElapsed(Math.floor((Date.now() - session.startedAt) / 1000))
        setServerIp(session.ip)
        setServerPort(session.port)
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
    <ScreenBackground>
      {/* Header */}
      <XStack
        paddingTop={insets.top + 8}
        paddingHorizontal="$4"
        paddingBottom="$2"
        alignItems="center"
        gap="$2"
      >
        <Button
          size="$3"
          circular
          chromeless
          onPress={handleBack}
          icon={<Ionicons name="arrow-back" size={24} color={subtleColor} />}
        />
        <Text fontSize="$6" fontWeight="700" color="$color" flex={1}>
          LaterBox Web
        </Text>
      </XStack>

      <YStack flex={1} justifyContent="center" alignItems="center" padding="$8" gap="$6">
        {isConnected ? (
          <>
            {/* Animated phone <-> computer */}
            <DataFlowAnimation iconColor={iconColorStrong} dotColor={successColor} />

            {/* Status text */}
            <YStack alignItems="center" gap="$2">
              <Text fontSize="$7" fontWeight="700" color="$color">
                Server Is Running
              </Text>
              <Text fontSize="$4" color="$colorSubtle">
                Connected for {formatDuration(elapsed)}
              </Text>
            </YStack>

            {/* Connection info card */}
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
                  {serverIp}
                </Text>
              </XStack>
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontSize="$3" color="$colorSubtle">
                  Port
                </Text>
                <Text fontSize="$3" color="$color" fontFamily="$mono">
                  {serverPort}
                </Text>
              </XStack>
            </YStack>
          </>
        ) : (
          <>
            {/* Disconnected icon */}
            <YStack
              width={120}
              height={120}
              borderRadius={60}
              backgroundColor="$red3"
              alignItems="center"
              justifyContent="center"
            >
              <Ionicons
                name="close-circle-outline"
                size={56}
                color="#ef4444"
              />
            </YStack>

            <YStack alignItems="center" gap="$2">
              <Text fontSize="$7" fontWeight="700" color="$color">
                Disconnected
              </Text>
            </YStack>
          </>
        )}
      </YStack>

      {/* Info text — flat on screen */}
      <YStack paddingHorizontal="$6" paddingBottom="$4" gap="$3">
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
    </ScreenBackground>
  )
}
