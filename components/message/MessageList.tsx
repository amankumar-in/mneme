import { Ionicons } from '@expo/vector-icons'
import { useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { ActivityIndicator, FlatList } from 'react-native'
import { Text, YStack } from 'tamagui'
import { useThemeColor } from '../../hooks/useThemeColor'
import type { Message } from '../../types'
import { DateSeparator } from './DateSeparator'
import { NoteBubble } from './NoteBubble'

interface MessageListProps {
  messages: Message[]
  onLoadMore: () => void
  isLoading: boolean
  chatId: string
  onMessageLongPress: (message: Message) => void
  onMessagePress?: (message: Message) => void
  onTaskToggle: (message: Message) => void
  highlightedMessageId?: string
  selectedMessageIds?: Set<string>
}

export interface MessageListRef {
  scrollToMessage: (messageId: string) => void
}

type ListItem =
  | { type: 'message'; data: Message }
  | { type: 'date'; date: Date; id: string }

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

function processMessages(messages: Message[]): ListItem[] {
  const items: ListItem[] = []

  // Sort newest first (for inverted list)
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  for (let i = 0; i < sortedMessages.length; i++) {
    const message = sortedMessages[i]
    const messageDate = new Date(message.createdAt)
    const nextMessage = sortedMessages[i + 1]
    const nextDate = nextMessage ? new Date(nextMessage.createdAt) : null

    // Add the message
    items.push({ type: 'message', data: message })

    // Add date separator after the last message of each day
    // (appears above when list is inverted)
    if (!nextDate || !isSameDay(messageDate, nextDate)) {
      items.push({
        type: 'date',
        date: messageDate,
        id: `date-${messageDate.toDateString()}`,
      })
    }
  }

  return items
}

export const MessageList = forwardRef<MessageListRef, MessageListProps>(({
  messages,
  onLoadMore,
  isLoading,
  chatId,
  onMessageLongPress,
  onMessagePress,
  onTaskToggle,
  highlightedMessageId,
  selectedMessageIds,
}, ref) => {
  const { iconColor } = useThemeColor()
  const flatListRef = useRef<FlatList>(null)
  const items = processMessages(messages)

  const scrollToMessage = useCallback((messageId: string) => {
    const index = items.findIndex(
      item => item.type === 'message' && item.data._id === messageId
    )
    if (index !== -1 && flatListRef.current) {
      flatListRef.current.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.5,
      })
    }
  }, [items])

  useImperativeHandle(ref, () => ({
    scrollToMessage,
  }), [scrollToMessage])

  useEffect(() => {
    if (highlightedMessageId) {
      scrollToMessage(highlightedMessageId)
    }
  }, [highlightedMessageId, scrollToMessage])

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true })
  }, [])

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === 'date') {
        return <DateSeparator date={item.date} />
      }
      return (
        <NoteBubble
          message={item.data}
          onLongPress={onMessageLongPress}
          onPress={onMessagePress}
          onTaskToggle={onTaskToggle}
          isHighlighted={item.data._id === highlightedMessageId}
          isSelected={selectedMessageIds?.has(item.data._id)}
        />
      )
    },
    [onMessageLongPress, onMessagePress, onTaskToggle, highlightedMessageId, selectedMessageIds]
  )

  const keyExtractor = useCallback((item: ListItem) => {
    return item.type === 'date' ? item.id : item.data._id
  }, [])

  const handleEndReached = useCallback(() => {
    if (!isLoading) {
      onLoadMore()
    }
  }, [isLoading, onLoadMore])

  const renderFooter = useCallback(() => {
    if (!isLoading) return null
    return (
      <YStack padding="$4" alignItems="center">
        <ActivityIndicator />
      </YStack>
    )
  }, [isLoading])

  if (items.length === 0) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$8">
        <Ionicons name="chatbubble-outline" size={64} color={iconColor} />
        <Text fontSize="$5" color="$colorSubtle" marginTop="$4" textAlign="center">
          It is a blank slate!
        </Text>
        <Text fontSize="$3" color="$colorMuted" marginTop="$2" textAlign="center">
          Start capturing your thoughts
        </Text>
      </YStack>
    )
  }

  const onScrollToIndexFailed = useCallback((info: { index: number }) => {
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: info.index,
        animated: true,
        viewPosition: 0.5,
      })
    }, 100)
  }, [])

  return (
    <YStack flex={1}>
      <FlatList
        ref={flatListRef}
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        inverted
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        contentContainerStyle={{ paddingVertical: 8 }}
        showsVerticalScrollIndicator={false}
        onScrollToIndexFailed={onScrollToIndexFailed}
      />
    </YStack>
  )
})
