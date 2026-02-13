import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system'
import { Platform } from 'react-native'
import { DATABASE_NAME } from './database/schema'

const DEVICE_ID_KEY = '@laterbox:deviceId'
const USER_KEY = '@laterbox:user'
const AUTH_TOKEN_KEY = '@laterbox:authToken'
const THEME_KEY = '@laterbox:appTheme'
const SYNC_ENABLED_KEY = '@laterbox:syncEnabled'
const NOTE_FONT_SCALE_KEY = '@laterbox:noteFontScale'
const NOTE_VIEW_STYLE_KEY = '@laterbox:noteViewStyle'
const APP_FONT_KEY = '@laterbox:appFont'
const THREAD_VIEW_STYLE_KEY = '@laterbox:threadViewStyle'
const MINIMAL_MODE_KEY = '@laterbox:minimalMode'
const MINIMAL_MODE_THREAD_ID_KEY = '@laterbox:minimalModeThreadId'
const LINK_PREVIEW_MODE_KEY = '@laterbox:linkPreviewMode'
const HOME_WALLPAPER_KEY = '@laterbox:homeWallpaper'
const HOME_WALLPAPER_OVERLAY_KEY = '@laterbox:homeWallpaperOverlay'
const HOME_WALLPAPER_OPACITY_KEY = '@laterbox:homeWallpaperOpacity'
const THREAD_WALLPAPER_KEY = '@laterbox:threadWallpaper'
const THREAD_WALLPAPER_OVERLAY_KEY = '@laterbox:threadWallpaperOverlay'
const THREAD_WALLPAPER_OPACITY_KEY = '@laterbox:threadWallpaperOpacity'
const APP_LOCK_ENABLED_KEY = '@laterbox:appLockEnabled'
const APP_LOCK_PIN_HASH_KEY = '@laterbox:appLockPinHash'
const APP_LOCK_TIMEOUT_KEY = '@laterbox:appLockTimeout'
const ENCRYPTION_SALT_KEY = '@laterbox:encryptionSalt'
const ENCRYPTION_ENABLED_KEY = '@laterbox:encryptionEnabled'
const WEB_SESSION_KEY = '@laterbox:webSession'
const WEB_SERVER_PORT_KEY = '@laterbox:webServerPort'

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

export const FONT_SCALE_STEPS = [0.85, 0.92, 1.0, 1.15, 1.3] as const
export type FontScale = (typeof FONT_SCALE_STEPS)[number]
const DEFAULT_FONT_SCALE: FontScale = 1.0

export async function getNoteFontScale(): Promise<FontScale> {
  const stored = await AsyncStorage.getItem(NOTE_FONT_SCALE_KEY)
  if (stored) {
    const parsed = parseFloat(stored)
    if (FONT_SCALE_STEPS.includes(parsed as FontScale)) return parsed as FontScale
  }
  return DEFAULT_FONT_SCALE
}

export async function setNoteFontScale(scale: FontScale): Promise<void> {
  await AsyncStorage.setItem(NOTE_FONT_SCALE_KEY, String(scale))
}

export type NoteViewStyle = 'bubble' | 'paper'

export async function getNoteViewStyle(): Promise<NoteViewStyle> {
  const stored = await AsyncStorage.getItem(NOTE_VIEW_STYLE_KEY)
  if (stored === 'bubble' || stored === 'paper') return stored
  return 'bubble'
}

export async function setNoteViewStyle(style: NoteViewStyle): Promise<void> {
  await AsyncStorage.setItem(NOTE_VIEW_STYLE_KEY, style)
}

export type AppFont = 'inter' | 'poppins' | 'lora' | 'nunito' | 'jetbrains-mono'

const VALID_FONTS: AppFont[] = ['inter', 'poppins', 'lora', 'nunito', 'jetbrains-mono']

export async function getAppFont(): Promise<AppFont> {
  const stored = await AsyncStorage.getItem(APP_FONT_KEY)
  if (stored && VALID_FONTS.includes(stored as AppFont)) return stored as AppFont
  return 'inter'
}

export async function setAppFont(font: AppFont): Promise<void> {
  await AsyncStorage.setItem(APP_FONT_KEY, font)
}

export type ThreadViewStyle = 'list' | 'icons'

export async function getThreadViewStyle(): Promise<ThreadViewStyle> {
  const stored = await AsyncStorage.getItem(THREAD_VIEW_STYLE_KEY)
  if (stored === 'list' || stored === 'icons') return stored
  return 'list'
}

export async function setThreadViewStyle(style: ThreadViewStyle): Promise<void> {
  await AsyncStorage.setItem(THREAD_VIEW_STYLE_KEY, style)
}

