import { Ionicons } from '@expo/vector-icons'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRouter } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { Button, Spinner, Text, XStack, YStack } from 'tamagui'
import { ScreenBackground } from '@/components/ScreenBackground'
import { useDb } from '@/contexts/DatabaseContext'
import { startLocalServer } from '@/services/localServer'
import { useThemeColor } from '@/hooks/useThemeColor'

const SCREEN_WIDTH = Dimensions.get('window').width
const VIEWFINDER_SIZE = SCREEN_WIDTH * 0.65

interface QRPayload {
  type: 'laterbox-web'
  v: number
  sessionId: string
  token: string
  relay: string
}

export default function QRScanScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const db = useDb()
  const queryClient = useQueryClient()
  const [permission, requestPermission] = useCameraPermissions()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const processedRef = useRef(false)
  const { iconColorStrong, colorSubtle: subtleColor, successColor, accentColor } = useThemeColor()

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  const handleBarcodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (processedRef.current || isProcessing) return
      processedRef.current = true
      setIsProcessing(true)
      setError(null)

      try {
        const payload: QRPayload = JSON.parse(data)

        if (payload.type !== 'laterbox-web' || payload.v !== 1) {
          throw new Error('Invalid QR code. Please use the QR code from laterbox.org')
        }

        if (!payload.sessionId || !payload.token || !payload.relay) {
          throw new Error('Incomplete QR code data')
        }

        const serverInfo = await startLocalServer(db, payload.token, () => {
          queryClient.invalidateQueries({ queryKey: ['notes'] })
          queryClient.invalidateQueries({ queryKey: ['threads'] })
        })

        const relayUrl = `${payload.relay}?sessionId=${payload.sessionId}&role=phone`
        const ws = new WebSocket(relayUrl)

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: 'phone-ready',
              ip: serverInfo.ip,
              port: serverInfo.port,
              token: payload.token,
            })
          )
        }

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            if (msg.type === 'error') {
              setError(msg.error || 'Connection failed')
              setIsProcessing(false)
              processedRef.current = false
            }
          } catch {}
        }

        ws.onclose = () => {
          // Relay closes after forwarding — this is expected
        }

        ws.onerror = () => {
          setError('Failed to connect to signaling server')
          setIsProcessing(false)
          processedRef.current = false
        }

        router.replace({
          pathname: '/web-session',
          params: {
            ip: serverInfo.ip,
            port: String(serverInfo.port),
          },
        })
      } catch (err) {
        const message =
          err instanceof SyntaxError
            ? 'Invalid QR code format'
            : err instanceof Error
              ? err.message
              : 'Failed to process QR code'
        setError(message)
        setIsProcessing(false)
        processedRef.current = false
      }
    },
    [db, isProcessing, router, queryClient]
  )

  // Permission not determined yet
  if (!permission) {
    return (
      <ScreenBackground>
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" color="$color" />
        </YStack>
      </ScreenBackground>
    )
  }

  // Permission not granted
  if (!permission.granted) {
    return (
      <ScreenBackground>
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

        <YStack flex={1} justifyContent="center" alignItems="center" padding="$8" gap="$4">
          <Ionicons name="camera-outline" size={64} color={subtleColor} />
          <Text color="$color" fontSize="$5" fontWeight="600" textAlign="center">
            Camera Permission Required
          </Text>
          <Text color="$colorSubtle" fontSize="$3" textAlign="center">
            LaterBox needs camera access to scan the QR code from the web client.
          </Text>
          <Button
            size="$4"
            backgroundColor="$accentColor"
            borderRadius="$4"
            marginTop="$4"
            onPress={requestPermission}
          >
            <Text color="#ffffff" fontWeight="600">
              Grant Permission
            </Text>
          </Button>
        </YStack>
      </ScreenBackground>
    )
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

      {/* Scanner viewfinder */}
      <YStack alignItems="center" paddingTop="$6" paddingBottom="$4">
        <View style={styles.viewfinderWrapper}>
          {/* Corner brackets — outside the camera cutout */}
          <View style={[styles.corner, styles.cornerTL, { borderColor: iconColorStrong }]} />
          <View style={[styles.corner, styles.cornerTR, { borderColor: iconColorStrong }]} />
          <View style={[styles.corner, styles.cornerBL, { borderColor: iconColorStrong }]} />
          <View style={[styles.corner, styles.cornerBR, { borderColor: iconColorStrong }]} />

          {/* Camera clipped inside */}
          <View style={styles.cameraClip}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={isProcessing ? undefined : handleBarcodeScanned}
            />

            {/* Processing overlay */}
            {isProcessing && (
              <YStack
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                backgroundColor="rgba(0,0,0,0.6)"
                justifyContent="center"
                alignItems="center"
                gap="$2"
              >
                <Spinner size="large" color="#ffffff" />
                <Text color="#ffffff" fontSize="$3" fontWeight="600">
                  Connecting...
                </Text>
              </YStack>
            )}
          </View>
        </View>

        <Text color="$colorSubtle" fontSize="$3" marginTop="$3" textAlign="center">
          Point camera at the QR code on{' '}
          <Text color="$color" fontSize="$3" fontWeight="600">laterbox.org</Text>
        </Text>
      </YStack>

      {/* Error */}
      {error && (
        <YStack
          marginHorizontal="$4"
          backgroundColor="$errorColor"
          paddingHorizontal="$4"
          paddingVertical="$3"
          borderRadius="$3"
          marginBottom="$4"
        >
          <Text color="#ffffff" fontSize="$3" textAlign="center">
            {error}
          </Text>
        </YStack>
      )}

      {/* Info section */}
      <YStack paddingHorizontal="$5" gap="$4" flex={1} justifyContent="flex-end" paddingBottom={insets.bottom + 24}>
        <XStack gap="$3" alignItems="flex-start">
          <Ionicons name="wifi-outline" size={20} color={accentColor} />
          <YStack flex={1} gap="$1">
            <Text fontSize="$3" fontWeight="600" color="$color">
              Local Network Only
            </Text>
            <Text fontSize="$2" color="$colorSubtle">
              Your phone becomes a local server. The browser connects directly over WiFi — both devices must be on the same network.
            </Text>
          </YStack>
        </XStack>

        <XStack gap="$3" alignItems="flex-start">
          <Ionicons name="lock-closed-outline" size={20} color={accentColor} />
          <YStack flex={1} gap="$1">
            <Text fontSize="$3" fontWeight="600" color="$color">
              End-to-End Private
            </Text>
            <Text fontSize="$2" color="$colorSubtle">
              No data leaves your network. Notes are served directly from this device — nothing goes through the cloud.
            </Text>
          </YStack>
        </XStack>

        <XStack gap="$3" alignItems="flex-start">
          <Ionicons name="time-outline" size={20} color={accentColor} />
          <YStack flex={1} gap="$1">
            <Text fontSize="$3" fontWeight="600" color="$color">
              Session Based
            </Text>
            <Text fontSize="$2" color="$colorSubtle">
              Each QR scan creates a unique session. You can disconnect anytime from the app.
            </Text>
          </YStack>
        </XStack>
      </YStack>
    </ScreenBackground>
  )
}

const CORNER_SIZE = 28
const CORNER_THICKNESS = 3
const CORNER_RADIUS = 16
const CORNER_OFFSET = 8

const styles = StyleSheet.create({
  viewfinderWrapper: {
    width: VIEWFINDER_SIZE + CORNER_OFFSET * 2,
    height: VIEWFINDER_SIZE + CORNER_OFFSET * 2,
    position: 'relative',
  },
  cameraClip: {
    position: 'absolute',
    top: CORNER_OFFSET,
    left: CORNER_OFFSET,
    width: VIEWFINDER_SIZE,
    height: VIEWFINDER_SIZE,
    borderRadius: CORNER_RADIUS - 4,
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: CORNER_RADIUS,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: CORNER_RADIUS,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: CORNER_RADIUS,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: CORNER_RADIUS,
  },
})
