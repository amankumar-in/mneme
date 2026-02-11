import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import * as LocalAuthentication from 'expo-local-authentication'
import { useRouter } from 'expo-router'
import { ScanLine } from 'lucide-react-native'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, BackHandler, FlatList, ImageBackground, RefreshControl, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Text, XStack, YStack } from 'tamagui'

import { MinimalHomeScreen } from '../components/MinimalHomeScreen'
import { UndoToast } from '../components/UndoToast'
import { useMinimalMode } from '../contexts/MinimalModeContext'
import { useWallpaper } from '../contexts/WallpaperContext'
import { useAppTheme } from '../contexts/ThemeContext'
import { SwipeableRowProvider, useSwipeableRowController } from '../contexts/SwipeableRowContext'
import { WALLPAPERS, resolveOverlayHex } from '../constants/wallpapers'
import { FAB } from '../components/FAB'
import { FilterChips } from '../components/FilterChips'
import { Header } from '../components/Header'
import { SearchBar } from '../components/SearchBar'
import { ThreadActionBar } from '../components/thread/ThreadActionBar'
import { ThreadGridItem } from '../components/ThreadGridItem'
import { SwipeableRow } from '../components/SwipeableRow'
import { ThreadListItem } from '../components/ThreadListItem'
import { useExportThread } from '../hooks/useExportThread'
import { useShortcuts } from '../hooks/useShortcuts'
import { useSyncService } from '../hooks/useSyncService'
import { useThemeColor } from '../hooks/useThemeColor'
import { useRestoreThread } from '../hooks/useTrash'
import {
    useCreateThread,
    useDeleteThread,
    useThreads,
    useUpdateThread,
} from '../hooks/useThreads'
import { useUser } from '../hooks/useUser'
import { useThreadViewStyle } from '../contexts/ThreadViewContext'
import type { ThreadFilter, ThreadWithLastNote } from '../types'

const FILTER_OPTIONS = [
  { key: 'threads', label: 'Threads' },
  { key: 'tasks', label: 'Tasks' },
]

export default function HomeScreen() {
  const { isMinimalMode, minimalThreadId } = useMinimalMode()

  if (isMinimalMode && minimalThreadId) {
    return <MinimalHomeScreen threadId={minimalThreadId} />
  }

  return <ThreadListHome />
}

