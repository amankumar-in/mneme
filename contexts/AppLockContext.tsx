import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import * as Crypto from 'expo-crypto'
import {
  getAppLockEnabled,
  setAppLockEnabled as storeAppLockEnabled,
  getAppLockPinHash,
  setAppLockPinHash as storeAppLockPinHash,
  getAppLockTimeout,
  setAppLockTimeout as storeAppLockTimeout,
} from '@/services/storage'

interface AppLockContextValue {
  isAppLocked: boolean
  isEnabled: boolean
  hasBiometrics: boolean
  hasPin: boolean
  timeout: number
  authenticate: () => Promise<boolean>
  authenticateWithPin: (pin: string) => Promise<boolean>
  lock: () => void
  setEnabled: (enabled: boolean) => Promise<void>
  setPin: (pin: string) => Promise<void>
  removePin: () => Promise<void>
  setTimeout: (seconds: number) => Promise<void>
}

const AppLockContext = createContext<AppLockContextValue | null>(null)

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const [isAppLocked, setIsAppLocked] = useState(false)
  const [isEnabled, setIsEnabledState] = useState(false)
  const [hasBiometrics, setHasBiometrics] = useState(false)
  const [hasPin, setHasPin] = useState(false)
  const [timeout, setTimeoutState] = useState(0)
  const lastBackgroundTime = useRef<number | null>(null)
  const isInitialized = useRef(false)

  // Load stored settings on mount
  useEffect(() => {
    Promise.all([
      getAppLockEnabled(),
      getAppLockPinHash(),
      getAppLockTimeout(),
      LocalAuthentication.hasHardwareAsync(),
    ]).then(([enabled, pinHash, storedTimeout, hardwareAvailable]) => {
      setIsEnabledState(enabled)
      setHasPin(!!pinHash)
      setTimeoutState(storedTimeout)
      setHasBiometrics(hardwareAvailable)
      // Lock on app start if enabled
      if (enabled) {
        setIsAppLocked(true)
      }
      isInitialized.current = true
    })
  }, [])

  // Track app state for auto-lock
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (!isEnabled || !isInitialized.current) return

      if (nextState === 'background' || nextState === 'inactive') {
        lastBackgroundTime.current = Date.now()
      } else if (nextState === 'active' && lastBackgroundTime.current !== null) {
        const elapsed = (Date.now() - lastBackgroundTime.current) / 1000
        if (elapsed >= timeout) {
          setIsAppLocked(true)
        }
        lastBackgroundTime.current = null
      }
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange)
    return () => subscription.remove()
  }, [isEnabled, timeout])

  const authenticate = useCallback(async (): Promise<boolean> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock LaterBox',
        fallbackLabel: 'Use PIN',
        disableDeviceFallback: true,
      })
      if (result.success) {
        setIsAppLocked(false)
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  const authenticateWithPin = useCallback(async (pin: string): Promise<boolean> => {
    const storedHash = await getAppLockPinHash()
    if (!storedHash) return false

    const inputHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      pin
    )

    if (inputHash === storedHash) {
      setIsAppLocked(false)
      return true
    }
    return false
  }, [])

  const lock = useCallback(() => {
    setIsAppLocked(true)
  }, [])

  const setEnabled = useCallback(async (enabled: boolean) => {
    setIsEnabledState(enabled)
    await storeAppLockEnabled(enabled)
    if (!enabled) {
      setIsAppLocked(false)
    }
  }, [])

  const setPin = useCallback(async (pin: string) => {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      pin
    )
    await storeAppLockPinHash(hash)
    setHasPin(true)
  }, [])

  const removePin = useCallback(async () => {
    await storeAppLockPinHash(null)
    setHasPin(false)
  }, [])

  const setTimeoutValue = useCallback(async (seconds: number) => {
    setTimeoutState(seconds)
    await storeAppLockTimeout(seconds)
  }, [])

  const value = useMemo<AppLockContextValue>(
    () => ({
      isAppLocked,
      isEnabled,
      hasBiometrics,
      hasPin,
      timeout,
      authenticate,
      authenticateWithPin,
      lock,
      setEnabled,
      setPin,
      removePin,
      setTimeout: setTimeoutValue,
    }),
    [
      isAppLocked,
      isEnabled,
      hasBiometrics,
      hasPin,
      timeout,
      authenticate,
      authenticateWithPin,
      lock,
      setEnabled,
      setPin,
      removePin,
      setTimeoutValue,
    ]
  )

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>
}

export function useAppLock(): AppLockContextValue {
  const ctx = useContext(AppLockContext)
  if (!ctx) throw new Error('useAppLock must be used within AppLockProvider')
  return ctx
}
