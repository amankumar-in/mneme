import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, BackHandler, Keyboard, Platform } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text, YStack } from 'tamagui'

import { ImageViewerModal } from '../../../components/note/ImageViewerModal'
import { NoteInput } from '../../../components/note/NoteInput'
import { NoteList, NoteListRef } from '../../../components/note/NoteList'
import { SelectionActionBar } from '../../../components/note/SelectionActionBar'
import { ThreadHeader } from '../../../components/thread/ThreadHeader'
import { VideoPlayerModal } from '../../../components/note/VideoPlayerModal'
import { useAudioPlayer } from '../../../hooks/useAudioPlayer'
import { useVoiceRecorder } from '../../../hooks/useVoiceRecorder'
import { useCompleteTask, useDeleteNote, useLockNote, useNotes, useSendNote, useSetNoteTask, useStarNote, useUpdateNote } from '../../../hooks/useNotes'
import { useThread, useUpdateThread } from '../../../hooks/useThreads'
import { useExportThread } from '../../../hooks/useExportThread'
import { useShortcuts } from '../../../hooks/useShortcuts'
import { useAttachmentHandler, type AttachmentResult } from '../../../hooks/useAttachmentHandler'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { setContactPickerCallback } from '../../../services/contactPickerStore'
import type { NoteType, NoteWithDetails, ThreadWithLastNote } from '../../../types'

