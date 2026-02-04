import '../tamagui-web.css'

import { useEffect } from 'react'
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import { Stack, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from 'react-native'
import { TamaguiProvider } from 'tamagui'
import { PortalProvider } from '@tamagui/portal'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
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

import { tamaguiConfig } from '../tamagui.config'
import { DatabaseProvider } from '@/contexts/DatabaseContext'
import { useInitializeLocalUser } from '@/hooks/useUser'
import { useAutoSync } from '@/hooks/useSyncService'

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

  useEffect(() => {
    // Initialize local user - NO SERVER CALLS
    initializeLocalUser.mutate()
  }, [])

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
      <StatusBar style="auto" translucent />
    </>
  )
}

export default function RootLayout() {
  const colorScheme = useColorScheme()

  const [fontsLoaded] = useFonts({
    Inter: Inter_400Regular,
    InterMedium: Inter_500Medium,
    InterSemiBold: Inter_600SemiBold,
    InterBold: Inter_700Bold,
    InterExtraBold: Inter_800ExtraBold,
    InterBlack: Inter_900Black,
  })

  const theme = colorScheme || 'light'

  if (!fontsLoaded) {
    return null
  }

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <TamaguiProvider config={tamaguiConfig} defaultTheme={theme}>
            <PortalProvider shouldAddRootHost>
              <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <DatabaseProvider>
                  <AppContent />
                </DatabaseProvider>
              </ThemeProvider>
            </PortalProvider>
          </TamaguiProvider>
        </QueryClientProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  )
}
