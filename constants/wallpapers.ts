import { ImageSourcePropType } from 'react-native'

export const WALLPAPERS: Record<number, ImageSourcePropType> = {
  1: require('../assets/wallpapers/wallpaper1.jpg'),
  2: require('../assets/wallpapers/wallpaper2.jpg'),
  3: require('../assets/wallpapers/wallpaper3.jpg'),
  4: require('../assets/wallpapers/wallpaper4.jpg'),
  5: require('../assets/wallpapers/wallpaper5.jpg'),
  6: require('../assets/wallpapers/wallpaper6.jpg'),
  7: require('../assets/wallpapers/wallpaper7.jpg'),
  8: require('../assets/wallpapers/wallpaper8.jpg'),
  9: require('../assets/wallpapers/wallpaper9.jpg'),
  10: require('../assets/wallpapers/wallpaper10.jpg'),
  11: require('../assets/wallpapers/wallpaper11.jpg'),
  12: require('../assets/wallpapers/wallpaper12.jpg'),
  13: require('../assets/wallpapers/wallpaper13.jpg'),
  14: require('../assets/wallpapers/wallpaper14.jpg'),
  15: require('../assets/wallpapers/wallpaper15.jpg'),
  16: require('../assets/wallpapers/wallpaper16.jpg'),
}

export const WALLPAPER_COUNT = 16

// Overlay color definitions — keys stored in AsyncStorage, resolved to hex at render time
export const OVERLAY_COLOR_OPTIONS: { key: string | null; label: string }[] = [
  { key: null, label: 'None' },
  { key: 'neutral', label: 'Neutral' },
  { key: 'red', label: 'Red' },
  { key: 'blue', label: 'Blue' },
  { key: 'green', label: 'Green' },
  { key: 'yellow', label: 'Yellow' },
  { key: 'purple', label: 'Purple' },
  { key: 'orange', label: 'Orange' },
]

// Light = pastel (dark text readable), Dark = deep (light text readable)
const OVERLAY_HEX: Record<string, { light: string; dark: string }> = {
  neutral: { light: '#f5f5f5', dark: '#171717' },
  red: { light: '#fecaca', dark: '#450a0a' },
  blue: { light: '#bfdbfe', dark: '#172554' },
  green: { light: '#bbf7d0', dark: '#052e16' },
  yellow: { light: '#fef08a', dark: '#422006' },
  purple: { light: '#e9d5ff', dark: '#3b0764' },
  orange: { light: '#fed7aa', dark: '#431407' },
}

/** Resolve a stored overlay key to the appropriate hex for the current theme */
export function resolveOverlayHex(key: string | null, isDark: boolean): string | null {
  if (!key) return null
  const entry = OVERLAY_HEX[key]
  if (!entry) return null
  return isDark ? entry.dark : entry.light
}

/** Get the swatch display color for the settings screen */
export function getOverlaySwatchColor(key: string | null, isDark: boolean): string | null {
  return resolveOverlayHex(key, isDark)
}
