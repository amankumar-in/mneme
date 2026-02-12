import { Ionicons } from '@expo/vector-icons'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRouter } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Spinner, Text, XStack, YStack } from 'tamagui'
import { useDb } from '@/contexts/DatabaseContext'
import { startLocalServer } from '@/services/localServer'
import { useThemeColor } from '@/hooks/useThemeColor'

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
  const [permission, requestPermission] = useCameraPermissions()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const processedRef = useRef(false)
  const brandColor = useThemeColor('$brandBackground')

  const handleClose = useCallback(() => {
    router.back()
  }, [router])

  const handleBarcodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      // Prevent double-processing
      if (processedRef.current || isProcessing) return
      processedRef.current = true
      setIsProcessing(true)
      setError(null)

      try {
        const payload: QRPayload = JSON.parse(data)

        // Validate QR payload
        if (payload.type !== 'laterbox-web' || payload.v !== 1) {
          throw new Error('Invalid QR code. Please use the QR code from web.laterbox.com')
        }

        if (!payload.sessionId || !payload.token || !payload.relay) {
          throw new Error('Incomplete QR code data')
        }

        // Start local server with the QR token so browser can authenticate
        const serverInfo = await startLocalServer(db, payload.token)

        // Connect to signaling relay and send phone-ready
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

        // Navigate to web session screen
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
    [db, isProcessing, router]
  )

  // Permission not determined yet
  if (!permission) {
    return (
      <YStack flex={1} backgroundColor="#000000" justifyContent="center" alignItems="center">
        <Spinner size="large" color="#ffffff" />
      </YStack>
    )
  }

  // Permission not granted
  if (!permission.granted) {
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

        <YStack flex={1} justifyContent="center" alignItems="center" padding="$8" gap="$4">
          <Ionicons name="camera-outline" size={64} color="#ffffff" />
          <Text color="#ffffff" fontSize="$5" fontWeight="600" textAlign="center">
            Camera Permission Required
          </Text>
          <Text color="#94a3b8" fontSize="$3" textAlign="center">
            LaterBox needs camera access to scan the QR code from the web client.
          </Text>
          <Button
            size="$4"
            backgroundColor={brandColor}
            borderRadius="$4"
            marginTop="$4"
            onPress={requestPermission}
          >
            <Text color="#ffffff" fontWeight="600">
              Grant Permission
            </Text>
          </Button>
        </YStack>
      </YStack>
    )
  }

  return (
    <YStack flex={1} backgroundColor="#000000">
      {/* Close button */}
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

      {/* Camera */}
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={isProcessing ? undefined : handleBarcodeScanned}
      />

      {/* Overlay */}
      <YStack
        position="absolute"
        bottom={0}
        left={0}
        right={0}
        paddingBottom={insets.bottom + 32}
        paddingHorizontal="$6"
        alignItems="center"
        gap="$3"
      >
        {isProcessing ? (
          <>
            <Spinner size="large" color="#ffffff" />
            <Text color="#ffffff" fontSize="$4" fontWeight="600">
              Connecting...
            </Text>
          </>
        ) : (
          <>
            <Text color="#ffffff" fontSize="$5" fontWeight="600" textAlign="center">
              Scan QR Code
            </Text>
            <Text color="#94a3b8" fontSize="$3" textAlign="center">
              Visit web.laterbox.com and scan the QR code shown there
            </Text>
          </>
        )}

        {error && (
          <YStack
            backgroundColor="rgba(239,68,68,0.9)"
            paddingHorizontal="$4"
            paddingVertical="$3"
            borderRadius="$3"
            marginTop="$2"
          >
            <Text color="#ffffff" fontSize="$3" textAlign="center">
              {error}
            </Text>
          </YStack>
        )}
      </YStack>
    </YStack>
  )
}
