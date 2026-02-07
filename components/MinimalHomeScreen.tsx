import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Platform,
  TextInput,
} from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Text, XStack, YStack } from 'tamagui'

import { MinimalInput } from './MinimalInput'
import { MinimalNoteItem } from './MinimalNoteItem'
import { SelectionActionBar } from './note/SelectionActionBar'
import { useThemeColor } from '@/hooks/useThemeColor'
import {
  useCompleteTask,
  useDeleteNote,
  useLockNote,
  useNotes,
  useSendNote,
  useSetNoteTask,
  useStarNote,
  useUpdateNote,
} from '@/hooks/useNotes'
import { useThread, useUpdateThread } from '@/hooks/useThreads'
import type { NoteWithDetails } from '@/services/database/types'

interface MinimalHomeScreenProps {
  threadId: string
}

export function MinimalHomeScreen({ threadId }: MinimalHomeScreenProps) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { iconColorStrong, color } = useThemeColor()

  // Thread data
  const { data: thread } = useThread(threadId)
  const updateThread = useUpdateThread()

  // Name editing
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')
  const nameInputRef = useRef<TextInput>(null)

  useEffect(() => {
    if (thread?.name) {
      setEditedName(thread.name)
    }
  }, [thread?.name])

  const handleNamePress = useCallback(() => {
    setIsEditingName(true)
    setTimeout(() => nameInputRef.current?.focus(), 100)
  }, [])

  const handleNameSubmit = useCallback(() => {
    if (editedName.trim() && editedName !== thread?.name) {
      updateThread.mutate({ id: threadId, data: { name: editedName.trim() } })
    }
    setIsEditingName(false)
  }, [editedName, thread?.name, updateThread, threadId])

  // Notes
  const { data: notesData, isLoading, fetchNextPage, hasNextPage } = useNotes(threadId)
  const notes = notesData?.pages.flatMap((page) => page.notes) ?? []

  // Mutations
  const sendNoteMutation = useSendNote(threadId)
  const updateNoteMutation = useUpdateNote(threadId)
  const deleteNoteMutation = useDeleteNote(threadId)
  const lockNoteMutation = useLockNote(threadId)
  const starNoteMutation = useStarNote(threadId)
  const setNoteTaskMutation = useSetNoteTask(threadId)
  const completeTaskMutation = useCompleteTask(threadId)

  // Editing state
  const [editingNote, setEditingNote] = useState<NoteWithDetails | null>(null)

  // Selection state
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set())
  const isSelectionMode = selectedNoteIds.size > 0

  // Date picker state for task reminders
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [reminderDate, setReminderDate] = useState(new Date())

  // Back handler for selection mode
  useEffect(() => {
    if (!isSelectionMode) return
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelectedNoteIds(new Set())
      return true
    })
    return () => handler.remove()
  }, [isSelectionMode])

  const selectedNotes = useMemo(
    () => notes.filter((n) => selectedNoteIds.has(n.id)),
    [notes, selectedNoteIds]
  )

  const handleLoadMore = useCallback(() => {
    if (hasNextPage) fetchNextPage()
  }, [hasNextPage, fetchNextPage])

  // Send / edit handlers
  const handleSend = useCallback(
    (note: { content: string; type: 'text' }) => {
      if (editingNote) {
        updateNoteMutation.mutate({ noteId: editingNote.id, content: note.content })
        setEditingNote(null)
        return
      }
      sendNoteMutation.mutate({ content: note.content, type: 'text' })
    },
    [editingNote, sendNoteMutation, updateNoteMutation]
  )

  const handleCancelEdit = useCallback(() => {
    setEditingNote(null)
  }, [])

  // Note press handlers
  const handleNoteLongPress = useCallback((note: NoteWithDetails) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setSelectedNoteIds(new Set([note.id]))
  }, [])

  const handleNotePress = useCallback(
    (note: NoteWithDetails) => {
      if (selectedNoteIds.size > 0) {
        setSelectedNoteIds((prev) => {
          const next = new Set(prev)
          if (next.has(note.id)) {
            next.delete(note.id)
          } else {
            next.add(note.id)
          }
          return next
        })
      }
    },
    [selectedNoteIds.size]
  )

  const handleTaskToggle = useCallback(
    (note: NoteWithDetails) => {
      if (!note.task.isCompleted) {
        completeTaskMutation.mutate(note.id)
      } else {
        setNoteTaskMutation.mutate({
          noteId: note.id,
          isTask: true,
          reminderAt: note.task.reminderAt,
          isCompleted: false,
        })
      }
    },
    [completeTaskMutation, setNoteTaskMutation]
  )

  const handleClearSelection = useCallback(() => {
    setSelectedNoteIds(new Set())
  }, [])

  // Selection actions
  const handleSelectionCopy = useCallback(async () => {
    if (selectedNotes.length === 0) return
    const sorted = [...selectedNotes].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    let text: string
    if (sorted.length === 1) {
      text = sorted[0].content || ''
    } else {
      text = sorted
        .map((note) => {
          const date = new Date(note.createdAt)
          const formatted = date.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
          const time = date.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          })
          return `[${formatted}, ${time}] ${note.content || `[${note.type}]`}`
        })
        .join('\n')
    }
    await Clipboard.setStringAsync(text)
    handleClearSelection()
  }, [selectedNotes, handleClearSelection])

  const handleSelectionLock = useCallback(() => {
    const shouldLock = !selectedNotes.every((n) => n.isLocked)
    selectedNotes.forEach((n) => {
      lockNoteMutation.mutate({ noteId: n.id, isLocked: shouldLock })
    })
    handleClearSelection()
  }, [selectedNotes, lockNoteMutation, handleClearSelection])

  const handleSelectionDelete = useCallback(() => {
    const lockedCount = selectedNotes.filter((n) => n.isLocked).length
    if (lockedCount > 0) {
      Alert.alert('Cannot Delete', `${lockedCount} note(s) are locked. Unlock them first.`)
      return
    }
    Alert.alert(
      'Delete Notes',
      `Delete ${selectedNotes.length} note(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            selectedNotes.forEach((n) => deleteNoteMutation.mutate(n.id))
            handleClearSelection()
          },
        },
      ],
      { cancelable: true }
    )
  }, [selectedNotes, deleteNoteMutation, handleClearSelection])

  const handleSelectionTask = useCallback(() => {
    const shouldMakeTask = !selectedNotes.every((n) => n.task?.isTask)
    if (shouldMakeTask) {
      const defaultDate = new Date()
      defaultDate.setDate(defaultDate.getDate() + 1)
      defaultDate.setHours(9, 0, 0, 0)
      setReminderDate(defaultDate)
      setShowDatePicker(true)
    } else {
      selectedNotes.forEach((n) => {
        setNoteTaskMutation.mutate({ noteId: n.id, isTask: false })
      })
      handleClearSelection()
    }
  }, [selectedNotes, setNoteTaskMutation, handleClearSelection])

  const handleDateChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
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
    },
    []
  )

  const handleTimeChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      setShowTimePicker(false)
      if (Platform.OS === 'android' && event.type === 'dismissed') return
      const finalDate = date || reminderDate
      selectedNotes.forEach((n) => {
        setNoteTaskMutation.mutate({
          noteId: n.id,
          isTask: true,
          reminderAt: finalDate.toISOString(),
        })
      })
      handleClearSelection()
      setShowDatePicker(false)
    },
    [reminderDate, selectedNotes, setNoteTaskMutation, handleClearSelection]
  )

  const handleIOSDateChange = useCallback(
    (_event: DateTimePickerEvent, date?: Date) => {
      if (date) setReminderDate(date)
    },
    []
  )

  const handleIOSConfirm = useCallback(() => {
    selectedNotes.forEach((n) => {
      setNoteTaskMutation.mutate({
        noteId: n.id,
        isTask: true,
        reminderAt: reminderDate.toISOString(),
      })
    })
    handleClearSelection()
    setShowDatePicker(false)
  }, [reminderDate, selectedNotes, setNoteTaskMutation, handleClearSelection])

  const handleIOSCancel = useCallback(() => {
    setShowDatePicker(false)
    setReminderDate(new Date())
  }, [])

  const handleSelectionEdit = useCallback(() => {
    if (selectedNotes.length === 1) {
      setEditingNote(selectedNotes[0])
      handleClearSelection()
    }
  }, [selectedNotes, handleClearSelection])

  const handleSelectionStar = useCallback(() => {
    const shouldStar = !selectedNotes.every((n) => n.isStarred)
    selectedNotes.forEach((n) => {
      starNoteMutation.mutate({ noteId: n.id, isStarred: shouldStar })
    })
    handleClearSelection()
  }, [selectedNotes, starNoteMutation, handleClearSelection])

  const handleSettingsPress = useCallback(() => {
    router.push('/settings')
  }, [router])

  return (
    <YStack flex={1} backgroundColor="$background" paddingBottom={insets.bottom}>
      {/* Header */}
      <XStack
        paddingTop={insets.top + 8}
        paddingHorizontal="$4"
        paddingBottom="$2"
        backgroundColor="$background"
        alignItems="center"
        justifyContent="space-between"
      >
        <XStack flex={1} alignItems="center">
          {isEditingName ? (
            <TextInput
              ref={nameInputRef}
              value={editedName}
              onChangeText={setEditedName}
              onBlur={handleNameSubmit}
              onSubmitEditing={handleNameSubmit}
              style={{
                fontSize: 22,
                fontWeight: '700',
                color,
                flex: 1,
                paddingVertical: 0,
              }}
              autoFocus
              selectTextOnFocus
            />
          ) : (
            <Text
              fontSize="$7"
              fontWeight="700"
              color="$color"
              onPress={handleNamePress}
              numberOfLines={1}
              flex={1}
            >
              {thread?.name || 'Minimal Mode'}
            </Text>
          )}
        </XStack>

        <XStack width={44} justifyContent="flex-end">
          <Button
            size="$3"
            circular
            chromeless
            onPress={handleSettingsPress}
            icon={<Ionicons name="settings-outline" size={24} color={iconColorStrong} />}
          />
        </XStack>
      </XStack>

      {/* Content */}
      <KeyboardAvoidingView style={{ flex: 1, overflow: 'hidden' }} behavior="padding">
        {isLoading ? (
          <YStack flex={1} justifyContent="center" alignItems="center">
            <ActivityIndicator size="large" />
          </YStack>
        ) : (
          <FlatList
            data={notes}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MinimalNoteItem
                note={item}
                onLongPress={handleNoteLongPress}
                onPress={handleNotePress}
                onTaskToggle={handleTaskToggle}
                isSelected={selectedNoteIds.has(item.id)}
              />
            )}
            inverted
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            contentContainerStyle={{ paddingVertical: 8 }}
          />
        )}

        {isSelectionMode ? (
          <SelectionActionBar
            selectedCount={selectedNoteIds.size}
            onClose={handleClearSelection}
            onCopy={handleSelectionCopy}
            onLock={handleSelectionLock}
            onDelete={handleSelectionDelete}
            onTask={handleSelectionTask}
            onEdit={handleSelectionEdit}
            onStar={handleSelectionStar}
            allLocked={selectedNotes.every((n) => n.isLocked)}
            allStarred={selectedNotes.every((n) => n.isStarred)}
            allTasks={selectedNotes.every((n) => n.task?.isTask)}
            canEdit={selectedNoteIds.size === 1}
          />
        ) : (
          <MinimalInput
            onSend={handleSend}
            editingNote={editingNote}
            onCancelEdit={handleCancelEdit}
          />
        )}
      </KeyboardAvoidingView>

      {showDatePicker && Platform.OS === 'ios' && (
        <YStack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          backgroundColor="rgba(0,0,0,0.4)"
          justifyContent="flex-end"
          zIndex={1000}
        >
          <YStack backgroundColor="$background" borderTopLeftRadius={16} borderTopRightRadius={16} paddingBottom={insets.bottom}>
            <XStack justifyContent="space-between" paddingHorizontal="$4" paddingVertical="$3">
              <Button size="$3" chromeless onPress={handleIOSCancel}>
                <Text color="$colorSubtle">Cancel</Text>
              </Button>
              <Button size="$3" chromeless onPress={handleIOSConfirm}>
                <Text color="$blue10" fontWeight="600">Confirm</Text>
              </Button>
            </XStack>
            <DateTimePicker
              value={reminderDate}
              mode="datetime"
              display="spinner"
              onChange={handleIOSDateChange}
              minimumDate={new Date()}
            />
          </YStack>
        </YStack>
      )}

      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={reminderDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
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