export default function ThreadScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ id: string; new?: string; noteId?: string }>()
  const id = Array.isArray(params.id) ? params.id[0] : params.id
  const isNew = Array.isArray(params.new) ? params.new[0] : params.new
  const targetNoteId = Array.isArray(params.noteId) ? params.noteId[0] : params.noteId
  const insets = useSafeAreaInsets()
  const [editingNote, setEditingNote] = useState<NoteWithDetails | null>(null)
  const [showAttachments, setShowAttachments] = useState(false)
  const [isEditingName, setIsEditingName] = useState(isNew === '1')
  const [editedName, setEditedName] = useState('')

  // Attachment state
  const [pendingAttachment, setPendingAttachment] = useState<AttachmentResult | null>(null)
  const { showImageSourcePicker, showVideoSourcePicker, pickDocument, shareLocation, openContactPicker, pickAudio } = useAttachmentHandler()

  // Media viewer state
  const [viewingImageUri, setViewingImageUri] = useState<string | null>(null)
  const [viewingVideoUri, setViewingVideoUri] = useState<string | null>(null)
  const { playingNoteId, isPlaying: isAudioPlaying, positionMs: audioPositionMs, durationMs: audioDurationMs, toggle: toggleAudio } = useAudioPlayer()
  const { isRecording: isVoiceRecording, duration: voiceDuration, meteringLevels: voiceMeteringLevels, startRecording, stopRecording, cancelRecording } = useVoiceRecorder()

  // Search state
  const [isSearching, setIsSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResultIndex, setSearchResultIndex] = useState(0)
  const noteListRef = useRef<NoteListRef>(null)

  // Selection state
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set())

  // Flash highlight state (for navigating from tasks page)
  const [flashNoteId, setFlashNoteId] = useState<string | undefined>(undefined)

  // Date picker state for reminders
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [reminderDate, setReminderDate] = useState(new Date())

  // API hooks
  const threadId = id || ''
  const { data: thread, isLoading: threadLoading } = useThread(threadId)
  const { data: notesData, isLoading: notesLoading, fetchNextPage, hasNextPage } = useNotes(threadId, { isSystemThread: thread?.isSystemThread })
  const updateThread = useUpdateThread()
  const sendNoteMutation = useSendNote(threadId)
  const updateNoteMutation = useUpdateNote(threadId)
  const deleteNoteMutation = useDeleteNote(threadId)
  const lockNoteMutation = useLockNote(threadId)
  const starNoteMutation = useStarNote(threadId)
  const setNoteTaskMutation = useSetNoteTask(threadId)
  const completeTaskMutation = useCompleteTask(threadId)
  const { exportThread, isExporting } = useExportThread()
  const { addShortcut } = useShortcuts()

  const notes = notesData?.pages.flatMap(page => page.notes) ?? []
  const isLoading = notesLoading

  // Set initial edited name when thread loads
  useEffect(() => {
    if (thread?.name) {
      setEditedName(thread.name)
    }
  }, [thread?.name])

  const taskCount = useMemo(() => {
    return notes.filter((n) => n.task.isTask && !n.task.isCompleted).length
  }, [notes])

  // Flash highlight for navigating from tasks page
  useEffect(() => {
    if (targetNoteId) {
      setFlashNoteId(targetNoteId)
      const timer = setTimeout(() => {
        setFlashNoteId(undefined)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [targetNoteId])

  // Search results - find notes matching query
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const query = searchQuery.toLowerCase()
    return notes.filter(n =>
      n.content?.toLowerCase().includes(query)
    )
  }, [notes, searchQuery])

  const highlightedNoteId = useMemo(() => {
    // Prioritize search results when searching
    if (searchResults.length > 0) {
      return searchResults[searchResultIndex]?.id
    }
    // Otherwise use flashNoteId from navigation (e.g., from tasks page)
    return flashNoteId
  }, [searchResults, searchResultIndex, flashNoteId])

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  const handleThreadPress = useCallback(() => {
    router.push(`/thread/${id}/info`)
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
      prev === searchResults.length - 1 ? 0 : prev + 1
    )
  }, [searchResults.length])

  const handleSearchNext = useCallback(() => {
    if (searchResults.length === 0) return
    setSearchResultIndex(prev =>
      prev === 0 ? searchResults.length - 1 : prev - 1
    )
  }, [searchResults.length])

  const handleTasks = useCallback(() => {
    const threadName = encodeURIComponent(thread?.name || 'Thread')
    router.push(`/tasks?threadId=${id}&threadName=${threadName}`)
  }, [router, id, thread?.name])

  const handleMenuSelect = useCallback((menuId: string) => {
    switch (menuId) {
      case 'media':
        router.push(`/thread/${id}/media`)
        break
      case 'shortcut':
        if (thread) {
          addShortcut(thread).then((success) => {
            if (success) {
              Alert.alert('Shortcut Added', `${thread.name} added to shortcuts.`)
            } else {
              Alert.alert('Failed', 'Could not add shortcut.')
            }
          })
        }
        break
      case 'export':
        if (thread) {
          exportThread(thread.id, thread.name).catch(() => {
            Alert.alert('Export Failed', 'Could not export the thread.')
          })
        }
        break
    }
  }, [router, id, thread, addShortcut, exportThread])

  const handleImageView = useCallback((uri: string) => {
    setViewingImageUri(uri)
  }, [])

  const handleVideoView = useCallback((uri: string) => {
    setViewingVideoUri(uri)
  }, [])

  const handleLoadMore = useCallback(() => {
    if (hasNextPage) {
      fetchNextPage()
    }
  }, [hasNextPage, fetchNextPage])

  const handleNameChange = useCallback((name: string) => {
    setEditedName(name)
  }, [])

  const handleNameSubmit = useCallback(() => {
    if (editedName.trim() && editedName !== thread?.name) {
      updateThread.mutate({ id: id || '', data: { name: editedName.trim() } })
    }
    setIsEditingName(false)
  }, [editedName, thread?.name, updateThread, id])

  const handleSend = useCallback(
    (note: { content?: string; type: NoteType }) => {
      if (editingNote) {
        updateNoteMutation.mutate({
          noteId: editingNote.id,
          content: note.content || '',
        })
        setEditingNote(null)
        return
      }

      if (pendingAttachment) {
        if (pendingAttachment.type === 'location') {
          sendNoteMutation.mutate({
            content: note.content,
            type: 'location',
            location: {
              latitude: pendingAttachment.latitude!,
              longitude: pendingAttachment.longitude!,
              address: pendingAttachment.address,
            },
          })
        } else if (pendingAttachment.type === 'contact') {
          sendNoteMutation.mutate({
            content: pendingAttachment.content,
            type: 'contact',
            attachment: {
              url: 'contact',
              filename: pendingAttachment.contactName,
            },
          })
        } else {
          sendNoteMutation.mutate({
            content: note.content,
            type: pendingAttachment.type,
            attachment: {
              url: pendingAttachment.localUri!,
              filename: pendingAttachment.filename,
              mimeType: pendingAttachment.mimeType,
              size: pendingAttachment.size,
              width: pendingAttachment.width,
              height: pendingAttachment.height,
              duration: pendingAttachment.duration,
              thumbnail: pendingAttachment.thumbnail,
            },
          })
        }
        setPendingAttachment(null)
      } else {
        sendNoteMutation.mutate({
          content: note.content,
          type: note.type,
        })
      }
    },
    [editingNote, sendNoteMutation, updateNoteMutation, pendingAttachment]
  )

  const isSelectionMode = selectedNoteIds.size > 0

  useEffect(() => {
    if (!isSelectionMode) return
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelectedNoteIds(new Set())
      return true
    })
    return () => handler.remove()
  }, [isSelectionMode])

  const handleNoteLongPress = useCallback((note: NoteWithDetails) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setSelectedNoteIds(new Set([note.id]))
  }, [])

  const handleNotePress = useCallback((note: NoteWithDetails) => {
    if (selectedNoteIds.size > 0) {
      setSelectedNoteIds(prev => {
        const next = new Set(prev)
        if (next.has(note.id)) {
          next.delete(note.id)
        } else {
          next.add(note.id)
        }
        return next
      })
    }
  }, [selectedNoteIds.size])

  const handleClearSelection = useCallback(() => {
    setSelectedNoteIds(new Set())
  }, [])

  const selectedNotes = useMemo(() => {
    return notes.filter(n => selectedNoteIds.has(n.id))
  }, [notes, selectedNoteIds])

  const handleSelectionCopy = useCallback(async () => {
    if (selectedNotes.length === 0) return

    // Sort by creation time (oldest first) for readable order
    const sorted = [...selectedNotes].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    let text: string
    if (sorted.length === 1) {
      text = sorted[0].content || ''
    } else {
      text = sorted.map((note) => {
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
        const content = note.content || `[${note.type}]`
        return `[${formatted}, ${time}] ${content}`
      }).join('\n')
    }

    await Clipboard.setStringAsync(text)
    handleClearSelection()
  }, [selectedNotes, handleClearSelection])

  const handleSelectionLock = useCallback(() => {
    const shouldLock = !selectedNotes.every(n => n.isLocked)
    selectedNotes.forEach(n => {
      lockNoteMutation.mutate({
        noteId: n.id,
        isLocked: shouldLock,
      })
    })
    handleClearSelection()
  }, [selectedNotes, lockNoteMutation, handleClearSelection])

  const handleSelectionDelete = useCallback(() => {
    const lockedCount = selectedNotes.filter(n => n.isLocked).length
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
            selectedNotes.forEach(n => {
              deleteNoteMutation.mutate(n.id)
            })
            handleClearSelection()
          },
        },
      ],
      { cancelable: true }
    )
  }, [selectedNotes, deleteNoteMutation, handleClearSelection])

  const handleSelectionTask = useCallback(() => {
    const shouldMakeTask = !selectedNotes.every(n => n.task?.isTask)
    if (shouldMakeTask) {
      // Set default to tomorrow 9am
      const defaultDate = new Date()
      defaultDate.setDate(defaultDate.getDate() + 1)
      defaultDate.setHours(9, 0, 0, 0)
      setReminderDate(defaultDate)
      setShowDatePicker(true)
    } else {
      selectedNotes.forEach(n => {
        setNoteTaskMutation.mutate({
          noteId: n.id,
          isTask: false,
        })
      })
      handleClearSelection()
    }
  }, [selectedNotes, setNoteTaskMutation, handleClearSelection])

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
    selectedNotes.forEach(n => {
      setNoteTaskMutation.mutate({
        noteId: n.id,
        isTask: true,
        reminderAt: finalDate.toISOString(),
      })
    })
    handleClearSelection()
    setShowDatePicker(false)
  }, [reminderDate, selectedNotes, setNoteTaskMutation, handleClearSelection])

  const handleSelectionEdit = useCallback(() => {
    if (selectedNotes.length === 1) {
      setEditingNote(selectedNotes[0])
      handleClearSelection()
    }
  }, [selectedNotes, handleClearSelection])

  const handleSelectionStar = useCallback(() => {
    const shouldStar = !selectedNotes.every(n => n.isStarred)
    selectedNotes.forEach(n => {
      starNoteMutation.mutate({
        noteId: n.id,
        isStarred: shouldStar,
      })
    })
    handleClearSelection()
  }, [selectedNotes, starNoteMutation, handleClearSelection])

  const handleTaskToggle = useCallback((note: NoteWithDetails) => {
    if (!note.task.isCompleted) {
      completeTaskMutation.mutate(note.id)
    } else {
      // Uncomplete by setting task again
      setNoteTaskMutation.mutate({
        noteId: note.id,
        isTask: true,
        reminderAt: note.task.reminderAt,
        isCompleted: false,
      })
    }
  }, [completeTaskMutation, setNoteTaskMutation])

  const handleAttachmentSelect = useCallback(async (type: string) => {
    let result: AttachmentResult | null = null
    switch (type) {
      case 'image':
        result = await showImageSourcePicker()
        break
      case 'video':
        result = await showVideoSourcePicker()
        break
      case 'document':
        result = await pickDocument()
        break
      case 'location':
        result = await shareLocation()
        break
      case 'contact':
        setContactPickerCallback((contactResult) => {
          sendNoteMutation.mutate({
            content: contactResult.content,
            type: 'contact',
            attachment: {
              url: 'contact',
              filename: contactResult.contactName,
            },
          })
        })
        openContactPicker()
        return
      case 'audio':
        result = await pickAudio()
        break
    }
    if (result) {
      // Location and contact are sent immediately, no caption needed
      if (result.type === 'location') {
        sendNoteMutation.mutate({
          type: 'location',
          location: {
            latitude: result.latitude!,
            longitude: result.longitude!,
            address: result.address,
          },
        })
      } else {
        setPendingAttachment(result)
      }
    }
  }, [showImageSourcePicker, showVideoSourcePicker, pickDocument, shareLocation, openContactPicker, pickAudio, sendNoteMutation])

  const handleToggleAttachments = useCallback(() => {
    Keyboard.dismiss()
    setShowAttachments((prev) => !prev)
  }, [])

  const handleClearAttachment = useCallback(() => {
    setPendingAttachment(null)
  }, [])


  const handleVoiceToggle = useCallback(async () => {
    if (isVoiceRecording) {
      const result = await stopRecording()
      if (result) {
        setPendingAttachment(result)
      }
    } else {
      setShowAttachments(false)
      await startRecording()
    }
  }, [isVoiceRecording, stopRecording, startRecording])

  const handleVoiceCancel = useCallback(async () => {
    await cancelRecording()
  }, [cancelRecording])

  const handleCancelEdit = useCallback(() => {
    setEditingNote(null)
  }, [])

  // Create a display thread object for the header
  const displayThread: ThreadWithLastNote = thread || {
    id: id || '',
    serverId: null,
    name: editedName || 'New Thread',
    icon: null,
    isPinned: false,
    isSystemThread: false,
    wallpaper: null,
    lastNote: null,
    syncStatus: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  if (threadLoading) {
    return (
      <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
        <ActivityIndicator size="large" />
        <Text color="$colorSubtle" marginTop="$3">Loading...</Text>
      </YStack>
    )
  }

  return (
    <YStack flex={1} backgroundColor="$background" paddingBottom={insets.bottom}>
      <ThreadHeader
        thread={{ ...displayThread, name: isEditingName ? editedName : displayThread.name }}
        onBack={isSearching ? handleSearchClose : handleBack}
        onThreadPress={handleThreadPress}
        onSearch={handleSearch}
        onTasks={handleTasks}
        onMenuSelect={handleMenuSelect}
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
        <NoteList
          ref={noteListRef}
          notes={notes}
          onLoadMore={handleLoadMore}
          isLoading={isLoading}
          threadId={id || '1'}
          onNoteLongPress={handleNoteLongPress}
          onNotePress={handleNotePress}
          onTaskToggle={handleTaskToggle}
          onImageView={handleImageView}
          onVideoView={handleVideoView}
          onAudioToggle={toggleAudio}
          playingNoteId={playingNoteId}
          isAudioPlaying={isAudioPlaying}
          audioPositionMs={audioPositionMs}
          audioDurationMs={audioDurationMs}
          highlightedNoteId={highlightedNoteId}
          selectedNoteIds={selectedNoteIds}
        />

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
            allLocked={selectedNotes.every(n => n.isLocked)}
            allStarred={selectedNotes.every(n => n.isStarred)}
            allTasks={selectedNotes.every(n => n.task?.isTask)}
            canEdit={selectedNoteIds.size === 1}
          />
        ) : thread?.isSystemThread ? (
          <YStack borderTopWidth={1} borderTopColor="$borderColor" backgroundColor="$background" height={56} justifyContent="center" alignItems="center">
            <Text fontSize="$2" color="$colorSubtle" textAlign="center" paddingHorizontal="$4">
              Locked notes from all your threads appear here.
            </Text>
          </YStack>
        ) : (
          <NoteInput
            onSend={handleSend}
            onAttachmentSelect={handleAttachmentSelect}
            onVoiceToggle={handleVoiceToggle}
            onVoiceCancel={handleVoiceCancel}
            isVoiceRecording={isVoiceRecording}
            voiceDuration={voiceDuration}
            voiceMeteringLevels={voiceMeteringLevels}
            editingNote={editingNote}
            onCancelEdit={handleCancelEdit}
            showAttachments={showAttachments}
            onToggleAttachments={handleToggleAttachments}
            pendingAttachment={pendingAttachment}
            onClearAttachment={handleClearAttachment}
          />
        )}
      </KeyboardAvoidingView>

      <ImageViewerModal
        uri={viewingImageUri}
        onClose={() => setViewingImageUri(null)}
      />
      <VideoPlayerModal
        uri={viewingVideoUri}
        onClose={() => setViewingVideoUri(null)}
      />

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
