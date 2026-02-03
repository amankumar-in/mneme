import { useState, useCallback } from 'react'
import { FlatList, Alert, ActivityIndicator } from 'react-native'
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
  useChats,
  useCreateChat,
  useUpdateChat,
  useDeleteChat,
} from '../hooks/useChats'
import { useExportChat } from '../hooks/useExportChat'
import { useShortcuts } from '../hooks/useShortcuts'
import { useThemeColor } from '../hooks/useThemeColor'
import type { Chat, ChatFilter } from '../types'

const FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'tasks', label: 'Tasks' },
]

export default function HomeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { iconColor } = useThemeColor()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState<ChatFilter>('all')

  // API hooks
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useChats({
    search: searchQuery || undefined,
    filter: selectedFilter === 'all' ? undefined : selectedFilter,
  })

  const createChat = useCreateChat()
  const updateChat = useUpdateChat()
  const deleteChat = useDeleteChat()
  const { exportChat, isExporting } = useExportChat()
  const { addShortcut } = useShortcuts()

  const chats = data?.chats ?? []

  const handleChatPress = useCallback(
    (chat: Chat) => {
      router.push(`/chat/${chat._id}`)
    },
    [router]
  )

  const handleChatLongPress = useCallback(
    (chat: Chat) => {
      Alert.alert(chat.name, 'Choose an action', [
        {
          text: chat.isPinned ? 'Unpin' : 'Pin',
          onPress: () => {
            updateChat.mutate({
              id: chat._id,
              data: { isPinned: !chat.isPinned },
            })
          },
        },
        {
          text: 'Export',
          onPress: async () => {
            try {
              await exportChat(chat._id, chat.name)
            } catch {
              Alert.alert('Export Failed', 'Could not export the chat.')
            }
          },
        },
        {
          text: 'Add Shortcut',
          onPress: async () => {
            const success = await addShortcut(chat)
            if (success) {
              Alert.alert('Shortcut Added', `${chat.name} added to shortcuts.`)
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
              'Delete Chat',
              'Are you sure? Locked messages will be preserved.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    deleteChat.mutate(chat._id)
                  },
                },
              ]
            )
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ])
    },
    [updateChat, deleteChat, exportChat, addShortcut]
  )

  const handleCreateChat = useCallback(async () => {
    try {
      const chat = await createChat.mutateAsync({ name: 'New Thread' })
      router.push(`/chat/${chat._id}?new=1`)
    } catch {
      Alert.alert('Error', 'Could not create the note.')
    }
  }, [createChat, router])

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
          <FAB icon="add" onPress={handleCreateChat} />
        </>
      )
    }

    // Empty state
    if (chats.length === 0 && !searchQuery) {
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
            onSelect={(key) => setSelectedFilter(key as ChatFilter)}
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
          <FAB icon="add" onPress={handleCreateChat} />
        </>
      )
    }

    // No search results
    if (chats.length === 0 && searchQuery) {
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
            onSelect={(key) => setSelectedFilter(key as ChatFilter)}
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
          <FAB icon="add" onPress={handleCreateChat} />
        </>
      )
    }

    // Normal state with chats
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
          onSelect={(key) => setSelectedFilter(key as ChatFilter)}
        />

        <FlatList
          data={chats}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <NoteListItem
              chat={item}
              onPress={() => handleChatPress(item)}
              onLongPress={() => handleChatLongPress(item)}
            />
          )}
          ItemSeparatorComponent={() => <Separator marginLeft={76} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          refreshing={isLoading}
          onRefresh={refetch}
        />

        <FAB icon="add" onPress={handleCreateChat} disabled={createChat.isPending} />

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
