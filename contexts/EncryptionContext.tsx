import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  getEncryptionEnabled,
  setEncryptionEnabled as storeEncryptionEnabled,
  getEncryptionSalt,
  setEncryptionSalt as storeEncryptionSalt,
  getAuthToken,
} from '@/services/storage'
import { generateSalt, deriveKey, encrypt, decrypt } from '@/services/crypto/encryption'

interface EncryptionContextValue {
  isEnabled: boolean
  hasKey: boolean
  encryptField: (plaintext: string) => string | null
  decryptField: (ciphertext: string) => string | null
  enable: (password: string) => Promise<void>
  disable: () => Promise<void>
  initWithPassword: (password: string) => Promise<void>
  clearKey: () => void
}

const EncryptionContext = createContext<EncryptionContextValue | null>(null)

export function EncryptionProvider({ children }: { children: React.ReactNode }) {
  const [isEnabled, setIsEnabled] = useState(false)
  const keyRef = useRef<Buffer | null>(null)

  useEffect(() => {
    getEncryptionEnabled().then(setIsEnabled)
  }, [])

  const encryptField = useCallback((plaintext: string): string | null => {
    if (!keyRef.current) return null
    try {
      return encrypt(plaintext, keyRef.current)
    } catch {
      return null
    }
  }, [])

  const decryptField = useCallback((ciphertext: string): string | null => {
    if (!keyRef.current) return null
    try {
      return decrypt(ciphertext, keyRef.current)
    } catch {
      return null
    }
  }, [])

  const enable = useCallback(async (password: string) => {
    let salt = await getEncryptionSalt()
    if (!salt) {
      salt = generateSalt()
      await storeEncryptionSalt(salt)
    }
    keyRef.current = await deriveKey(password, salt)
    setIsEnabled(true)
    await storeEncryptionEnabled(true)
  }, [])

  const disable = useCallback(async () => {
    keyRef.current = null
    setIsEnabled(false)
    await storeEncryptionEnabled(false)
  }, [])

  const initWithPassword = useCallback(async (password: string) => {
    const enabled = await getEncryptionEnabled()
    if (!enabled) return

    const salt = await getEncryptionSalt()
    if (!salt) return

    keyRef.current = await deriveKey(password, salt)
  }, [])

  const clearKey = useCallback(() => {
    keyRef.current = null
  }, [])

  const value = useMemo<EncryptionContextValue>(
    () => ({
      isEnabled,
      hasKey: !!keyRef.current,
      encryptField,
      decryptField,
      enable,
      disable,
      initWithPassword,
      clearKey,
    }),
    [isEnabled, encryptField, decryptField, enable, disable, initWithPassword, clearKey]
  )

  return <EncryptionContext.Provider value={value}>{children}</EncryptionContext.Provider>
}

export function useEncryption(): EncryptionContextValue {
  const ctx = useContext(EncryptionContext)
  if (!ctx) throw new Error('useEncryption must be used within EncryptionProvider')
  return ctx
}
