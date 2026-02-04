import { Ionicons } from '@expo/vector-icons'
import { useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { ActivityIndicator, FlatList } from 'react-native'
import { Text, YStack } from 'tamagui'
import { useThemeColor } from '../../hooks/useThemeColor'
import type { NoteWithDetails } from '../../types'
import { DateSeparator } from './DateSeparator'
import { NoteBubble } from './NoteBubble'

interface NoteListProps {
  notes: NoteWithDetails[]
  onLoadMore: () => void
  isLoading: boolean
  threadId: string
  onNoteLongPress: (note: NoteWithDetails) => void
  onNotePress?: (note: NoteWithDetails) => void
  onTaskToggle: (note: NoteWithDetails) => void
  highlightedNoteId?: string
  selectedNoteIds?: Set<string>
}

export interface NoteListRef {
  scrollToNote: (noteId: string) => void
}

type ListItem =
  | { type: 'note'; data: NoteWithDetails }
  | { type: 'date'; date: Date; id: string }

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

function processNotes(notes: NoteWithDetails[]): ListItem[] {
  const items: ListItem[] = []

  // Sort newest first (for inverted list)
  const sortedNotes = [...notes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  for (let i = 0; i < sortedNotes.length; i++) {
    const note = sortedNotes[i]
    const noteDate = new Date(note.createdAt)
    const nextNote = sortedNotes[i + 1]
    const nextDate = nextNote ? new Date(nextNote.createdAt) : null

    // Add the note
    items.push({ type: 'note', data: note })

    // Add date separator after the last note of each day
    // (appears above when list is inverted)
    if (!nextDate || !isSameDay(noteDate, nextDate)) {
      items.push({
        type: 'date',
        date: noteDate,
        id: `date-${noteDate.toDateString()}`,
      })
    }
  }

  return items
}

export const NoteList = forwardRef<NoteListRef, NoteListProps>(({
  notes,
  onLoadMore,
  isLoading,
  threadId,
  onNoteLongPress,
  onNotePress,
  onTaskToggle,
  highlightedNoteId,
  selectedNoteIds,
}, ref) => {
  const { iconColor } = useThemeColor()
  const flatListRef = useRef<FlatList>(null)
  const items = processNotes(notes)

  const scrollToNote = useCallback((noteId: string) => {
    const index = items.findIndex(
      item => item.type === 'note' && item.data.id === noteId
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
    scrollToNote,
  }), [scrollToNote])

  useEffect(() => {
    if (highlightedNoteId) {
      scrollToNote(highlightedNoteId)
    }
  }, [highlightedNoteId, scrollToNote])

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
          note={item.data}
          onLongPress={onNoteLongPress}
          onPress={onNotePress}
          onTaskToggle={onTaskToggle}
          isHighlighted={item.data.id === highlightedNoteId}
          isSelected={selectedNoteIds?.has(item.data.id)}
        />
      )
    },
    [onNoteLongPress, onNotePress, onTaskToggle, highlightedNoteId, selectedNoteIds]
  )

  const keyExtractor = useCallback((item: ListItem) => {
    return item.type === 'date' ? item.id : item.data.id
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
