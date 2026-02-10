import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Alert, Switch } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, ScrollView, Text, XStack, YStack } from 'tamagui'

import { ScreenBackground } from '../../components/ScreenBackground'
import { useAppLock } from '../../contexts/AppLockContext'
import { useThemeColor } from '../../hooks/useThemeColor'

const TIMEOUT_OPTIONS = [
  { label: 'Immediately', value: 0 },
  { label: '15 seconds', value: 15 },
  { label: '30 seconds', value: 30 },
  { label: '1 minute', value: 60 },
  { label: '5 minutes', value: 300 },
]

const PIN_LENGTH = 4

export default function AppLockScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { iconColorStrong, iconColor, accentColor, successColor } = useThemeColor()
  const {
    isEnabled,
    hasBiometrics,
    hasPin,
    timeout,
    authenticate,
    setEnabled,
    setPin,
    removePin,
    setTimeout,
  } = useAppLock()

  const [authenticated, setAuthenticated] = useState(!isEnabled)
  const [showSetPin, setShowSetPin] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinStep, setPinStep] = useState<'enter' | 'confirm'>('enter')
  const [pinError, setPinError] = useState('')

  // Require authentication on mount when app lock is enabled
  useEffect(() => {
    if (isEnabled) {
      authenticate().then((success) => {
        if (success) {
          setAuthenticated(true)
        } else {
          router.back()
        }
      })
    }
  }, [])

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  const [enableAfterPin, setEnableAfterPin] = useState(false)

  const handleToggleEnabled = useCallback(async (value: boolean) => {
    if (value && !hasPin) {
      // Always require a fallback PIN when enabling app lock
      setEnableAfterPin(true)
      setShowSetPin(true)
      setNewPin('')
      setConfirmPin('')
      setPinStep('enter')
      setPinError('')
      return
    }
    await setEnabled(value)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  }, [hasPin, setEnabled])

  const handleSetPin = useCallback(() => {
    setShowSetPin(true)
    setNewPin('')
    setConfirmPin('')
    setPinStep('enter')
    setPinError('')
  }, [])

  const handleRemovePin = useCallback(() => {
    Alert.alert(
      'Remove PIN',
      'Are you sure you want to remove your PIN?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removePin()
            if (!hasBiometrics) {
              await setEnabled(false)
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          },
        },
      ]
    )
  }, [removePin, hasBiometrics, setEnabled])

  const handlePinDigit = useCallback((digit: string) => {
    setPinError('')
    if (pinStep === 'enter') {
      const next = newPin + digit
      setNewPin(next)
      if (next.length === PIN_LENGTH) {
        setPinStep('confirm')
      }
    } else {
      const next = confirmPin + digit
      setConfirmPin(next)
      if (next.length === PIN_LENGTH) {
        if (next === newPin) {
          setPin(next).then(() => {
            setShowSetPin(false)
            setNewPin('')
            setConfirmPin('')
            setPinStep('enter')
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            if (enableAfterPin) {
              setEnabled(true)
              setEnableAfterPin(false)
            }
          })
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          setPinError('PINs do not match')
          setConfirmPin('')
        }
      }
    }
  }, [pinStep, newPin, confirmPin, setPin, enableAfterPin, setEnabled])

  const handlePinDelete = useCallback(() => {
    setPinError('')
    if (pinStep === 'enter') {
      setNewPin((prev) => prev.slice(0, -1))
    } else {
      setConfirmPin((prev) => prev.slice(0, -1))
    }
  }, [pinStep])

  const handleCancelSetPin = useCallback(() => {
    setShowSetPin(false)
    setNewPin('')
    setConfirmPin('')
    setPinStep('enter')
    setPinError('')
    setEnableAfterPin(false)
  }, [])

  if (!authenticated) {
    return (
      <ScreenBackground>
        <YStack flex={1} justifyContent="center" alignItems="center" gap="$4">
          <Ionicons name="lock-closed" size={48} color={iconColor} />
          <Text fontSize="$4" color="$colorSubtle">
            Authenticate to access settings
          </Text>
          <Button
            size="$4"
            backgroundColor="$accentColor"
            borderRadius="$4"
            onPress={async () => {
              const success = await authenticate()
              if (success) {
                setAuthenticated(true)
              } else {
                router.back()
              }
            }}
          >
            <Text color="white" fontWeight="600">Try Again</Text>
          </Button>
        </YStack>
      </ScreenBackground>
    )
  }

  if (showSetPin) {
    const currentPin = pinStep === 'enter' ? newPin : confirmPin
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
            onPress={handleCancelSetPin}
            icon={<Ionicons name="close" size={24} color={iconColorStrong} />}
          />
          <Text fontSize="$6" fontWeight="700" flex={1} color="$color">
            {pinStep === 'enter' ? 'Set LaterBox PIN' : 'Confirm PIN'}
          </Text>
        </XStack>

        <YStack flex={1} justifyContent="center" alignItems="center">
          <Text fontSize="$4" color="$colorSubtle" marginBottom="$2" textAlign="center">
            {pinStep === 'enter'
              ? 'Choose a 4-digit PIN for LaterBox'
              : 'Re-enter your PIN to confirm'}
          </Text>
          <Text fontSize="$2" color="$colorMuted" marginBottom="$6" textAlign="center" paddingHorizontal="$6">
            {pinStep === 'enter'
              ? 'This PIN is used to unlock the app when biometrics are unavailable'
              : ''}
          </Text>

          <XStack gap="$4" marginBottom="$6">
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <YStack
                key={i}
                width={16}
                height={16}
                borderRadius={8}
                backgroundColor={i < currentPin.length ? '$accentColor' : '$borderColor'}
              />
            ))}
          </XStack>

          {pinError ? (
            <Text color="$errorColor" fontSize="$3" marginBottom="$4">
              {pinError}
            </Text>
          ) : null}

          <YStack gap="$3" width={280}>
            {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'delete']].map(
              (row, rowIndex) => (
                <XStack key={rowIndex} justifyContent="space-around">
                  {row.map((digit) => {
                    if (digit === '') {
                      return <YStack key="empty" width={60} height={60} />
                    }
                    if (digit === 'delete') {
                      return (
                        <Button
                          key="delete"
                          size="$6"
                          circular
                          chromeless
                          onPress={handlePinDelete}
                          disabled={currentPin.length === 0}
                          opacity={currentPin.length === 0 ? 0.3 : 1}
                          icon={
                            <Ionicons name="backspace-outline" size={24} color={accentColor} />
                          }
                        />
                      )
                    }
                    return (
                      <Button
                        key={digit}
                        size="$6"
                        circular
                        backgroundColor="$backgroundStrong"
                        onPress={() => handlePinDigit(digit)}
                      >
                        <Text fontSize="$7" fontWeight="600" color="$color">
                          {digit}
                        </Text>
                      </Button>
                    )
                  })}
                </XStack>
              )
            )}
          </YStack>
        </YStack>
      </ScreenBackground>
    )
  }

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
          icon={<Ionicons name="arrow-back" size={24} color={iconColorStrong} />}
        />
        <Text fontSize="$6" fontWeight="700" flex={1} color="$color">
          App Lock
        </Text>
      </XStack>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        {/* Enable/Disable */}
        <XStack
          paddingHorizontal="$4"
          paddingVertical="$3"
          gap="$3"
          alignItems="center"
        >
          <XStack
            width={36}
            height={36}
            borderRadius="$2"
            backgroundColor="$backgroundStrong"
            alignItems="center"
            justifyContent="center"
          >
            <Ionicons name="lock-closed-outline" size={20} color={accentColor} />
          </XStack>
          <YStack flex={1}>
            <Text fontSize="$4" color="$color">
              App Lock
            </Text>
            <Text fontSize="$2" color="$colorSubtle">
              Require authentication to open the app
            </Text>
          </YStack>
          <Switch
            value={isEnabled}
            onValueChange={handleToggleEnabled}
            trackColor={{ false: '#767577', true: accentColor }}
            thumbColor="white"
          />
        </XStack>

        {/* Biometrics info */}
        {hasBiometrics && (
          <XStack
            paddingHorizontal="$4"
            paddingVertical="$3"
            gap="$3"
            alignItems="center"
          >
            <XStack
              width={36}
              height={36}
              borderRadius="$2"
              backgroundColor="$backgroundStrong"
              alignItems="center"
              justifyContent="center"
            >
              <Ionicons name="finger-print-outline" size={20} color={successColor} />
            </XStack>
            <YStack flex={1}>
              <Text fontSize="$4" color="$color">
                Biometric Authentication
              </Text>
              <Text fontSize="$2" color="$colorSubtle">
                Face ID / Touch ID available
              </Text>
            </YStack>
            <Ionicons name="checkmark-circle" size={22} color={successColor} />
          </XStack>
        )}

        {/* PIN */}
        <XStack
          paddingHorizontal="$4"
          paddingVertical="$3"
          gap="$3"
          alignItems="center"
          pressStyle={{ backgroundColor: '$backgroundHover' }}
          onPress={hasPin ? handleRemovePin : handleSetPin}
        >
          <XStack
            width={36}
            height={36}
            borderRadius="$2"
            backgroundColor="$backgroundStrong"
            alignItems="center"
            justifyContent="center"
          >
            <Ionicons name="keypad-outline" size={20} color={accentColor} />
          </XStack>
          <YStack flex={1}>
            <Text fontSize="$4" color="$color">
              {hasPin ? 'Change PIN' : 'Set PIN'}
            </Text>
            <Text fontSize="$2" color="$colorSubtle">
              {hasPin ? 'PIN is set' : '4-digit PIN as fallback'}
            </Text>
          </YStack>
          <Ionicons name="chevron-forward" size={20} color={iconColor} />
        </XStack>

        {/* Auto-lock timeout */}
        <Text
          fontSize="$2"
          fontWeight="600"
          color="$colorSubtle"
          paddingHorizontal="$4"
          paddingTop="$4"
          paddingBottom="$2"
          textTransform="uppercase"
        >
          Auto-Lock
        </Text>

        {TIMEOUT_OPTIONS.map((option) => (
          <XStack
            key={option.value}
            paddingHorizontal="$4"
            paddingVertical="$3"
            gap="$3"
            alignItems="center"
            pressStyle={{ backgroundColor: '$backgroundHover' }}
            onPress={() => {
              setTimeout(option.value)
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            }}
          >
            <Text fontSize="$4" color="$color" flex={1}>
              {option.label}
            </Text>
            {timeout === option.value && (
              <Ionicons name="checkmark" size={20} color={accentColor} />
            )}
          </XStack>
        ))}

        <Text
          fontSize="$2"
          color="$colorMuted"
          paddingHorizontal="$4"
          paddingTop="$2"
        >
          How long after going to the background before the app locks
        </Text>
      </ScrollView>
    </ScreenBackground>
  )
}
