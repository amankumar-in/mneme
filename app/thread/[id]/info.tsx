import { useState, useCallback, useRef, useEffect } from 'react'
import { ScrollView, Alert, Image, TextInput, Pressable } from 'react-native'
import { YStack, XStack, Text, Button } from 'tamagui'
import { Image as ExpoImage } from 'expo-image'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'

import { useThread, useUpdateThread } from '../../../hooks/useThreads'
import { useThreadMedia } from '../../../hooks/useNotes'
import { useExportThread } from '../../../hooks/useExportThread'
import { useShortcuts } from '../../../hooks/useShortcuts'
import { useThemeColor } from '../../../hooks/useThemeColor'
import { resolveAttachmentUri, attachmentExists } from '../../../services/fileStorage'
import type { NoteType, NoteWithDetails } from '../../../services/database/types'

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

const EMOJI_OPTIONS = ['💡', '📝', '🎯', '💼', '🏠', '❤️', '🎨', '🎵', '📚', '✈️', '🍕']
const MEDIA_TYPES: NoteType[] = ['image', 'video', 'file']
const THUMB_SIZE = 70

export default function ThreadInfoScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const { iconColorStrong, iconColor, brandText, color, accentColor, warningColor, infoColor } = useThemeColor()

  const { data: thread, isLoading } = useThread(id || '')
  const { data: mediaResult } = useThreadMedia(id || '', MEDIA_TYPES, 10)
  const updateThread = useUpdateThread()
  const { exportThread, isExporting } = useExportThread()
  const { addShortcut } = useShortcuts()

  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const nameInputRef = useRef<TextInput>(null)

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      setTimeout(() => {
        nameInputRef.current?.focus()
        nameInputRef.current?.setSelection(0, editedName.length)
      }, 100)
    }
  }, [isEditingName])

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  const handleEditName = useCallback(() => {
    setEditedName(thread?.name || '')
    setIsEditingName(true)
  }, [thread?.name])

  const handleSaveName = useCallback(() => {
    if (editedName.trim() && editedName !== thread?.name) {
      updateThread.mutate({ id: id || '', data: { name: editedName.trim() } })
    }
    setIsEditingName(false)
  }, [editedName, thread?.name, updateThread, id])

  const handleSelectEmoji = useCallback((emoji: string) => {
    updateThread.mutate({ id: id || '', data: { icon: emoji } })
    setShowEmojiPicker(false)
  }, [updateThread, id])

  const handleRemoveEmoji = useCallback(() => {
    updateThread.mutate({ id: id || '', data: { icon: '' } })
    setShowEmojiPicker(false)
  }, [updateThread, id])

  const handleSelectImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]) {
      updateThread.mutate({ id: id || '', data: { icon: result.assets[0].uri } })
      setShowEmojiPicker(false)
    }
  }, [updateThread, id])

  const handleExport = useCallback(async () => {
    if (!thread) return
    try {
      await exportThread(thread.id, thread.name)
    } catch {
      Alert.alert('Export Failed', 'Could not export the thread.')
    }
  }, [thread, exportThread])

  const handleAddShortcut = useCallback(async () => {
    if (!thread) return
    const success = await addShortcut(thread)
    if (success) {
      Alert.alert('Shortcut Added', `${thread.name} added to shortcuts.`)
    } else {
      Alert.alert('Failed', 'Could not add shortcut.')
    }
  }, [thread, addShortcut])

  const handleMediaFiles = useCallback(() => {
    router.push(`/thread/${id}/media`)
  }, [router, id])

  const handleTasks = useCallback(() => {
    if (!thread) return
    router.push(`/tasks?threadId=${id}&threadName=${encodeURIComponent(thread.name)}`)
  }, [router, id, thread])

  if (isLoading || !thread) {
    return (
      <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
        <Text color="$colorSubtle">Loading...</Text>
      </YStack>
    )
  }

  const mediaItems = mediaResult?.data ?? []

  return (
    <YStack flex={1} backgroundColor="$background">
      {/* Header */}
      <XStack
        paddingTop={insets.top + 8}
        paddingHorizontal="$4"
        paddingBottom="$2"
        backgroundColor="$background"
        alignItems="center"
        gap="$3"
      >
        <Button
          size="$3"
          circular
          chromeless
          onPress={handleBack}
          icon={<Ionicons name="arrow-back" size={24} color={iconColorStrong} />}
        />
        <Text fontSize="$5" fontWeight="600" color="$color" flex={1}>
          Thread Info
        </Text>
      </XStack>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        <Pressable onPress={() => showEmojiPicker && setShowEmojiPicker(false)}>
        {/* Thread Icon & Name */}
        <YStack alignItems="center" padding="$6" gap="$4">
          <Pressable onPress={() => setShowEmojiPicker(!showEmojiPicker)}>
            <YStack width={80} height={80} borderRadius={40} backgroundColor="$brandBackground" alignItems="center" justifyContent="center" overflow="hidden">
              {thread.icon ? (
                thread.icon.startsWith('file://') || thread.icon.startsWith('content://') ? (
                  <Image
                    source={{ uri: thread.icon }}
                    style={{ width: 80, height: 80, borderRadius: 40 }}
                  />
                ) : (
                  <Text fontSize={40}>{thread.icon}</Text>
                )
              ) : (
                <Text color={brandText} fontSize={28} fontWeight="700">
                  {getInitials(thread.name)}
                </Text>
              )}
            </YStack>
            <YStack
              position="absolute"
              bottom={0}
              right={0}
              width={26}
              height={26}
              borderRadius={13}
              backgroundColor="$accentColor"
              alignItems="center"
              justifyContent="center"
              borderWidth={2}
              borderColor="$background"
            >
              <Ionicons name="pencil" size={13} color="white" />
            </YStack>
          </Pressable>

          {showEmojiPicker && (
            <Pressable onPress={(e) => e.stopPropagation()}>
              <YStack backgroundColor="$backgroundStrong" borderRadius="$4" padding="$3">
                <XStack flexWrap="wrap" justifyContent="center" gap="$2">
                  <Button
                    size="$4"
                    chromeless
                    onPress={handleSelectImage}
                  >
                    <Ionicons name="image-outline" size={24} color={iconColor} />
                  </Button>
                  {EMOJI_OPTIONS.map((emoji) => (
                    <Button
                      key={emoji}
                      size="$4"
                      chromeless
                      onPress={() => handleSelectEmoji(emoji)}
                    >
                      <Text fontSize={24}>{emoji}</Text>
                    </Button>
                  ))}
                </XStack>
                {thread.icon && (
                  <Button
                    size="$3"
                    chromeless
                    marginTop="$2"
                    onPress={handleRemoveEmoji}
                  >
                    <Text color="$colorSubtle" fontSize="$2">Remove avatar</Text>
                  </Button>
                )}
              </YStack>
            </Pressable>
          )}

          {isEditingName ? (
            <YStack
              width="100%"
              paddingHorizontal="$4"
              paddingVertical="$2"
              onPress={() => nameInputRef.current?.focus()}
            >
              <TextInput
                ref={nameInputRef}
                value={editedName}
                onChangeText={(text) => setEditedName(text.slice(0, 32))}
                style={{
                  fontSize: 20,
                  fontWeight: '600',
                  textAlign: 'center',
                  color,
                  borderBottomWidth: 1,
                  borderBottomColor: iconColor,
                  paddingBottom: 4,
                }}
                onSubmitEditing={handleSaveName}
                onBlur={handleSaveName}
                maxLength={32}
                returnKeyType="done"
              />
            </YStack>
          ) : (
            <YStack alignItems="center" gap="$1">
              <Text fontSize="$6" fontWeight="600" color="$color">
                {thread.name}
              </Text>
              <Text fontSize="$2" color="$accentColor" onPress={handleEditName}>
                Edit
              </Text>
            </YStack>
          )}
        </YStack>

        {/* Media Preview Row */}
        {mediaItems.length > 0 && (
          <YStack paddingHorizontal="$4" marginBottom="$4">
            <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
              <Text fontSize="$3" fontWeight="600" color="$color">Media & Files</Text>
              <Pressable onPress={handleMediaFiles}>
                <Text fontSize="$2" color="$accentColor">See All</Text>
              </Pressable>
            </XStack>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <XStack gap="$2">
                {mediaItems.map((note) => (
                  <MediaThumb key={note.id} note={note} iconColor={iconColor} />
                ))}
              </XStack>
            </ScrollView>
          </YStack>
        )}

        {/* Actions */}
        <YStack>
          <MenuItem
            icon="checkbox-outline"
            label="Tasks"
            onPress={handleTasks}
            iconColor={warningColor}
          />
          <MenuItem
            icon="add-circle-outline"
            label="Add Shortcut"
            onPress={handleAddShortcut}
            iconColor={accentColor}
          />
          <MenuItem
            icon="download-outline"
            label="Export Thread"
            onPress={handleExport}
            loading={isExporting}
            iconColor={infoColor}
          />
        </YStack>

        {/* Created Info */}
        <YStack alignItems="center" paddingTop="$6" paddingBottom="$2">
          <Text color="$colorSubtle" fontSize="$3">
            Created {new Date(thread.createdAt).toLocaleDateString()}
          </Text>
        </YStack>
        </Pressable>
      </ScrollView>
    </YStack>
  )
}