export async function getMinimalMode(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(MINIMAL_MODE_KEY)
  return stored === 'true'
}

export async function setMinimalMode(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(MINIMAL_MODE_KEY, enabled ? 'true' : 'false')
}

export async function getMinimalModeThreadId(): Promise<string | null> {
  return AsyncStorage.getItem(MINIMAL_MODE_THREAD_ID_KEY)
}

export async function setMinimalModeThreadId(id: string | null): Promise<void> {
  if (id) {
    await AsyncStorage.setItem(MINIMAL_MODE_THREAD_ID_KEY, id)
  } else {
    await AsyncStorage.removeItem(MINIMAL_MODE_THREAD_ID_KEY)
  }
}

export type LinkPreviewMode = 'off' | 'text' | 'text+image'

const VALID_LINK_PREVIEW_MODES: LinkPreviewMode[] = ['off', 'text', 'text+image']

export async function getLinkPreviewMode(): Promise<LinkPreviewMode> {
  const stored = await AsyncStorage.getItem(LINK_PREVIEW_MODE_KEY)
  if (stored && VALID_LINK_PREVIEW_MODES.includes(stored as LinkPreviewMode)) return stored as LinkPreviewMode
  return 'text+image'
}

export async function setLinkPreviewMode(mode: LinkPreviewMode): Promise<void> {
  await AsyncStorage.setItem(LINK_PREVIEW_MODE_KEY, mode)
}

export type WallpaperImage = null | number // 1..26
export type WallpaperOverlay = null | string // color key e.g. 'red', 'blue', 'neutral'
export type WallpaperOpacity = number // 30-90, default 50

export async function getHomeWallpaper(): Promise<WallpaperImage> {
  const stored = await AsyncStorage.getItem(HOME_WALLPAPER_KEY)
  if (stored) {
    const parsed = parseInt(stored, 10)
    if (parsed >= 1 && parsed <= 16) return parsed
  }
  return null
}

export async function setHomeWallpaper(value: WallpaperImage): Promise<void> {
  if (value === null) {
    await AsyncStorage.removeItem(HOME_WALLPAPER_KEY)
  } else {
    await AsyncStorage.setItem(HOME_WALLPAPER_KEY, String(value))
  }
}

export async function getHomeWallpaperOverlay(): Promise<WallpaperOverlay> {
  return (await AsyncStorage.getItem(HOME_WALLPAPER_OVERLAY_KEY)) ?? 'neutral'
}

export async function setHomeWallpaperOverlay(value: WallpaperOverlay): Promise<void> {
  if (value === null) {
    await AsyncStorage.removeItem(HOME_WALLPAPER_OVERLAY_KEY)
  } else {
    await AsyncStorage.setItem(HOME_WALLPAPER_OVERLAY_KEY, value)
  }
}

export async function getHomeWallpaperOpacity(): Promise<WallpaperOpacity> {
  const stored = await AsyncStorage.getItem(HOME_WALLPAPER_OPACITY_KEY)
  if (stored) {
    const parsed = parseInt(stored, 10)
    if (parsed >= 30 && parsed <= 90) return parsed
  }
  return 70
}

export async function setHomeWallpaperOpacity(value: WallpaperOpacity): Promise<void> {
  await AsyncStorage.setItem(HOME_WALLPAPER_OPACITY_KEY, String(value))
}

export async function getThreadWallpaper(): Promise<WallpaperImage> {
  const stored = await AsyncStorage.getItem(THREAD_WALLPAPER_KEY)
  if (stored) {
    const parsed = parseInt(stored, 10)
    if (parsed >= 1 && parsed <= 16) return parsed
  }
  return null
}

export async function setThreadWallpaper(value: WallpaperImage): Promise<void> {
  if (value === null) {
    await AsyncStorage.removeItem(THREAD_WALLPAPER_KEY)
  } else {
    await AsyncStorage.setItem(THREAD_WALLPAPER_KEY, String(value))
  }
}

export async function getThreadWallpaperOverlay(): Promise<WallpaperOverlay> {
  return (await AsyncStorage.getItem(THREAD_WALLPAPER_OVERLAY_KEY)) ?? 'neutral'
}

export async function setThreadWallpaperOverlay(value: WallpaperOverlay): Promise<void> {
  if (value === null) {
    await AsyncStorage.removeItem(THREAD_WALLPAPER_OVERLAY_KEY)
  } else {
    await AsyncStorage.setItem(THREAD_WALLPAPER_OVERLAY_KEY, value)
  }
}

