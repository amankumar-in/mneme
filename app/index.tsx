import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import * as LocalAuthentication from 'expo-local-authentication'
import { useFocusEffect, useRouter } from 'expo-router'
import { MonitorSmartphone, ScanLine } from 'lucide-react-native'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Animated, AppState, BackHandler, FlatList, ImageBackground, RefreshControl, StyleSheet, View } from 'react-native'
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
import { useBoards, useCreateBoard, useDeleteBoard, useUpdateBoard } from '../hooks/useBoards'
import { useDb } from '../contexts/DatabaseContext'
import { isLocalServerRunning, restoreLocalServer } from '../services/localServer'
import { useQueryClient } from '@tanstack/react-query'
import { getBoardRepository } from '../services/repositories'
import type { Board, ThreadFilter, ThreadWithLastNote } from '../types'

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function getBoardSubtitle(board: Board): string {
  if (board.updatedAt !== board.createdAt) {
    return `Last edited ${formatRelativeTime(board.updatedAt)}`
  }
  return 'Empty scrap'
}

const FILTER_OPTIONS = [
  { key: 'threads', label: 'Threads' },
  { key: 'boards', label: 'Scrapbook' },
  { key: 'tasks', label: 'Tasks' },
]

function PulsingServerIcon() {
  const { iconColorStrong } = useThemeColor()
  const opacity = useState(() => new Animated.Value(1))[0]

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    )
    animation.start()
    return () => animation.stop()
  }, [opacity])

  return (
    <Animated.View style={{ opacity }}>
      <Ionicons name="radio-outline" size={24} color={iconColorStrong} />
    </Animated.View>
  )
}

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
  const [selectedBoardIds, setSelectedBoardIds] = useState<Set<string>>(new Set())

  const isSelectionMode = selectedThreadIds.size > 0
  const isBoardSelectionMode = selectedBoardIds.size > 0

  // Back button closes open swipe row first, then exits selection mode
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (swipeController.closeAllIfOpen()) return true
      if (isSelectionMode) {
        setSelectedThreadIds(new Set())
        return true
      }
      if (isBoardSelectionMode) {
        setSelectedBoardIds(new Set())
        return true
      }
      return false
    })
    return () => handler.remove()
  }, [isSelectionMode, isBoardSelectionMode, swipeController])

  // API hooks — fetch all once, filter client-side
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useThreads()

  const createThread = useCreateThread()
  const updateThread = useUpdateThread()
  const deleteThread = useDeleteThread()
  const { exportThread, isExporting } = useExportThread()
  const { addShortcut } = useShortcuts()
  const { data: user } = useUser()
  const { pull } = useSyncService()
  const restoreThread = useRestoreThread()

  // Board hooks
  const db = useDb()
  const { data: allBoards = [], isLoading: boardsLoading } = useBoards()
  const createBoard = useCreateBoard()
  const updateBoard = useUpdateBoard()
  const deleteBoardMutation = useDeleteBoard()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [undoState, setUndoState] = useState<{
    visible: boolean
    threadId: string | null
    threadName: string
  }>({ visible: false, threadId: null, threadName: '' })

  const hasIdentity = !!(user?.username || user?.email || user?.phone)
  const allThreads = data?.data ?? []

  const threads = useMemo(() => {
    if (!searchQuery) return allThreads
    const q = searchQuery.toLowerCase()
    return allThreads.filter((t) => t.name.toLowerCase().includes(q))
  }, [allThreads, searchQuery])

  const boards = useMemo(() => {
    if (!searchQuery) return allBoards
    const q = searchQuery.toLowerCase()
    return allBoards.filter((b) => b.name.toLowerCase().includes(q))
  }, [allBoards, searchQuery])

  const selectedThreads = useMemo(
    () => threads.filter((t) => selectedThreadIds.has(t.id)),
    [threads, selectedThreadIds]
  )

  const allPinned = useMemo(
    () => selectedThreads.length > 0 && selectedThreads.every((t) => t.isPinned),
    [selectedThreads]
  )

  const allLocked = useMemo(
    () => selectedThreads.length > 0 && selectedThreads.every((t) => t.isLocked),
    [selectedThreads]
  )

  const hasSystemThread = useMemo(
    () => selectedThreads.some((t) => t.isSystemThread),
    [selectedThreads]
  )

  const selectedBoards = useMemo(
    () => boards.filter((b) => selectedBoardIds.has(b.id)),
    [boards, selectedBoardIds]
  )

  const allBoardsLocked = useMemo(
    () => selectedBoards.length > 0 && selectedBoards.every((b) => b.isLocked),
    [selectedBoards]
  )

  const handleClearSelection = useCallback(() => {
    setSelectedThreadIds(new Set())
  }, [])

  const handleClearBoardSelection = useCallback(() => {
    setSelectedBoardIds(new Set())
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

  const toggleBoardSelection = useCallback((boardId: string) => {
    setSelectedBoardIds((prev) => {
      const next = new Set(prev)
      if (next.has(boardId)) {
        next.delete(boardId)
      } else {
        next.add(boardId)
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

  const handleLockSelected = useCallback(() => {
    const shouldLock = !allLocked
    selectedThreads.forEach((thread) => {
      updateThread.mutate({
        id: thread.id,
        data: { isLocked: shouldLock },
      })
    })
    handleClearSelection()
  }, [selectedThreads, allLocked, updateThread, handleClearSelection])

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

  const handleCreateBoard = useCallback(async () => {
    try {
      const board = await createBoard.mutateAsync({ name: 'New Scrap' })
      router.push(`/board/${board.id}`)
    } catch {
      Alert.alert('Error', 'Could not create the board.')
    }
  }, [createBoard, router])

  const handleBoardPress = useCallback(async (board: Board) => {
    if (isBoardSelectionMode) {
      toggleBoardSelection(board.id)
      return
    }
    if (board.isLocked) {
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: `Unlock "${board.name}"`,
          fallbackLabel: 'Cancel',
        })
        if (!result.success) return
      } catch {
        return
      }
    }
    router.push(`/board/${board.id}`)
  }, [router, isBoardSelectionMode, toggleBoardSelection])

  const handleBoardLongPress = useCallback((board: Board) => {
    if (!isBoardSelectionMode) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      setSelectedBoardIds(new Set([board.id]))
    }
  }, [isBoardSelectionMode])

  const handleBoardPinToggle = useCallback((_board: Board) => {
    // Board pin not yet in schema — no-op for now
  }, [])

  const handlePinSelectedBoards = useCallback(() => {
    // Board pin not yet in schema — no-op for now
  }, [])

  const handleLockSelectedBoards = useCallback(() => {
    const shouldLock = !allBoardsLocked
    selectedBoards.forEach((board) => {
      updateBoard.mutate({
        id: board.id,
        data: { isLocked: shouldLock },
      })
    })
    handleClearBoardSelection()
  }, [selectedBoards, allBoardsLocked, updateBoard, handleClearBoardSelection])

  const handleExportSelectedBoards = useCallback(async () => {
    if (selectedBoards.length !== 1) {
      Alert.alert('Export', 'Select a single scrap to export.')
      return
    }
    try {
      const repo = getBoardRepository(db)
      const data = await repo.exportBoard(selectedBoards[0].id)
      if (!data) {
        Alert.alert('Export', 'Could not find scrap data.')
        return
      }
      const { File, Paths } = await import('expo-file-system')
      const Sharing = await import('expo-sharing')
      const file = new File(Paths.cache, 'scrap-export.json')
      file.create()
      file.write(JSON.stringify(data, null, 2))
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' })
    } catch {
      Alert.alert('Export Failed', 'Could not export the scrap.')
    }
    handleClearBoardSelection()
  }, [selectedBoards, db, handleClearBoardSelection])

  const handleShortcutSelectedBoards = useCallback(async () => {
    if (selectedBoards.length !== 1) {
      Alert.alert('Shortcut', 'Select a single scrap to add a shortcut.')
      return
    }
    const board = selectedBoards[0]
    try {
      const Shortcuts = (await import('@rn-org/react-native-shortcuts')).default
      const isSupported = await Shortcuts.isShortcutSupported()
      if (!isSupported) {
        Alert.alert('Not Supported', 'Shortcuts are not supported on this device.')
        handleClearBoardSelection()
        return
      }
      const exists = await Shortcuts.isShortcutExists(board.id)
      const shortcutData = {
        id: board.id,
        title: board.name,
        longLabel: board.name,
        subTitle: 'Open board',
        iconName: 'splashscreen_logo',
        symbolName: 'rectangle.on.rectangle',
      }
      if (exists) {
        await Shortcuts.updateShortcut(shortcutData)
      } else {
        await Shortcuts.addShortcut(shortcutData)
      }
      Alert.alert('Shortcut Added', `${board.name} added to shortcuts.`)
    } catch {
      Alert.alert('Failed', 'Could not add shortcut.')
    }
    handleClearBoardSelection()
  }, [selectedBoards, handleClearBoardSelection])

  const handleDeleteSelectedBoards = useCallback(() => {
    const count = selectedBoards.length
    Alert.alert(
      'Delete Scrap' + (count > 1 ? 's' : ''),
      `Are you sure you want to delete ${count} scrap${count > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            selectedBoards.forEach((board) => {
              deleteBoardMutation.mutate(board.id)
            })
            handleClearBoardSelection()
          },
        },
      ]
    )
  }, [selectedBoards, deleteBoardMutation, handleClearBoardSelection])

  const queryClient = useQueryClient()
  const [serverRunning, setServerRunning] = useState(isLocalServerRunning())
  useFocusEffect(
    useCallback(() => {
      setServerRunning(isLocalServerRunning())
      // Auto-restore persisted web session if server isn't running
      if (!isLocalServerRunning()) {
        restoreLocalServer(db, () => {
          queryClient.invalidateQueries({ queryKey: ['notes'] })
          queryClient.invalidateQueries({ queryKey: ['threads'] })
        }).then((restored) => {
          if (restored) setServerRunning(true)
        })
      }
    }, [db, queryClient])
  )
  useEffect(() => {
    const sub = AppState.addEventListener('change', () => {
      setServerRunning(isLocalServerRunning())
    })
    return () => sub.remove()
  }, [])

  const handleWebPress = useCallback(() => {
    if (serverRunning) {
      router.push('/web-session')
    } else {
      router.push('/qr-scan')
    }
  }, [router, serverRunning])

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

  const handleFilterSelect = useCallback((key: string) => {
    if (key === 'tasks') {
      router.push('/tasks')
    } else {
      setSelectedFilter(key as ThreadFilter)
    }
  }, [router])

  const searchPlaceholder = 'Search your memory...'

  // Build unified search results — boards first, then threads
  type SearchResult = { type: 'board'; data: Board } | { type: 'thread'; data: ThreadWithLastNote }
  const searchResults = useMemo<SearchResult[]>(() => {
    if (!searchQuery) return []
    const results: SearchResult[] = []
    boards.forEach((b) => results.push({ type: 'board', data: b }))
    threads.forEach((t) => results.push({ type: 'thread', data: t }))
    return results
  }, [searchQuery, boards, threads])

  const renderBoardRow = useCallback((item: Board, isSelected: boolean) => (
    <XStack
      paddingHorizontal="$4"
      paddingVertical="$3"
      gap="$3"
      alignItems="center"
      backgroundColor={isSelected ? '$yellow4' : 'transparent'}
    >
      <XStack width={48} height={48} position="relative">
        <XStack
          width={48}
          height={48}
          borderRadius={12}
          backgroundColor="$brandBackground"
          alignItems="center"
          justifyContent="center"
        >
          {item.icon ? (
            <Text fontSize={24}>{item.icon}</Text>
          ) : (
            <Ionicons name="easel-outline" size={24} color={iconColorStrong} />
          )}
        </XStack>
        {isSelected && (
          <XStack
            position="absolute"
            top={0}
            left={0}
            width={48}
            height={48}
            borderRadius={12}
            backgroundColor="$accentColor"
            opacity={0.85}
            alignItems="center"
            justifyContent="center"
          >
            <Ionicons name="checkmark" size={24} color="#fff" />
          </XStack>
        )}
      </XStack>
      <YStack flex={1}>
        <Text fontSize="$4" fontWeight="500" color="$color" numberOfLines={1}>
          {item.name}
        </Text>
        <XStack alignItems="center" gap="$2">
          <Text fontSize="$2" color="$colorSubtle">
            {getBoardSubtitle(item)}
          </Text>
          {item.isLocked && (
            <Ionicons name="lock-closed" size={12} color={warningColor} />
          )}
        </XStack>
      </YStack>
    </XStack>
  ), [iconColorStrong, warningColor])

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

    // Active search — unified results across threads and boards
    if (searchQuery) {
      if (searchResults.length === 0) {
        return (
          <>
            <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
              <Ionicons name="search-outline" size={64} color={iconColor} />
              <Text color="$color" fontSize="$6" fontWeight="600" marginTop="$4">
                No results
              </Text>
              <Text color="$colorSubtle" textAlign="center" marginTop="$2">
                Nothing matches "{searchQuery}"
              </Text>
            </YStack>
            <FAB icon="add" onPress={handleCreateThread} />
          </>
        )
      }
      return (
        <>
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.data.id}
            renderItem={({ item }) =>
              item.type === 'board' ? (
                renderBoardRow(item.data, false)
              ) : (
                <ThreadListItem
                  thread={item.data}
                  isSelected={false}
                  onPress={() => handleThreadPress(item.data)}
                />
              )
            }
            ItemSeparatorComponent={() => (
              <View style={{ height: StyleSheet.hairlineWidth, marginLeft: 76, backgroundColor: 'rgba(128,128,128,0.2)' }} />
            )}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
            keyboardShouldPersistTaps="handled"
          />
          <FAB icon="add" onPress={handleCreateThread} />
        </>
      )
    }

    // Boards tab (no search)
    if (selectedFilter === 'boards') {
      if (boardsLoading) {
        return (
          <YStack flex={1} justifyContent="center" alignItems="center">
            <ActivityIndicator size="large" color={iconColor} />
          </YStack>
        )
      }
      if (boards.length === 0) {
        return (
          <>
            <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
              <Ionicons name="easel-outline" size={64} color={iconColor} />
              <Text color="$color" fontSize="$6" fontWeight="600" marginTop="$4">
                No boards yet
              </Text>
              <Text color="$colorSubtle" textAlign="center" marginTop="$2">
                Tap + to create your first board
              </Text>
            </YStack>
            <FAB icon="add" onPress={handleCreateBoard} disabled={createBoard.isPending} />
          </>
        )
      }
      return (
        <>
          <SwipeableRowProvider controller={swipeController}>
            <FlatList
              data={boards}
              keyExtractor={(item) => item.id}
              onTouchStart={() => swipeController.closeAll()}
              onScroll={() => swipeController.closeAll()}
              scrollEventThrottle={16}
              renderItem={({ item }) => (
                <SwipeableRow
                  rowId={item.id}
                  enabled={!isBoardSelectionMode}
                  onPress={() => handleBoardPress(item)}
                  onLongPress={() => handleBoardLongPress(item)}
                  onSwipeRight={() => handleBoardPinToggle(item)}
                  onSwipeLeft={() => deleteBoardMutation.mutate(item.id)}
                  onFullSwipeRight={() => handleBoardPinToggle(item)}
                  onFullSwipeLeft={() => deleteBoardMutation.mutate(item.id)}
                  leftIcon="bookmark"
                  leftLabel="Pin"
                  rightIcon="trash"
                  rightLabel="Delete"
                >
                  {renderBoardRow(item, selectedBoardIds.has(item.id))}
                </SwipeableRow>
              )}
              ItemSeparatorComponent={() => (
                <View style={{ height: StyleSheet.hairlineWidth, marginLeft: 76, backgroundColor: 'rgba(128,128,128,0.2)' }} />
              )}
              contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
            />
          </SwipeableRowProvider>

          {isBoardSelectionMode ? (
            <ThreadActionBar
              selectedCount={selectedBoardIds.size}
              onClose={handleClearBoardSelection}
              onPin={handlePinSelectedBoards}
              onLock={handleLockSelectedBoards}
              onExport={handleExportSelectedBoards}
              onShortcut={handleShortcutSelectedBoards}
              onDelete={handleDeleteSelectedBoards}
              allPinned={false}
              allLocked={allBoardsLocked}
            />
          ) : (
            <FAB icon="add" onPress={handleCreateBoard} disabled={createBoard.isPending} />
          )}
        </>
      )
    }

    // Empty state (no search, threads tab)
    if (threads.length === 0) {
      return (
        <>
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

    // Normal state with threads
    return (
      <>
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
            onLock={handleLockSelected}
            onExport={handleExportSelected}
            onShortcut={handleShortcutSelected}
            onDelete={handleDeleteSelected}
            allPinned={allPinned}
            allLocked={allLocked}
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
        rightIcons={[
          serverRunning
            ? { icon: <PulsingServerIcon />, onPress: handleWebPress }
            : { icon: <MonitorSmartphone size={24} color={iconColorStrong} />, onPress: handleWebPress },
          { name: 'settings-outline', onPress: handleSettingsPress },
        ]}
      />

      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={searchPlaceholder}
      />
      <FilterChips
        options={FILTER_OPTIONS}
        selected={selectedFilter}
        onSelect={handleFilterSelect}
      />

      {renderContent()}
    </YStack>
  )
}