function ThreadListHome() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { iconColor, iconColorStrong, warningColor, errorColor } = useThemeColor()
  const { threadViewStyle } = useThreadViewStyle()
  const swipeController = useSwipeableRowController()
  const { homeWallpaper, homeOverlayColor, homeOverlayOpacity } = useWallpaper()
  const { resolvedTheme } = useAppTheme()
  const homeOverlayHex = resolveOverlayHex(homeOverlayColor, resolvedTheme === 'dark')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState<ThreadFilter>('threads')
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set())

  const isSelectionMode = selectedThreadIds.size > 0

  // Back button closes open swipe row first, then exits selection mode
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (swipeController.closeAllIfOpen()) return true
      if (isSelectionMode) {
        setSelectedThreadIds(new Set())
        return true
      }
      return false
    })
    return () => handler.remove()
  }, [isSelectionMode, swipeController])

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
  const restoreThread = useRestoreThread()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [undoState, setUndoState] = useState<{
    visible: boolean
    threadId: string | null
    threadName: string
  }>({ visible: false, threadId: null, threadName: '' })

  const hasIdentity = !!(user?.username || user?.email || user?.phone)
  const threads = data?.data ?? []

  const selectedThreads = useMemo(
    () => threads.filter((t) => selectedThreadIds.has(t.id)),
    [threads, selectedThreadIds]
  )

  const allPinned = useMemo(
    () => selectedThreads.length > 0 && selectedThreads.every((t) => t.isPinned),
    [selectedThreads]
  )

  const hasSystemThread = useMemo(
    () => selectedThreads.some((t) => t.isSystemThread),
    [selectedThreads]
  )

  const handleClearSelection = useCallback(() => {
    setSelectedThreadIds(new Set())
  }, [])

  const toggleThreadSelection = useCallback((threadId: string) => {
    setSelectedThreadIds((prev) => {
      const next = new Set(prev)
      if (next.has(threadId)) {
        next.delete(threadId)
      } else {
        next.add(threadId)
      }
      return next
    })
  }, [])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    if (hasIdentity) {
      await pull().catch(() => {})
    }
    refetch()
    setIsRefreshing(false)
  }, [hasIdentity, pull, refetch])

  const handleThreadPress = useCallback(
    async (thread: ThreadWithLastNote) => {
      if (isSelectionMode) {
        toggleThreadSelection(thread.id)
        return
      }
      if (thread.isLocked) {
        try {
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: `Unlock "${thread.name}"`,
            fallbackLabel: 'Cancel',
          })
          if (!result.success) return
        } catch {
          return
        }
      }
      router.push(`/thread/${thread.id}`)
    },
    [router, isSelectionMode, toggleThreadSelection]
  )

  const handleThreadLongPress = useCallback(
    (thread: ThreadWithLastNote) => {
      if (!isSelectionMode) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        setSelectedThreadIds(new Set([thread.id]))
      }
    },
    [isSelectionMode]
  )

  const handlePinSelected = useCallback(() => {
    const shouldPin = !allPinned
    selectedThreads.forEach((thread) => {
      updateThread.mutate({
        id: thread.id,
        data: { isPinned: shouldPin },
      })
    })
    handleClearSelection()
  }, [selectedThreads, allPinned, updateThread, handleClearSelection])

  const handleExportSelected = useCallback(async () => {
    if (selectedThreads.length !== 1) {
      Alert.alert('Export', 'Select a single thread to export.')
      return
    }
    const thread = selectedThreads[0]
    try {
      await exportThread(thread.id, thread.name)
    } catch {
      Alert.alert('Export Failed', 'Could not export the thread.')
    }
    handleClearSelection()
  }, [selectedThreads, exportThread, handleClearSelection])

  const handleShortcutSelected = useCallback(async () => {
    if (selectedThreads.length !== 1) {
      Alert.alert('Shortcut', 'Select a single thread to add a shortcut.')
      return
    }
    const thread = selectedThreads[0]
    const success = await addShortcut(thread)
    if (success) {
      Alert.alert('Shortcut Added', `${thread.name} added to shortcuts.`)
    } else {
      Alert.alert('Failed', 'Could not add shortcut.')
    }
    handleClearSelection()
  }, [selectedThreads, addShortcut, handleClearSelection])

  const handleDeleteSelected = useCallback(() => {
    const count = selectedThreads.length
    Alert.alert(
      'Delete Thread' + (count > 1 ? 's' : ''),
      `Are you sure you want to delete ${count} thread${count > 1 ? 's' : ''}? Locked notes will be preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            selectedThreads.forEach((thread) => {
              deleteThread.mutate(thread.id)
            })
            handleClearSelection()
          },
        },
      ]
    )
  }, [selectedThreads, deleteThread, handleClearSelection])

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

  const handleDeleteWithUndo = useCallback((thread: ThreadWithLastNote) => {
    deleteThread.mutate(thread.id)
    setUndoState({ visible: true, threadId: thread.id, threadName: thread.name })
  }, [deleteThread])

  const handleUndo = useCallback(() => {
    if (undoState.threadId) {
      restoreThread.mutate(undoState.threadId)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }
    setUndoState({ visible: false, threadId: null, threadName: '' })
  }, [undoState.threadId, restoreThread])

  const handleDismissUndo = useCallback(() => {
    setUndoState({ visible: false, threadId: null, threadName: '' })
  }, [])

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

        {threadViewStyle === 'icons' ? (
          <FlatList
            key="grid"
            data={threads}
            keyExtractor={(item) => item.id}
            numColumns={3}
            renderItem={({ item }) => (
              <ThreadGridItem
                thread={item}
                onPress={() => handleThreadPress(item)}
                onLongPress={() => handleThreadLongPress(item)}
                isSelected={selectedThreadIds.has(item.id)}
              />
            )}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
            refreshControl={
              <RefreshControl
                refreshing={isLoading || isRefreshing}
                onRefresh={handleRefresh}
              />
            }
          />
        ) : (
          <SwipeableRowProvider controller={swipeController}>
            <FlatList
              key="list"
              data={threads}
              keyExtractor={(item) => item.id}
              onTouchStart={() => swipeController.closeAll()}
              onScroll={() => swipeController.closeAll()}
              scrollEventThrottle={16}
              renderItem={({ item }) => (
                <SwipeableRow
                  rowId={item.id}
                  enabled={!isSelectionMode && !item.isSystemThread}
                  onPress={() => handleThreadPress(item)}
                  onLongPress={() => handleThreadLongPress(item)}
                  onSwipeRight={() => {
                    updateThread.mutate({
                      id: item.id,
                      data: { isPinned: !item.isPinned },
                    })
                  }}
                  onSwipeLeft={() => handleDeleteWithUndo(item)}
                  onFullSwipeRight={() => {
                    updateThread.mutate({
                      id: item.id,
                      data: { isPinned: !item.isPinned },
                    })
                  }}
                  onFullSwipeLeft={() => handleDeleteWithUndo(item)}
                  leftIcon={item.isPinned ? 'bookmark-outline' : 'bookmark'}
                  leftLabel={item.isPinned ? 'Unpin' : 'Pin'}
                  rightIcon="trash"
                  rightLabel="Delete"
                >
                  <ThreadListItem
                    thread={item}
                    isSelected={selectedThreadIds.has(item.id)}
                  />
                </SwipeableRow>
              )}
              ItemSeparatorComponent={() => (
                <View style={{ height: StyleSheet.hairlineWidth, marginLeft: 76, backgroundColor: 'rgba(128,128,128,0.2)' }} />
              )}
              contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
              refreshControl={
                <RefreshControl
                  refreshing={isLoading || isRefreshing}
                  onRefresh={handleRefresh}
                />
              }
            />
          </SwipeableRowProvider>
        )}

        {isSelectionMode ? (
          <ThreadActionBar
            selectedCount={selectedThreadIds.size}
            onClose={handleClearSelection}
            onPin={handlePinSelected}
            onExport={handleExportSelected}
            onShortcut={handleShortcutSelected}
            onDelete={handleDeleteSelected}
            allPinned={allPinned}
            hideDelete={hasSystemThread}
          />
        ) : (
          <FAB icon="add" onPress={handleCreateThread} disabled={createThread.isPending} />
        )}

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

        <UndoToast
          visible={undoState.visible}
          message={`"${undoState.threadName}" moved to trash`}
          onUndo={handleUndo}
          onDismiss={handleDismissUndo}
        />
      </>
    )
  }

  return (
    <YStack flex={1} backgroundColor={homeWallpaper ? 'transparent' : '$background'}>
      {homeWallpaper && (
        <ImageBackground
          source={WALLPAPERS[homeWallpaper]}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        >
          {homeOverlayHex && (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: homeOverlayHex, opacity: homeOverlayOpacity / 100 },
              ]}
            />
          )}
        </ImageBackground>
      )}
      <Header
        title="LaterBox"
        rightIcon={{ name: 'settings-outline', onPress: handleSettingsPress }}
      />

      {renderContent()}
    </YStack>
  )
}
