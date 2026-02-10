import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Text, XStack, YStack } from 'tamagui'

import { useAppLock } from '../contexts/AppLockContext'
import { useThemeColor } from '../hooks/useThemeColor'

const PIN_LENGTH = 4

export function LockScreen() {
  const { isAppLocked, hasBiometrics, hasPin, authenticate, authenticateWithPin } = useAppLock()
  const insets = useSafeAreaInsets()
  const { accentColor, errorColor, brandText } = useThemeColor()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  // Auto-trigger biometric on mount
  useEffect(() => {
    if (isAppLocked && hasBiometrics) {
      authenticate()
    }
  }, [isAppLocked])

  const handlePinDigit = useCallback((digit: string) => {
    setError('')
    const newPin = pin + digit
    setPin(newPin)

    if (newPin.length === PIN_LENGTH) {
      authenticateWithPin(newPin).then((success) => {
        if (!success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          setError('Incorrect PIN')
          setPin('')
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          setPin('')
        }
      })
    }
  }, [pin, authenticateWithPin])

  const handleDelete = useCallback(() => {
    setPin((prev) => prev.slice(0, -1))
    setError('')
  }, [])

  const handleBiometric = useCallback(async () => {
    const success = await authenticate()
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }
  }, [authenticate])

  if (!isAppLocked) return null

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}>
      <YStack
        flex={1}
        backgroundColor="$background"
        justifyContent="center"
        alignItems="center"
        paddingTop={insets.top}
        paddingBottom={insets.bottom}
      >
        {/* Logo area */}
        <YStack alignItems="center" marginBottom="$8">
          <YStack
            width={80}
            height={80}
            borderRadius={40}
            backgroundColor="$brandBackground"
            alignItems="center"
            justifyContent="center"
            marginBottom="$4"
          >
            <Ionicons name="lock-closed" size={36} color={brandText} />
          </YStack>
          <Text fontSize="$6" fontWeight="700" color="$color">
            LaterBox is Locked
          </Text>
          <Text fontSize="$3" color="$colorSubtle" marginTop="$2">
            {hasPin ? 'Enter your PIN or use biometrics' : 'Authenticate to continue'}
          </Text>
        </YStack>

        {/* PIN dots */}
        {hasPin && (
          <XStack gap="$4" marginBottom="$6">
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <YStack
                key={i}
                width={16}
                height={16}
                borderRadius={8}
                backgroundColor={i < pin.length ? '$accentColor' : '$borderColor'}
              />
            ))}
          </XStack>
        )}

        {error ? (
          <Text color="$errorColor" fontSize="$3" marginBottom="$4">
            {error}
          </Text>
        ) : null}

        {/* Number pad — always visible when user has a PIN */}
        {hasPin && (
          <YStack gap="$3" width={280}>
            {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'delete']].map(
              (row, rowIndex) => (
                <XStack key={rowIndex} justifyContent="space-around">
                  {row.map((digit) => {
                    if (digit === '') {
                      if (hasBiometrics) {
                        return (
                          <Button
                            key="biometric"
                            size="$6"
                            circular
                            chromeless
                            onPress={handleBiometric}
                            icon={
                              <Ionicons name="finger-print-outline" size={28} color={accentColor} />
                            }
                          />
                        )
                      }
                      return <YStack key="empty" width={60} height={60} />
                    }
                    if (digit === 'delete') {
                      return (
                        <Button
                          key="delete"
                          size="$6"
                          circular
                          chromeless
                          onPress={handleDelete}
                          disabled={pin.length === 0}
                          opacity={pin.length === 0 ? 0.3 : 1}
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
        )}

        {/* Biometric-only fallback (no PIN set) */}
        {!hasPin && hasBiometrics && (
          <Button
            backgroundColor="$brandBackground"
            borderRadius="$4"
            paddingHorizontal="$6"
            height={48}
            onPress={handleBiometric}
          >
            <XStack alignItems="center" gap="$2">
              <Ionicons name="finger-print-outline" size={22} color={brandText} />
              <Text color={brandText} fontWeight="600">
                Unlock with Biometrics
              </Text>
            </XStack>
          </Button>
        )}
      </YStack>
    </View>
  )
}
