import { useState, useCallback } from 'react'
import { FlatList, Alert, ActivityIndicator, RefreshControl } from 'react-native'
import { YStack, XStack, Text, Separator, Button } from 'tamagui'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'

import { Header } from '../components/Header'
import { SearchBar } from '../components/SearchBar'
import { FilterChips } from '../components/FilterChips'
import { NoteListItem } from '../components/NoteListItem'
import { FAB } from '../components/FAB'
import {
  useThreads,
  useCreateThread,
  useUpdateThread,
  useDeleteThread,
} from '../hooks/useThreads'
import { useExportThread } from '../hooks/useExportThread'
import { useShortcuts } from '../hooks/useShortcuts'
import { useUser } from '../hooks/useUser'
import { useSyncService } from '../hooks/useSyncService'
import { useThemeColor } from '../hooks/useThemeColor'
import type { ThreadWithLastNote, ThreadFilter } from '../types'

const FILTER_OPTIONS = [
  { key: 'threads', label: 'Threads' },
  { key: 'tasks', label: 'Tasks' },
]

export default function HomeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { iconColor } = useThemeColor()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState<ThreadFilter>('threads')

  // API hooks
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useThreads({
    search: searchQuery || undefined,
    filter: undefined, // threads view shows all threads
  })

  const createThread = useCreateThread()
  const updateThread = useUpdateThread()
  const deleteThread = useDeleteThread()
  const { exportThread, isExporting } = useExportThread()
  const { addShortcut } = useShortcuts()
  const { data: user } = useUser()
  const { pull } = useSyncService()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const hasIdentity = !!(user?.username || user?.email || user?.phone)
  const threads = data?.data ?? []

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    if (hasIdentity) {
      await pull().catch(() => {})
    }
    refetch()
    setIsRefreshing(false)
  }, [hasIdentity, pull, refetch])

  const handleThreadPress = useCallback(
    (thread: ThreadWithLastNote) => {
      router.push(`/thread/${thread.id}`)
    },
    [router]
  )

  const handleThreadLongPress = useCallback(
    (thread: ThreadWithLastNote) => {
      Alert.alert(thread.name, 'Choose an action', [
        {
          text: thread.isPinned ? 'Unpin' : 'Pin',
          onPress: () => {
            updateThread.mutate({
              id: thread.id,
              data: { isPinned: !thread.isPinned },
            })
          },
        },
        {
          text: 'Export',
          onPress: async () => {
            try {
              await exportThread(thread.id, thread.name)
            } catch {
              Alert.alert('Export Failed', 'Could not export the thread.')
            }
          },
        },
        {
          text: 'Add Shortcut',
          onPress: async () => {
            const success = await addShortcut(thread)
            if (success) {
              Alert.alert('Shortcut Added', `${thread.name} added to shortcuts.`)
            } else {
              Alert.alert('Failed', 'Could not add shortcut.')
            }
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete Thread',
              'Are you sure? Locked notes will be preserved.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    deleteThread.mutate(thread.id)
                  },
                },
              ]
            )
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ])
    },
    [updateThread, deleteThread, exportThread, addShortcut]
  )

  const handleCreateThread = useCallback(async () => {
    try {
      const thread = await createThread.mutateAsync({ name: 'New Thread' })
      router.push(`/thread/${thread.id}?new=1`)
    } catch {
      Alert.alert('Error', 'Could not create the note.')
    }
  }, [createThread, router])

  const handleQRPress = useCallback(() => {
    router.push('/qr-scan')
  }, [router])

  const handleSettingsPress = useCallback(() => {
    router.push('/settings')
  }, [router])

  // Render content based on state
  const renderContent = () => {
    // Loading state
    if (isLoading) {
      return (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <ActivityIndicator size="large" color={iconColor} />
          <Text color="$colorSubtle" marginTop="$3">
            Loading notes...
          </Text>
        </YStack>
      )
    }

    // Error state
    if (error) {
      return (
        <>
          <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
            <Ionicons name="cloud-offline-outline" size={64} color={iconColor} />
            <Text color="$color" fontSize="$6" fontWeight="600" marginTop="$4">
              Could not load notes
            </Text>
            <Text color="$colorSubtle" textAlign="center" marginTop="$2">
              Check your connection and try again
            </Text>
            <Button
              marginTop="$4"
              backgroundColor="$brandBackground"
              onPress={() => refetch()}
            >
              <Text color="$brandText">Try Again</Text>
            </Button>
          </YStack>
          <FAB icon="add" onPress={handleCreateThread} />
        </>
      )
    }

    // Empty state
    if (threads.length === 0 && !searchQuery) {
      return (
        <>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search notes..."
          />
          <FilterChips
            options={FILTER_OPTIONS}
            selected={selectedFilter}
            onSelect={(key) => {
              if (key === 'tasks') {
                router.push('/tasks')
              } else {
                setSelectedFilter(key as ThreadFilter)
              }
            }}
          />
          <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
            <Ionicons name="document-text-outline" size={64} color={iconColor} />
            <Text color="$color" fontSize="$6" fontWeight="600" marginTop="$4">
              No notes yet
            </Text>
            <Text color="$colorSubtle" textAlign="center" marginTop="$2">
              Tap the + button to create your first note
            </Text>
          </YStack>
          <FAB icon="add" onPress={handleCreateThread} />
        </>
      )
    }

    // No search results
    if (threads.length === 0 && searchQuery) {
      return (
        <>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search notes..."
          />
          <FilterChips
            options={FILTER_OPTIONS}
            selected={selectedFilter}
            onSelect={(key) => {
              if (key === 'tasks') {
                router.push('/tasks')
              } else {
                setSelectedFilter(key as ThreadFilter)
              }
            }}
          />
          <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
            <Ionicons name="search-outline" size={64} color={iconColor} />
            <Text color="$color" fontSize="$6" fontWeight="600" marginTop="$4">
              No results
            </Text>
            <Text color="$colorSubtle" textAlign="center" marginTop="$2">
              No notes match "{searchQuery}"
            </Text>
          </YStack>
          <FAB icon="add" onPress={handleCreateThread} />
        </>
      )
    }

    // Normal state with threads
    return (
      <>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search notes..."
        />

        <FilterChips
          options={FILTER_OPTIONS}
          selected={selectedFilter}
          onSelect={(key) => {
            if (key === 'tasks') {
              router.push('/tasks')
            } else {
              setSelectedFilter(key as ThreadFilter)
            }
          }}
        />

        <FlatList
          data={threads}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NoteListItem
              thread={item}
              onPress={() => handleThreadPress(item)}
              onLongPress={() => handleThreadLongPress(item)}
            />
          )}
          ItemSeparatorComponent={() => <Separator marginLeft={76} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          refreshControl={
            <RefreshControl
              refreshing={isLoading || isRefreshing}
              onRefresh={handleRefresh}
            />
          }
        />

        <FAB icon="add" onPress={handleCreateThread} disabled={createThread.isPending} />

        {isExporting && (
          <XStack
            position="absolute"
            bottom={insets.bottom + 100}
            left={0}
            right={0}
            justifyContent="center"
          >
            <XStack
              backgroundColor="$backgroundStrong"
              paddingHorizontal="$4"
              paddingVertical="$2"
              borderRadius="$4"
              alignItems="center"
              gap="$2"
            >
              <ActivityIndicator size="small" color={iconColor} />
              <Text color="$color">Exporting...</Text>
            </XStack>
          </XStack>
        )}
      </>
    )
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      <Header
        title="Mneme"
        leftIcon={{ name: 'qr-code-outline', onPress: handleQRPress }}
        rightIcon={{ name: 'settings-outline', onPress: handleSettingsPress }}
      />

      {renderContent()}
    </YStack>
  )
}
