import { useState, useCallback, useRef, useEffect } from 'react'
import { ScrollView, Alert, Image, TextInput } from 'react-native'
import { YStack, XStack, Text, Button } from 'tamagui'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'

import { useThread, useUpdateThread } from '../../../hooks/useThreads'
import { useExportThread } from '../../../hooks/useExportThread'
import { useShortcuts } from '../../../hooks/useShortcuts'
import { useThemeColor } from '../../../hooks/useThemeColor'

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

const EMOJI_OPTIONS = ['💡', '📝', '🎯', '💼', '🏠', '❤️', '🎨', '🎵', '📚', '✈️', '🍕']

export default function ThreadInfoScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const { iconColorStrong, iconColor, brandText, color } = useThemeColor()

  const { data: thread, isLoading } = useThread(id || '')
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
      // For now, store the URI - in production this would upload to server
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
    router.push('/tasks')
  }, [router])

  if (isLoading || !thread) {
    return (
      <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
        <Text color="$colorSubtle">Loading...</Text>
      </YStack>
    )
  }

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
        {/* Thread Icon & Name */}
        <YStack alignItems="center" padding="$6" gap="$4">
          <Button
            size="$8"
            circular
            backgroundColor="$brandBackground"
            onPress={() => setShowEmojiPicker(!showEmojiPicker)}
            overflow="hidden"
          >
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
          </Button>

          {showEmojiPicker && (
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
                  <Text color="$colorSubtle" fontSize="$2">Remove icon</Text>
                </Button>
              )}
            </YStack>
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

          <Text color="$colorSubtle" fontSize="$3">
            Created {new Date(thread.createdAt).toLocaleDateString()}
          </Text>
        </YStack>

        {/* Actions */}
        <YStack paddingHorizontal="$4" gap="$2">
          <MenuItem
            icon="images-outline"
            label="Media, Links & Docs"
            onPress={handleMediaFiles}
            iconColor={iconColor}
          />
          <MenuItem
            icon="checkbox-outline"
            label="Tasks"
            onPress={handleTasks}
            iconColor={iconColor}
          />
          <MenuItem
            icon="add-circle-outline"
            label="Add Shortcut"
            onPress={handleAddShortcut}
            iconColor={iconColor}
          />
          <MenuItem
            icon="download-outline"
            label="Export Thread"
            onPress={handleExport}
            loading={isExporting}
            iconColor={iconColor}
          />
        </YStack>
      </ScrollView>
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
      paddingVertical="$3"
      paddingHorizontal="$3"
      gap="$3"
      alignItems="center"
      backgroundColor="$backgroundStrong"
      borderRadius="$3"
      pressStyle={{ opacity: 0.7 }}
      onPress={onPress}
      opacity={loading ? 0.5 : 1}
      disabled={loading}
    >
      <Ionicons name={icon} size={22} color={iconColor} />
      <Text fontSize="$4" color="$color" flex={1}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={20} color={iconColor} />
    </XStack>
  )
}
