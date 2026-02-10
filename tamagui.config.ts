import { createTamagui, createFont } from 'tamagui'
import { config as defaultConfig } from '@tamagui/config/v3'
import type { AppFont } from '@/services/storage'

const sharedSize = {
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
}

const sharedLineHeight = {
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
}

const sharedLetterSpacing = {
  4: 0,
  5: 0,
  6: -0.2,
  7: -0.3,
  8: -0.4,
  9: -0.5,
}

const fullWeight = {
  4: '400' as const,
  5: '500' as const,
  6: '600' as const,
  7: '700' as const,
  8: '800' as const,
  9: '900' as const,
}

const interFont = createFont({
  family: 'Inter',
  size: sharedSize,
  lineHeight: sharedLineHeight,
  weight: fullWeight,
  letterSpacing: sharedLetterSpacing,
  face: {
    400: { normal: 'Inter' },
    500: { normal: 'InterMedium' },
    600: { normal: 'InterSemiBold' },
    700: { normal: 'InterBold' },
    800: { normal: 'InterExtraBold' },
    900: { normal: 'InterBlack' },
  },
})

const poppinsFont = createFont({
  family: 'Poppins',
  size: sharedSize,
  lineHeight: sharedLineHeight,
  weight: fullWeight,
  letterSpacing: sharedLetterSpacing,
  face: {
    400: { normal: 'Poppins' },
    500: { normal: 'PoppinsMedium' },
    600: { normal: 'PoppinsSemiBold' },
    700: { normal: 'PoppinsBold' },
    800: { normal: 'PoppinsExtraBold' },
    900: { normal: 'PoppinsBlack' },
  },
})

const loraFont = createFont({
  family: 'Lora',
  size: sharedSize,
  lineHeight: sharedLineHeight,
  weight: {
    4: '400',
    5: '500',
    6: '600',
    7: '700',
  },
  letterSpacing: sharedLetterSpacing,
  face: {
    400: { normal: 'Lora' },
    500: { normal: 'LoraMedium' },
    600: { normal: 'LoraSemiBold' },
    700: { normal: 'LoraBold' },
  },
})

const nunitoFont = createFont({
  family: 'Nunito',
  size: sharedSize,
  lineHeight: sharedLineHeight,
  weight: fullWeight,
  letterSpacing: sharedLetterSpacing,
  face: {
    400: { normal: 'Nunito' },
    500: { normal: 'NunitoMedium' },
    600: { normal: 'NunitoSemiBold' },
    700: { normal: 'NunitoBold' },
    800: { normal: 'NunitoExtraBold' },
    900: { normal: 'NunitoBlack' },
  },
})

const jetbrainsMonoFont = createFont({
  family: 'JetBrainsMono',
  size: sharedSize,
  lineHeight: sharedLineHeight,
  weight: {
    4: '400',
    5: '500',
    6: '600',
    7: '700',
    8: '800',
  },
  letterSpacing: sharedLetterSpacing,
  face: {
    400: { normal: 'JetBrainsMono' },
    500: { normal: 'JetBrainsMonoMedium' },
    600: { normal: 'JetBrainsMonoSemiBold' },
    700: { normal: 'JetBrainsMonoBold' },
    800: { normal: 'JetBrainsMonoExtraBold' },
  },
})

const fontMap = {
  inter: interFont,
  poppins: poppinsFont,
  lora: loraFont,
  nunito: nunitoFont,
  'jetbrains-mono': jetbrainsMonoFont,
} as const

const themes = {
  ...defaultConfig.themes,
  light: {
    ...defaultConfig.themes.light,
    // Text colors
    color: '#0f172a',
    colorSubtle: '#64748b',
    colorMuted: '#64748b',
    placeholderColor: '#AEBDCD',
    // Backgrounds
    background: '#ffffff',
    backgroundHover: '#f8fafc',
    backgroundPress: '#f1f5f9',
    backgroundStrong: '#f1f5f9',
    backgroundSubtle: '#f8fafc',
    backgroundTinted: '#F1F9F8',
    // Borders
    borderColor: '#e2e8f0',
    borderColorHover: '#cbd5e1',
    borderColorTinted: '#CDE4E3',
    // Brand
    brandText: '#334155',
    brandBackground: '#E3F2F1',
    brandBackgroundHover: '#CDE4E3',
    // Icon colors
    iconColor: '#64748b',
    iconColorStrong: '#0f172a',
    // Accents
    accentColor: '#839E9D',
    accentColorMuted: '#AFCFCE',
    // Paper view
    paperBackground: 'rgba(250, 249, 246, 0.75)',
    paperText: '#2C2C2C',
    paperBorder: '#E8E6E1',
    successColor: '#22c55e',
    warningColor: '#f59e0b',
    errorColor: '#ef4444',
    infoColor: '#06b6d4',
  },
  dark: {
    ...defaultConfig.themes.dark,
    // Text colors
    color: '#f0f5f4',
    colorSubtle: '#8fa3a1',
    colorMuted: '#b8cac8',
    placeholderColor: '#4a5c5a',
    // Backgrounds
    background: '#0f1917',
    backgroundHover: '#1a2725',
    backgroundPress: '#2d3d3b',
    backgroundStrong: '#1a2725',
    backgroundSubtle: '#1a2725',
    backgroundTinted: '#142E2D',
    // Borders
    borderColor: '#2d3d3b',
    borderColorHover: '#3f5250',
    borderColorTinted: '#1F514F',
    // Brand
    brandText: '#cbd5e1',
    brandBackground: '#1F514F',
    brandBackgroundHover: '#276864',
    // Icon colors
    iconColor: '#8fa3a1',
    iconColorStrong: '#f0f5f4',
    // Accents
    accentColor: '#74D4CE',
    accentColorMuted: '#839E9D',
    // Paper view
    paperBackground: 'rgba(38, 38, 36, 0.75)',
    paperText: '#E8E6E0',
    paperBorder: '#3A3A38',
    successColor: '#4ade80',
    warningColor: '#fbbf24',
    errorColor: '#f87171',
    infoColor: '#22d3ee',
  },
}

export function buildTamaguiConfig(fontKey: AppFont = 'inter') {
  const font = fontMap[fontKey]
  return createTamagui({
    ...defaultConfig,
    fonts: {
      heading: font,
      body: font,
    },
    themes,
  })
}

export const tamaguiConfig = buildTamaguiConfig('inter')

export default tamaguiConfig

export type Conf = typeof tamaguiConfig

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}
}
