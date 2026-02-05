import '../tamagui-web.css'

import { useEffect } from 'react'
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native'
import { Stack, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from 'react-native'
import { TamaguiProvider, Theme } from 'tamagui'
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
import { ThemeProvider, useAppTheme } from '@/contexts/ThemeContext'
import { useInitializeLocalUser } from '@/hooks/useUser'
import { useAutoSync } from '@/hooks/useSyncService'
import { useNotifications } from '@/hooks/useNotifications'

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

  return <Stack screenOptions={{ headerShown: false }} />
}

function ThemedRoot() {
  const { resolvedTheme } = useAppTheme()

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={resolvedTheme}>
      <Theme name={resolvedTheme}>
        <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} translucent />
        <PortalProvider shouldAddRootHost>
          <NavigationThemeProvider value={resolvedTheme === 'dark' ? DarkTheme : DefaultTheme}>
            <DatabaseProvider>
              <AppContent />
            </DatabaseProvider>
          </NavigationThemeProvider>
        </PortalProvider>
      </Theme>
    </TamaguiProvider>
  )
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter: Inter_400Regular,
    InterMedium: Inter_500Medium,
    InterSemiBold: Inter_600SemiBold,
    InterBold: Inter_700Bold,
    InterExtraBold: Inter_800ExtraBold,
    InterBlack: Inter_900Black,
  })

  if (!fontsLoaded) {
    return null
  }

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <ThemedRoot />
          </ThemeProvider>
        </QueryClientProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  )
}
