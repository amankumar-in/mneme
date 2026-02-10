import '../tamagui-web.css'

import { useEffect, useMemo } from 'react'
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native'
import { Stack, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { TamaguiProvider, Theme } from 'tamagui'
import { PortalProvider } from '@tamagui/portal'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import Shortcuts from '@rn-org/react-native-shortcuts'
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter'
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  Poppins_900Black,
} from '@expo-google-fonts/poppins'
import {
  Lora_400Regular,
  Lora_500Medium,
  Lora_600SemiBold,
  Lora_700Bold,
} from '@expo-google-fonts/lora'
import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito'
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
  JetBrainsMono_800ExtraBold,
} from '@expo-google-fonts/jetbrains-mono'

import { buildTamaguiConfig } from '../tamagui.config'
import { DatabaseProvider } from '@/contexts/DatabaseContext'
import { ThemeProvider, useAppTheme } from '@/contexts/ThemeContext'
import { FontScaleProvider } from '@/contexts/FontScaleContext'
import { FontFamilyProvider, useAppFont } from '@/contexts/FontFamilyContext'
import { NoteViewProvider } from '@/contexts/NoteViewContext'
import { ThreadViewProvider } from '@/contexts/ThreadViewContext'
import { MinimalModeProvider } from '@/contexts/MinimalModeContext'
import { LinkPreviewProvider } from '@/contexts/LinkPreviewContext'
import { WallpaperProvider } from '@/contexts/WallpaperContext'
import { useShareIntent } from 'expo-share-intent'
import { useInitializeLocalUser } from '@/hooks/useUser'
import { useAutoSync } from '@/hooks/useSyncService'
import { useNotifications } from '@/hooks/useNotifications'
import { useLinkPreviewBackfill } from '@/hooks/useLinkPreviewBackfill'
import { usePurgeOldTrash } from '@/hooks/useTrash'
import { AppLockProvider } from '@/contexts/AppLockContext'
import { EncryptionProvider } from '@/contexts/EncryptionContext'
import { LockScreen } from '@/components/LockScreen'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
})

// Inner component that uses hooks requiring database context
function AppContent() {
  const router = useRouter()
  const initializeLocalUser = useInitializeLocalUser()

  // Auto-sync on app foreground (only syncs if authenticated)
  useAutoSync()

  // Initialize local notifications for task reminders
  useNotifications()

  // Backfill link previews for notes created while offline
  useLinkPreviewBackfill()

  // Auto-purge trash items older than 30 days
  const purgeTrash = usePurgeOldTrash()
  useEffect(() => {
    purgeTrash.mutate(30)
  }, [])

  useEffect(() => {
    // Initialize local user - NO SERVER CALLS
    initializeLocalUser.mutate()
  }, [])

  // Handle share intent (content shared from other apps)
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent()

  useEffect(() => {
    if (hasShareIntent) {
      router.push('/share')
    }
  }, [hasShareIntent, router])

  // Handle shortcut navigation
  useEffect(() => {
    // Handle shortcut that launched the app
    Shortcuts.getInitialShortcutId().then((id) => {
      if (id) {
        router.push(`/thread/${id}`)
      }
    })

    // Handle shortcuts while app is running
    const subscription = Shortcuts.addOnShortcutUsedListener((id) => {
      if (id) {
        router.push(`/thread/${id}`)
      }
    })

    return () => subscription?.remove()
  }, [router])

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <LockScreen />
    </>
  )
}

function ThemedRoot() {
  const { resolvedTheme } = useAppTheme()
  const { fontFamily } = useAppFont()

  const config = useMemo(() => buildTamaguiConfig(fontFamily), [fontFamily])

  return (
    <TamaguiProvider key={fontFamily} config={config} defaultTheme={resolvedTheme}>
      <Theme name={resolvedTheme}>
        <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} translucent />
        <PortalProvider shouldAddRootHost>
          <NavigationThemeProvider value={resolvedTheme === 'dark' ? DarkTheme : DefaultTheme}>
            <AppContent />
          </NavigationThemeProvider>
        </PortalProvider>
      </Theme>
    </TamaguiProvider>
  )
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    // Inter
    Inter: Inter_400Regular,
    InterMedium: Inter_500Medium,
    InterSemiBold: Inter_600SemiBold,
    InterBold: Inter_700Bold,
    InterExtraBold: Inter_800ExtraBold,
    InterBlack: Inter_900Black,
    // Poppins
    Poppins: Poppins_400Regular,
    PoppinsMedium: Poppins_500Medium,
    PoppinsSemiBold: Poppins_600SemiBold,
    PoppinsBold: Poppins_700Bold,
    PoppinsExtraBold: Poppins_800ExtraBold,
    PoppinsBlack: Poppins_900Black,
    // Lora
    Lora: Lora_400Regular,
    LoraMedium: Lora_500Medium,
    LoraSemiBold: Lora_600SemiBold,
    LoraBold: Lora_700Bold,
    // Nunito
    Nunito: Nunito_400Regular,
    NunitoMedium: Nunito_500Medium,
    NunitoSemiBold: Nunito_600SemiBold,
    NunitoBold: Nunito_700Bold,
    NunitoExtraBold: Nunito_800ExtraBold,
    NunitoBlack: Nunito_900Black,
    // JetBrains Mono
    JetBrainsMono: JetBrainsMono_400Regular,
    JetBrainsMonoMedium: JetBrainsMono_500Medium,
    JetBrainsMonoSemiBold: JetBrainsMono_600SemiBold,
    JetBrainsMonoBold: JetBrainsMono_700Bold,
    JetBrainsMonoExtraBold: JetBrainsMono_800ExtraBold,
  })

  if (!fontsLoaded) {
    return null
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <FontFamilyProvider>
              <FontScaleProvider>
                <NoteViewProvider>
                  <ThreadViewProvider>
                    <LinkPreviewProvider>
                      <WallpaperProvider>
                        <DatabaseProvider>
                          <EncryptionProvider>
                            <AppLockProvider>
                              <MinimalModeProvider>
                                <ThemedRoot />
                              </MinimalModeProvider>
                            </AppLockProvider>
                          </EncryptionProvider>
                        </DatabaseProvider>
                      </WallpaperProvider>
                    </LinkPreviewProvider>
                  </ThreadViewProvider>
                </NoteViewProvider>
              </FontScaleProvider>
            </FontFamilyProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
