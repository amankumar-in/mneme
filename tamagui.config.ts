import { createTamagui, createFont } from 'tamagui'
import { config as defaultConfig } from '@tamagui/config/v3'

const interFont = createFont({
  family: 'Inter',
  size: {
    1: 11,
    2: 12,
    3: 13,
    4: 14,
    5: 16,
    6: 18,
    7: 20,
    8: 24,
    9: 32,
    10: 40,
    11: 48,
    12: 56,
    13: 64,
    14: 72,
    15: 80,
    16: 96,
  },
  lineHeight: {
    1: 15,
    2: 16,
    3: 18,
    4: 20,
    5: 22,
    6: 24,
    7: 26,
    8: 30,
    9: 40,
    10: 48,
    11: 56,
    12: 64,
    13: 72,
    14: 80,
    15: 88,
    16: 104,
  },
  weight: {
    4: '400',
    5: '500',
    6: '600',
    7: '700',
    8: '800',
    9: '900',
  },
  letterSpacing: {
    4: 0,
    5: 0,
    6: -0.2,
    7: -0.3,
    8: -0.4,
    9: -0.5,
  },
  face: {
    400: { normal: 'Inter' },
    500: { normal: 'InterMedium' },
    600: { normal: 'InterSemiBold' },
    700: { normal: 'InterBold' },
    800: { normal: 'InterExtraBold' },
    900: { normal: 'InterBlack' },
  },
})

export const tamaguiConfig = createTamagui({
  ...defaultConfig,
  fonts: {
    heading: interFont,
    body: interFont,
  },
  themes: {
    ...defaultConfig.themes,
    light: {
      ...defaultConfig.themes.light,
      // Text colors
      color: '#0f172a',
      colorSubtle: '#64748b',
      colorMuted: '#64748b',
      placeholderColor: '#94a3b8',
      // Backgrounds
      background: '#ffffff',
      backgroundHover: '#f8fafc',
      backgroundPress: '#f1f5f9',
      backgroundStrong: '#f1f5f9',
      backgroundSubtle: '#f8fafc',
      backgroundTinted: '#eff6ff',
      // Borders
      borderColor: '#e2e8f0',
      borderColorHover: '#cbd5e1',
      borderColorTinted: '#bfdbfe',
      // Brand
      brandText: '#334155',
      brandBackground: '#dbeafe',
      brandBackgroundHover: '#bfdbfe',
      // Icon colors
      iconColor: '#64748b',
      iconColorStrong: '#0f172a',
      // Accents
      accentColor: '#3b82f6',
      accentColorMuted: '#93c5fd',
      successColor: '#22c55e',
      warningColor: '#f59e0b',
      errorColor: '#ef4444',
      infoColor: '#06b6d4',
    },
    dark: {
      ...defaultConfig.themes.dark,
      // Text colors
      color: '#f8fafc',
      colorSubtle: '#94a3b8',
      colorMuted: '#cbd5e1',
      placeholderColor: '#64748b',
      // Backgrounds
      background: '#0f172a',
      backgroundHover: '#1e293b',
      backgroundPress: '#334155',
      backgroundStrong: '#1e293b',
      backgroundSubtle: '#1e293b',
      backgroundTinted: '#172554',
      // Borders
      borderColor: '#334155',
      borderColorHover: '#475569',
      borderColorTinted: '#1e3a8a',
      // Brand
      brandText: '#cbd5e1',
      brandBackground: '#1e3a8a',
      brandBackgroundHover: '#1e40af',
      // Icon colors
      iconColor: '#94a3b8',
      iconColorStrong: '#f8fafc',
      // Accents
      accentColor: '#60a5fa',
      accentColorMuted: '#3b82f6',
      successColor: '#4ade80',
      warningColor: '#fbbf24',
      errorColor: '#f87171',
      infoColor: '#22d3ee',
    },
  },
})

export default tamaguiConfig

export type Conf = typeof tamaguiConfig

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}
}