function MediaThumb({ note, iconColor }: { note: NoteWithDetails; iconColor: string }) {
  const isVisual = note.type === 'image' || note.type === 'video'
  const fileMissing = note.attachment?.url ? !attachmentExists(note.attachment.url) : true

  const thumbUri = !fileMissing && note.type === 'video' && note.attachment?.thumbnail && attachmentExists(note.attachment.thumbnail)
    ? resolveAttachmentUri(note.attachment.thumbnail)
    : !fileMissing && note.attachment?.url
      ? resolveAttachmentUri(note.attachment.url)
      : null

  if (fileMissing) {
    const icon = note.type === 'image' ? 'image-outline'
      : note.type === 'video' ? 'videocam-outline'
      : 'document-outline'
    return (
      <YStack
        width={THUMB_SIZE}
        height={THUMB_SIZE}
        borderRadius="$2"
        backgroundColor="$backgroundStrong"
        justifyContent="center"
        alignItems="center"
        opacity={0.5}
      >
        <Ionicons name={icon} size={24} color={iconColor} />
        <Text fontSize={8} color="$colorSubtle" marginTop={2}>Unavailable</Text>
      </YStack>
    )
  }

  if (isVisual && thumbUri) {
    return (
      <YStack
        width={THUMB_SIZE}
        height={THUMB_SIZE}
        borderRadius="$2"
        overflow="hidden"
        backgroundColor="$backgroundStrong"
      >
        <ExpoImage
          source={{ uri: thumbUri }}
          style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
          contentFit="cover"
        />
        {note.type === 'video' && (
          <YStack
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            justifyContent="center"
            alignItems="center"
          >
            <Ionicons name="play-circle" size={24} color="rgba(255,255,255,0.85)" />
          </YStack>
        )}
      </YStack>
    )
  }

  // File/document placeholder
  return (
    <YStack
      width={THUMB_SIZE}
      height={THUMB_SIZE}
      borderRadius="$2"
      backgroundColor="$backgroundStrong"
      justifyContent="center"
      alignItems="center"
    >
      <Ionicons name="document-outline" size={28} color={iconColor} />
      <Text fontSize={9} color="$colorSubtle" numberOfLines={1} paddingHorizontal="$1">
        {note.attachment?.filename || 'File'}
      </Text>
    </YStack>
  )
}

function MenuItem({
  icon,
  label,
  onPress,
  loading,
  iconColor,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
  loading?: boolean
  iconColor: string
}) {
  return (
    <XStack
      paddingHorizontal="$4"
      paddingVertical="$3"
      gap="$3"
      alignItems="center"
      pressStyle={{ backgroundColor: '$backgroundHover' }}
      onPress={onPress}
      opacity={loading ? 0.5 : 1}
      disabled={loading}
    >
      <XStack
        width={36}
        height={36}
        borderRadius="$2"
        backgroundColor="$backgroundStrong"
        alignItems="center"
        justifyContent="center"
      >
        <Ionicons name={icon} size={20} color={iconColor} />
      </XStack>
      <Text fontSize="$4" color="$color" flex={1}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={20} color={iconColor} />
    </XStack>
  )
}
