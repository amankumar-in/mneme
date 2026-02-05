import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system'
import { Platform } from 'react-native'
import { DATABASE_NAME } from './database/schema'

const DEVICE_ID_KEY = '@laterbox:deviceId'
const USER_KEY = '@laterbox:user'
const AUTH_TOKEN_KEY = '@laterbox:authToken'
const THEME_KEY = '@laterbox:appTheme'
const SYNC_ENABLED_KEY = '@laterbox:syncEnabled'

export type AppTheme = 'light' | 'dark' | 'system'

export async function getAppTheme(): Promise<AppTheme> {
  const stored = await AsyncStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

export async function setAppTheme(theme: AppTheme): Promise<void> {
  await AsyncStorage.setItem(THEME_KEY, theme)
}

/** Sync enabled preference. Default true when key is missing (backward compat). */
export async function getSyncEnabled(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(SYNC_ENABLED_KEY)
  if (stored === 'false') return false
  return true
}

export async function setSyncEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(SYNC_ENABLED_KEY, enabled ? 'true' : 'false')
}

function generateId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 15)
  const platformPart = Platform.OS.substring(0, 3)
  return `${platformPart}-${timestamp}-${randomPart}`
}

export async function getDeviceId(): Promise<string> {
  let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY)
  if (!deviceId) {
    deviceId = generateId()
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId)
  }
  return deviceId
}

export async function clearDeviceId(): Promise<void> {
  await AsyncStorage.removeItem(DEVICE_ID_KEY)
}

export async function getStoredUser<T>(): Promise<T | null> {
  const userJson = await AsyncStorage.getItem(USER_KEY)
  if (userJson) {
    return JSON.parse(userJson)
  }
  return null
}

export async function setStoredUser<T>(user: T): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user))
}

export async function clearStoredUser(): Promise<void> {
  await AsyncStorage.removeItem(USER_KEY)
}

export async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY)
}

export async function setAuthToken(token: string): Promise<void> {
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, token)
}

export async function clearAuthToken(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY)
}

export async function clearAll(): Promise<void> {
  await AsyncStorage.multiRemove([DEVICE_ID_KEY, USER_KEY, AUTH_TOKEN_KEY, THEME_KEY, SYNC_ENABLED_KEY])
}

/**
 * Factory reset - deletes SQLite database and all AsyncStorage data
 * App must be restarted after calling this
 */
export async function factoryReset(): Promise<void> {
  // Clear all AsyncStorage
  await AsyncStorage.clear()

  // Delete the SQLite database file
  const dbPath = `${FileSystem.documentDirectory}SQLite/${DATABASE_NAME}`
  const dbInfo = await FileSystem.getInfoAsync(dbPath)
  if (dbInfo.exists) {
    await FileSystem.deleteAsync(dbPath, { idempotent: true })
  }

  // Also delete WAL and SHM files if they exist
  const walPath = `${dbPath}-wal`
  const shmPath = `${dbPath}-shm`
  await FileSystem.deleteAsync(walPath, { idempotent: true }).catch(() => {})
  await FileSystem.deleteAsync(shmPath, { idempotent: true }).catch(() => {})
}
