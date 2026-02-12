import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert, FlatList } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, ScrollView, Text, XStack, YStack } from 'tamagui'

import { ScreenBackground } from '../../components/ScreenBackground'
import { useThemeColor } from '../../hooks/useThemeColor'
import {
  useDeletedThreads,
  useDeletedNotes,
  useDeletedBoards,
  useRestoreThread,
  useRestoreNote,
  useRestoreBoard,
  usePermanentlyDeleteThread,
  usePermanentlyDeleteNote,
  usePermanentlyDeleteBoard,
} from '../../hooks/useTrash'
import type { ThreadWithLastNote, NoteWithDetails, Board } from '../../types'

type Tab = 'threads' | 'notes' | 'boards'

function formatDeletedDate(dateString: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function getDaysRemaining(deletedAt: string | null): number {
  if (!deletedAt) return 30
  const deleted = new Date(deletedAt).getTime()
  const expiry = deleted + 30 * 24 * 60 * 60 * 1000
  const remaining = Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000))
  return Math.max(0, remaining)
}

export default function TrashScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { iconColorStrong, iconColor, errorColor, successColor, warningColor, backgroundStrong } = useThemeColor()
  const [activeTab, setActiveTab] = useState<Tab>('threads')

  const { data: deletedThreads = [], isLoading: threadsLoading } = useDeletedThreads()
  const { data: deletedNotes = [], isLoading: notesLoading } = useDeletedNotes()
  const { data: deletedBoards = [], isLoading: boardsLoading } = useDeletedBoards()

  const restoreThread = useRestoreThread()
  const restoreNote = useRestoreNote()
  const restoreBoard = useRestoreBoard()
  const permDeleteThread = usePermanentlyDeleteThread()
  const permDeleteNote = usePermanentlyDeleteNote()
  const permDeleteBoard = usePermanentlyDeleteBoard()

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  const handleRestoreThread = useCallback((id: string) => {
    restoreThread.mutate(id)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }, [restoreThread])

  const handleRestoreNote = useCallback((id: string) => {
    restoreNote.mutate(id)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }, [restoreNote])

  const handlePermDeleteThread = useCallback((id: string, name: string) => {
    Alert.alert(
      'Delete Permanently',
      `"${name}" and all its notes will be permanently deleted. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            permDeleteThread.mutate(id)
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          },
        },
      ]
    )
  }, [permDeleteThread])

  const handlePermDeleteNote = useCallback((id: string) => {
    Alert.alert(
      'Delete Permanently',
      'This note will be permanently deleted. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            permDeleteNote.mutate(id)
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          },
        },
      ]
    )
  }, [permDeleteNote])

  const handleRestoreBoard = useCallback((id: string) => {
    restoreBoard.mutate(id)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }, [restoreBoard])

  const handlePermDeleteBoard = useCallback((id: string, name: string) => {
    Alert.alert(
      'Delete Permanently',
      `"${name}" and all its items will be permanently deleted. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            permDeleteBoard.mutate(id)
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          },
        },
      ]
    )
  }, [permDeleteBoard])

  const handleDeleteAllPermanently = useCallback(() => {
    const count = activeTab === 'threads' ? deletedThreads.length : activeTab === 'notes' ? deletedNotes.length : deletedBoards.length
    if (count === 0) return

    const label = activeTab === 'threads' ? 'threads' : activeTab === 'notes' ? 'notes' : 'boards'
    Alert.alert(
      'Delete All Permanently',
      `All ${count} ${label} will be permanently deleted. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: () => {
            if (activeTab === 'threads') {
              deletedThreads.forEach((t) => permDeleteThread.mutate(t.id))
            } else if (activeTab === 'notes') {
              deletedNotes.forEach((n) => permDeleteNote.mutate(n.id))
            } else {
              deletedBoards.forEach((b) => permDeleteBoard.mutate(b.id))
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          },
        },
      ]
    )
  }, [activeTab, deletedThreads, deletedNotes, deletedBoards, permDeleteThread, permDeleteNote, permDeleteBoard])

  const renderThreadItem = useCallback(({ item }: { item: ThreadWithLastNote }) => {
    const daysLeft = getDaysRemaining(item.updatedAt)
    return (
      <XStack
        paddingHorizontal="$4"
        paddingVertical="$3"
        gap="$3"
        alignItems="center"
      >
        <XStack
          width={44}
          height={44}
          borderRadius={22}
          backgroundColor="$backgroundTinted"
          alignItems="center"
          justifyContent="center"
        >
          {item.icon ? (
            <Text fontSize="$5">{item.icon}</Text>
          ) : (
            <Ionicons name="chatbubble-outline" size={20} color={iconColor} />
          )}
        </XStack>

        <YStack flex={1} gap="$0.5">
          <Text fontSize="$4" fontWeight="600" color="$color" numberOfLines={1}>
            {item.name}
          </Text>
          <Text fontSize="$2" color="$colorSubtle">
            Deleted {formatDeletedDate(item.updatedAt)} · {daysLeft}d left
          </Text>
        </YStack>

        <XStack gap="$2">
          <Button
            size="$3"
            circular
            chromeless
            onPress={() => handleRestoreThread(item.id)}
            icon={<Ionicons name="arrow-undo-outline" size={18} color={successColor} />}
          />
          <Button
            size="$3"
            circular
            chromeless
            onPress={() => handlePermDeleteThread(item.id, item.name)}
            icon={<Ionicons name="trash-outline" size={18} color={errorColor} />}
          />
        </XStack>
      </XStack>
    )
  }, [iconColor, successColor, errorColor, handleRestoreThread, handlePermDeleteThread])

  const renderNoteItem = useCallback(({ item }: { item: NoteWithDetails }) => {
    const daysLeft = getDaysRemaining(item.updatedAt)
    const preview = item.content
      ? item.content.slice(0, 80) + (item.content.length > 80 ? '...' : '')
      : `[${item.type}]`

    return (
      <XStack
        paddingHorizontal="$4"
        paddingVertical="$3"
        gap="$3"
        alignItems="center"
      >
        <XStack
          width={44}
          height={44}
          borderRadius={22}
          backgroundColor="$backgroundTinted"
          alignItems="center"
          justifyContent="center"
        >
          <Ionicons name="document-text-outline" size={20} color={iconColor} />
        </XStack>

        <YStack flex={1} gap="$0.5">
          <Text fontSize="$4" color="$color" numberOfLines={1}>
            {preview}
          </Text>
          <Text fontSize="$2" color="$colorSubtle">
            {item.threadName || 'Unknown thread'} · {daysLeft}d left
          </Text>
        </YStack>

        <XStack gap="$2">
          <Button
            size="$3"
            circular
            chromeless
            onPress={() => handleRestoreNote(item.id)}
            icon={<Ionicons name="arrow-undo-outline" size={18} color={successColor} />}
          />
          <Button
            size="$3"
            circular
            chromeless
            onPress={() => handlePermDeleteNote(item.id)}
            icon={<Ionicons name="trash-outline" size={18} color={errorColor} />}
          />
        </XStack>
      </XStack>
    )
  }, [iconColor, successColor, errorColor, handleRestoreNote, handlePermDeleteNote])

  const renderBoardItem = useCallback(({ item }: { item: Board }) => {
    const daysLeft = getDaysRemaining(item.deletedAt)
    return (
      <XStack
        paddingHorizontal="$4"
        paddingVertical="$3"
        gap="$3"
        alignItems="center"
      >
        <XStack
          width={44}
          height={44}
          borderRadius={22}
          backgroundColor="$backgroundTinted"
          alignItems="center"
          justifyContent="center"
        >
          {item.icon ? (
            <Text fontSize="$5">{item.icon}</Text>
          ) : (
            <Ionicons name="easel-outline" size={20} color={iconColor} />
          )}
        </XStack>

        <YStack flex={1} gap="$0.5">
          <Text fontSize="$4" fontWeight="600" color="$color" numberOfLines={1}>
            {item.name}
          </Text>
          <Text fontSize="$2" color="$colorSubtle">
            Deleted {formatDeletedDate(item.deletedAt)} · {daysLeft}d left
          </Text>
        </YStack>

        <XStack gap="$2">
          <Button
            size="$3"
            circular
            chromeless
            onPress={() => handleRestoreBoard(item.id)}
            icon={<Ionicons name="arrow-undo-outline" size={18} color={successColor} />}
          />
          <Button
            size="$3"
            circular
            chromeless
            onPress={() => handlePermDeleteBoard(item.id, item.name)}
            icon={<Ionicons name="trash-outline" size={18} color={errorColor} />}
          />
        </XStack>
      </XStack>
    )
  }, [iconColor, successColor, errorColor, handleRestoreBoard, handlePermDeleteBoard])

  const isEmpty = activeTab === 'threads' ? deletedThreads.length === 0 : activeTab === 'notes' ? deletedNotes.length === 0 : deletedBoards.length === 0

  return (
    <ScreenBackground>
      <XStack
        paddingTop={insets.top + 8}
        paddingHorizontal="$4"
        paddingBottom="$2"
        alignItems="center"
        gap="$2"
      >
        <Button
          size="$3"
          circular
          chromeless
          onPress={handleBack}
          icon={<Ionicons name="arrow-back" size={24} color={iconColorStrong} />}
        />
        <Text fontSize="$6" fontWeight="700" flex={1} color="$color">
          Recently Deleted
        </Text>
      </XStack>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} flexGrow={0} flexShrink={0}>
        <XStack paddingHorizontal="$4" paddingTop="$3" paddingBottom="$3" gap="$2">
          <Button
            size="$3"
            borderRadius="$10"
            backgroundColor={activeTab === 'threads' ? '$backgroundTinted' : backgroundStrong + '55'}
            borderWidth={1}
            borderColor={activeTab === 'threads' ? '$borderColorTinted' : 'rgba(128,128,128,0.15)'}
            pressStyle={{ backgroundColor: backgroundStrong + '88' }}
            onPress={() => setActiveTab('threads')}
          >
            <Text color={activeTab === 'threads' ? '$accentColor' : '$colorSubtle'} fontSize="$3" fontWeight="600">
              Threads ({deletedThreads.length})
            </Text>
          </Button>
          <Button
            size="$3"
            borderRadius="$10"
            backgroundColor={activeTab === 'notes' ? '$backgroundTinted' : backgroundStrong + '55'}
            borderWidth={1}
            borderColor={activeTab === 'notes' ? '$borderColorTinted' : 'rgba(128,128,128,0.15)'}
            pressStyle={{ backgroundColor: backgroundStrong + '88' }}
            onPress={() => setActiveTab('notes')}
          >
            <Text color={activeTab === 'notes' ? '$accentColor' : '$colorSubtle'} fontSize="$3" fontWeight="600">
              Notes ({deletedNotes.length})
            </Text>
          </Button>
          <Button
            size="$3"
            borderRadius="$10"
            backgroundColor={activeTab === 'boards' ? '$backgroundTinted' : backgroundStrong + '55'}
            borderWidth={1}
            borderColor={activeTab === 'boards' ? '$borderColorTinted' : 'rgba(128,128,128,0.15)'}
            pressStyle={{ backgroundColor: backgroundStrong + '88' }}
            onPress={() => setActiveTab('boards')}
          >
            <Text color={activeTab === 'boards' ? '$accentColor' : '$colorSubtle'} fontSize="$3" fontWeight="600">
              Scraps ({deletedBoards.length})
            </Text>
          </Button>
        </XStack>
      </ScrollView>

      {isEmpty ? (
        <YStack flex={1} justifyContent="center" alignItems="center" padding="$8" paddingBottom={insets.bottom + 32}>
          <Ionicons name="trash-outline" size={64} color={iconColor} />
          <Text fontSize="$5" color="$colorSubtle" marginTop="$4" textAlign="center">
            No deleted {activeTab}
          </Text>
          <Text fontSize="$3" color="$colorMuted" marginTop="$2" textAlign="center">
            Items are permanently deleted after 30 days
          </Text>
        </YStack>
      ) : (
        <>
          {activeTab === 'threads' ? (
            <FlatList
              data={deletedThreads}
              keyExtractor={(item) => item.id}
              renderItem={renderThreadItem}
              contentContainerStyle={{ paddingTop: 4, paddingBottom: insets.bottom + 100 }}
            />
          ) : activeTab === 'notes' ? (
            <FlatList
              data={deletedNotes}
              keyExtractor={(item) => item.id}
              renderItem={renderNoteItem}
              contentContainerStyle={{ paddingTop: 4, paddingBottom: insets.bottom + 100 }}
            />
          ) : (
            <FlatList
              data={deletedBoards}
              keyExtractor={(item) => item.id}
              renderItem={renderBoardItem}
              contentContainerStyle={{ paddingTop: 4, paddingBottom: insets.bottom + 100 }}
            />
          )}

          <YStack
            position="absolute"
            bottom={insets.bottom + 16}
            left="$4"
            right="$4"
            gap="$2"
          >
            <Button
              backgroundColor="$red4"
              borderRadius="$4"
              height={48}
              onPress={handleDeleteAllPermanently}
            >
              <Text color="$errorColor" fontWeight="600">
                Delete All Permanently
              </Text>
            </Button>
            <Text fontSize="$1" color="$colorMuted" textAlign="center">
              Items are permanently deleted after 30 days
            </Text>
          </YStack>
        </>
      )}
    </ScreenBackground>
  )
}