export async function getThreadWallpaperOpacity(): Promise<WallpaperOpacity> {
  const stored = await AsyncStorage.getItem(THREAD_WALLPAPER_OPACITY_KEY)
  if (stored) {
    const parsed = parseInt(stored, 10)
    if (parsed >= 30 && parsed <= 90) return parsed
  }
  return 70
}

export async function setThreadWallpaperOpacity(value: WallpaperOpacity): Promise<void> {
  await AsyncStorage.setItem(THREAD_WALLPAPER_OPACITY_KEY, String(value))
}

// App Lock
export async function getAppLockEnabled(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(APP_LOCK_ENABLED_KEY)
  return stored === 'true'
}

export async function setAppLockEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(APP_LOCK_ENABLED_KEY, enabled ? 'true' : 'false')
}

export async function getAppLockPinHash(): Promise<string | null> {
  return AsyncStorage.getItem(APP_LOCK_PIN_HASH_KEY)
}

export async function setAppLockPinHash(hash: string | null): Promise<void> {
  if (hash) {
    await AsyncStorage.setItem(APP_LOCK_PIN_HASH_KEY, hash)
  } else {
    await AsyncStorage.removeItem(APP_LOCK_PIN_HASH_KEY)
  }
}

export async function getAppLockTimeout(): Promise<number> {
  const stored = await AsyncStorage.getItem(APP_LOCK_TIMEOUT_KEY)
  if (stored) {
    const parsed = parseInt(stored, 10)
    if (!isNaN(parsed) && parsed >= 0) return parsed
  }
  return 0 // immediate
}

export async function setAppLockTimeout(seconds: number): Promise<void> {
  await AsyncStorage.setItem(APP_LOCK_TIMEOUT_KEY, String(seconds))
}

// Encryption
export async function getEncryptionSalt(): Promise<string | null> {
  return AsyncStorage.getItem(ENCRYPTION_SALT_KEY)
}

export async function setEncryptionSalt(salt: string | null): Promise<void> {
  if (salt) {
    await AsyncStorage.setItem(ENCRYPTION_SALT_KEY, salt)
  } else {
    await AsyncStorage.removeItem(ENCRYPTION_SALT_KEY)
  }
}

export async function getEncryptionEnabled(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(ENCRYPTION_ENABLED_KEY)
  return stored === 'true'
}

export async function setEncryptionEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(ENCRYPTION_ENABLED_KEY, enabled ? 'true' : 'false')
}

// Web Session persistence (30-day auto-reconnect)
export interface WebSessionData {
  token: string
  port: number
  createdAt: number
}

export async function getWebSession(): Promise<WebSessionData | null> {
  const stored = await AsyncStorage.getItem(WEB_SESSION_KEY)
  if (!stored) return null
  try {
    const data = JSON.parse(stored)
    if (data.token && data.port && data.createdAt) return data
  } catch {}
  return null
}

export async function setWebSession(token: string, port: number): Promise<void> {
  await AsyncStorage.setItem(
    WEB_SESSION_KEY,
    JSON.stringify({ token, port, createdAt: Date.now() })
  )
  // Persist port separately so it survives disconnect
  await AsyncStorage.setItem(WEB_SERVER_PORT_KEY, String(port))
}

export async function clearWebSession(): Promise<void> {
  await AsyncStorage.removeItem(WEB_SESSION_KEY)
  // Keep WEB_SERVER_PORT_KEY — port is reused across sessions
}

export async function getSavedWebServerPort(): Promise<number | null> {
  const stored = await AsyncStorage.getItem(WEB_SERVER_PORT_KEY)
  if (stored) {
    const port = parseInt(stored, 10)
    if (port >= 1024 && port <= 65535) return port
  }
  return null
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
  await AsyncStorage.multiRemove([DEVICE_ID_KEY, USER_KEY, AUTH_TOKEN_KEY, THEME_KEY, SYNC_ENABLED_KEY, NOTE_FONT_SCALE_KEY, NOTE_VIEW_STYLE_KEY, APP_FONT_KEY, THREAD_VIEW_STYLE_KEY, MINIMAL_MODE_KEY, MINIMAL_MODE_THREAD_ID_KEY, LINK_PREVIEW_MODE_KEY, HOME_WALLPAPER_KEY, HOME_WALLPAPER_OVERLAY_KEY, HOME_WALLPAPER_OPACITY_KEY, THREAD_WALLPAPER_KEY, THREAD_WALLPAPER_OVERLAY_KEY, THREAD_WALLPAPER_OPACITY_KEY, APP_LOCK_ENABLED_KEY, APP_LOCK_PIN_HASH_KEY, APP_LOCK_TIMEOUT_KEY, ENCRYPTION_SALT_KEY, ENCRYPTION_ENABLED_KEY, WEB_SESSION_KEY])
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
