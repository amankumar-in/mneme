import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { YStack, Text } from 'tamagui'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Alert, Keyboard, ActivityIndicator, Platform } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'

import { ChatHeader } from '../../../components/chat/ChatHeader'
import { MessageList, MessageListRef } from '../../../components/message/MessageList'
import { MessageInput } from '../../../components/message/MessageInput'
import { SelectionActionBar } from '../../../components/message/SelectionActionBar'
import { useChat, useUpdateChat } from '../../../hooks/useChats'
import { useMessages, useSendMessage, useUpdateMessage, useDeleteMessage, useLockMessage, useStarMessage, useSetMessageTask, useCompleteTask } from '../../../hooks/useMessages'
import type { Chat, Message, MessageType } from '../../../types'

export default function ChatScreen() {
  const router = useRouter()
  const { id, new: isNew } = useLocalSearchParams<{ id: string; new?: string }>()
  const insets = useSafeAreaInsets()
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [showAttachments, setShowAttachments] = useState(false)
  const [isEditingName, setIsEditingName] = useState(isNew === '1')
  const [editedName, setEditedName] = useState('')

  // Search state
  const [isSearching, setIsSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResultIndex, setSearchResultIndex] = useState(0)
  const messageListRef = useRef<MessageListRef>(null)

  // Selection state
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set())

  // Date picker state for reminders
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [reminderDate, setReminderDate] = useState(new Date())

  // API hooks
  const chatId = id || ''
  const { data: chat, isLoading: chatLoading } = useChat(chatId)
  const { data: messagesData, isLoading: messagesLoading, fetchNextPage, hasNextPage } = useMessages(chatId)
  const updateChat = useUpdateChat()
  const sendMessageMutation = useSendMessage(chatId)
  const updateMessageMutation = useUpdateMessage(chatId)
  const deleteMessageMutation = useDeleteMessage(chatId)
  const lockMessageMutation = useLockMessage(chatId)
  const starMessageMutation = useStarMessage(chatId)
  const setMessageTaskMutation = useSetMessageTask(chatId)
  const completeTaskMutation = useCompleteTask(chatId)

  const messages = messagesData?.pages.flatMap(page => page.messages) ?? []
  const isLoading = messagesLoading

  // Set initial edited name when chat loads
  useEffect(() => {
    if (chat?.name) {
      setEditedName(chat.name)
    }
  }, [chat?.name])

  const taskCount = useMemo(() => {
    return messages.filter((m) => m.task.isTask && !m.task.isCompleted).length
  }, [messages])

  // Search results - find messages matching query
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const query = searchQuery.toLowerCase()
    return messages.filter(m =>
      m.content?.toLowerCase().includes(query)
    )
  }, [messages, searchQuery])

  const highlightedMessageId = useMemo(() => {
    if (searchResults.length === 0) return undefined
    return searchResults[searchResultIndex]?._id
  }, [searchResults, searchResultIndex])

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  const handleChatPress = useCallback(() => {
    router.push(`/chat/${id}/info`)
  }, [router, id])

  const handleSearch = useCallback(() => {
    setIsSearching(true)
    setSearchQuery('')
    setSearchResultIndex(0)
  }, [])

  const handleSearchClose = useCallback(() => {
    setIsSearching(false)
    setSearchQuery('')
    setSearchResultIndex(0)
  }, [])

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query)
    setSearchResultIndex(0)
  }, [])

  const handleSearchPrev = useCallback(() => {
    if (searchResults.length === 0) return
    setSearchResultIndex(prev =>
      prev === 0 ? searchResults.length - 1 : prev - 1
    )
  }, [searchResults.length])

  const handleSearchNext = useCallback(() => {
    if (searchResults.length === 0) return
    setSearchResultIndex(prev =>
      prev === searchResults.length - 1 ? 0 : prev + 1
    )
  }, [searchResults.length])

  const handleTasks = useCallback(() => {
    router.push('/tasks')
  }, [router])

  const handleMenu = useCallback(() => {
    console.log('Menu:', id)
  }, [id])

  const handleLoadMore = useCallback(() => {
    if (hasNextPage) {
      fetchNextPage()
    }
  }, [hasNextPage, fetchNextPage])

  const handleNameChange = useCallback((name: string) => {
    setEditedName(name)
  }, [])

  const handleNameSubmit = useCallback(() => {
    if (editedName.trim() && editedName !== chat?.name) {
      updateChat.mutate({ id: id || '', data: { name: editedName.trim() } })
    }
    setIsEditingName(false)
  }, [editedName, chat?.name, updateChat, id])

  const handleSend = useCallback(
    (message: { content?: string; type: MessageType }) => {
      if (editingMessage) {
        updateMessageMutation.mutate({
          messageId: editingMessage._id,
          content: message.content || '',
        })
        setEditingMessage(null)
      } else {
        sendMessageMutation.mutate({
          content: message.content,
          type: message.type,
        })
      }
    },
    [editingMessage, sendMessageMutation, updateMessageMutation]
  )

  const isSelectionMode = selectedMessageIds.size > 0

  const handleMessageLongPress = useCallback((message: Message) => {
    setSelectedMessageIds(new Set([message._id]))
  }, [])

  const handleMessagePress = useCallback((message: Message) => {
    if (selectedMessageIds.size > 0) {
      setSelectedMessageIds(prev => {
        const next = new Set(prev)
        if (next.has(message._id)) {
          next.delete(message._id)
        } else {
          next.add(message._id)
        }
        return next
      })
    }
  }, [selectedMessageIds.size])

  const handleClearSelection = useCallback(() => {
    setSelectedMessageIds(new Set())
  }, [])

  const selectedMessages = useMemo(() => {
    return messages.filter(m => selectedMessageIds.has(m._id))
  }, [messages, selectedMessageIds])

  const handleSelectionLock = useCallback(() => {
    const shouldLock = !selectedMessages.every(m => m.isLocked)
    selectedMessages.forEach(m => {
      lockMessageMutation.mutate({
        messageId: m._id,
        isLocked: shouldLock,
      })
    })
    handleClearSelection()
  }, [selectedMessages, lockMessageMutation, handleClearSelection])

  const handleSelectionDelete = useCallback(() => {
    const lockedCount = selectedMessages.filter(m => m.isLocked).length
    if (lockedCount > 0) {
      Alert.alert('Cannot Delete', `${lockedCount} message(s) are locked. Unlock them first.`)
      return
    }
    Alert.alert(
      'Delete Messages',
      `Delete ${selectedMessages.length} message(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            selectedMessages.forEach(m => {
              deleteMessageMutation.mutate(m._id)
            })
            handleClearSelection()
          },
        },
      ],
      { cancelable: true }
    )
  }, [selectedMessages, deleteMessageMutation, handleClearSelection])

  const handleSelectionTask = useCallback(() => {
    const shouldMakeTask = !selectedMessages.every(m => m.task?.isTask)
    if (shouldMakeTask) {
      // Set default to tomorrow 9am
      const defaultDate = new Date()
      defaultDate.setDate(defaultDate.getDate() + 1)
      defaultDate.setHours(9, 0, 0, 0)
      setReminderDate(defaultDate)
      setShowDatePicker(true)
    } else {
      selectedMessages.forEach(m => {
        setMessageTaskMutation.mutate({
          messageId: m._id,
          isTask: false,
        })
      })
      handleClearSelection()
    }
  }, [selectedMessages, setMessageTaskMutation, handleClearSelection])

  const handleDateChange = useCallback((event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false)
      if (event.type === 'dismissed') return
    }
    if (date) {
      setReminderDate(date)
      if (Platform.OS === 'android') {
        setShowTimePicker(true)
      }
    }
  }, [])

  const handleTimeChange = useCallback((event: DateTimePickerEvent, date?: Date) => {
    setShowTimePicker(false)
    if (Platform.OS === 'android' && event.type === 'dismissed') return

    const finalDate = date || reminderDate
    selectedMessages.forEach(m => {
      setMessageTaskMutation.mutate({
        messageId: m._id,
        isTask: true,
        reminderAt: finalDate.toISOString(),
      })
    })
    handleClearSelection()
    setShowDatePicker(false)
  }, [reminderDate, selectedMessages, setMessageTaskMutation, handleClearSelection])

  const handleSelectionEdit = useCallback(() => {
    if (selectedMessages.length === 1) {
      setEditingMessage(selectedMessages[0])
      handleClearSelection()
    }
  }, [selectedMessages, handleClearSelection])

  const handleSelectionStar = useCallback(() => {
    const shouldStar = !selectedMessages.every(m => m.isStarred)
    selectedMessages.forEach(m => {
      starMessageMutation.mutate({
        messageId: m._id,
        isStarred: shouldStar,
      })
    })
    handleClearSelection()
  }, [selectedMessages, starMessageMutation, handleClearSelection])

  const handleTaskToggle = useCallback((message: Message) => {
    if (!message.task.isCompleted) {
      completeTaskMutation.mutate(message._id)
    } else {
      // Uncomplete by setting task again
      setMessageTaskMutation.mutate({
        messageId: message._id,
        isTask: true,
        reminderAt: message.task.reminderAt,
      })
    }
  }, [completeTaskMutation, setMessageTaskMutation])

  const handleAttachmentSelect = useCallback((type: string) => {
    console.log('Selected attachment:', type)
  }, [])

  const handleToggleAttachments = useCallback(() => {
    Keyboard.dismiss()
    setShowAttachments((prev) => !prev)
  }, [])

  
  const handleVoiceStart = useCallback(() => {
    console.log('Start voice recording')
  }, [])

  const handleVoiceEnd = useCallback((uri: string) => {
    console.log('End voice recording:', uri)
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null)
  }, [])

  // Create a display chat object for the header
  const displayChat: Chat = chat || {
    _id: id || '',
    name: editedName || 'New Thread',
    ownerId: '',
    participants: [],
    isShared: false,
    isPinned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  if (chatLoading) {
    return (
      <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
        <ActivityIndicator size="large" />
        <Text color="$colorSubtle" marginTop="$3">Loading...</Text>
      </YStack>
    )
  }

  return (
    <YStack flex={1} backgroundColor="$background" paddingBottom={insets.bottom}>
      <ChatHeader
        chat={{ ...displayChat, name: isEditingName ? editedName : displayChat.name }}
        onBack={isSearching ? handleSearchClose : handleBack}
        onChatPress={handleChatPress}
        onSearch={handleSearch}
        onTasks={handleTasks}
        onMenu={handleMenu}
        taskCount={taskCount}
        isEditingName={isEditingName}
        onNameChange={handleNameChange}
        onNameSubmit={handleNameSubmit}
        isSearching={isSearching}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onSearchClose={handleSearchClose}
        onSearchPrev={handleSearchPrev}
        onSearchNext={handleSearchNext}
        searchResultIndex={searchResultIndex}
        searchResultCount={searchResults.length}
      />

      <KeyboardAvoidingView style={{ flex: 1, overflow: 'hidden' }} behavior="padding">
        <MessageList
          ref={messageListRef}
          messages={messages}
          onLoadMore={handleLoadMore}
          isLoading={isLoading}
          chatId={id || '1'}
          onMessageLongPress={handleMessageLongPress}
          onMessagePress={handleMessagePress}
          onTaskToggle={handleTaskToggle}
          highlightedMessageId={highlightedMessageId}
          selectedMessageIds={selectedMessageIds}
        />

        {isSelectionMode ? (
          <SelectionActionBar
            selectedCount={selectedMessageIds.size}
            onClose={handleClearSelection}
            onLock={handleSelectionLock}
            onDelete={handleSelectionDelete}
            onTask={handleSelectionTask}
            onEdit={handleSelectionEdit}
            onStar={handleSelectionStar}
            allLocked={selectedMessages.every(m => m.isLocked)}
            allStarred={selectedMessages.every(m => m.isStarred)}
            allTasks={selectedMessages.every(m => m.task?.isTask)}
            canEdit={selectedMessageIds.size === 1}
          />
        ) : (
          <MessageInput
            onSend={handleSend}
            onAttachmentSelect={handleAttachmentSelect}
            onVoiceStart={handleVoiceStart}
            onVoiceEnd={handleVoiceEnd}
            editingMessage={editingMessage}
            onCancelEdit={handleCancelEdit}
            showAttachments={showAttachments}
            onToggleAttachments={handleToggleAttachments}
          />
        )}
      </KeyboardAvoidingView>

      {showDatePicker && (
        <DateTimePicker
          value={reminderDate}
          mode={Platform.OS === 'ios' ? 'datetime' : 'date'}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={Platform.OS === 'ios' ? handleTimeChange : handleDateChange}
          minimumDate={new Date()}
        />
      )}

      {showTimePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={reminderDate}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}
    </YStack>
  )
}
