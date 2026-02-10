import { useState, useCallback, useEffect, useRef } from 'react'
import { XStack, YStack, Button, Text } from 'tamagui'
import { Ionicons } from '@expo/vector-icons'
import { Keyboard, StyleSheet, TextInput } from 'react-native'
import { Image } from 'expo-image'
import { useThemeColor } from '../../hooks/useThemeColor'
import { resolveAttachmentUri } from '../../services/fileStorage'
import type { NoteWithDetails, NoteType } from '../../types'
import type { AttachmentResult } from '../../hooks/useAttachmentHandler'

const attachmentOptions = [
  { id: 'image', icon: 'image-outline', label: 'Image', color: '$purple5' },
  { id: 'video', icon: 'videocam-outline', label: 'Video', color: '$red5' },
  { id: 'document', icon: 'document-outline', label: 'Document', color: '$blue5' },
  { id: 'location', icon: 'location-outline', label: 'Location', color: '$green5' },
  { id: 'contact', icon: 'person-outline', label: 'Contact', color: '$orange5' },
  { id: 'audio', icon: 'musical-notes-outline', label: 'Audio', color: '$pink5' },
] as const

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

interface NoteInputProps {
  onSend: (note: { content?: string; type: NoteType }) => void
  onAttachmentSelect: (type: string) => void
  onVoiceToggle: () => void
  onVoiceCancel: () => void
  isVoiceRecording?: boolean
  voiceDuration?: number
  voiceMeteringLevels?: number[]
  editingNote?: NoteWithDetails | null
  onCancelEdit?: () => void
  showAttachments: boolean
  onToggleAttachments: () => void
  pendingAttachment?: AttachmentResult | null
  onClearAttachment?: () => void
}

export function NoteInput({
  onSend,
  onAttachmentSelect,
  onVoiceToggle,
  onVoiceCancel,
  isVoiceRecording = false,
  voiceDuration = 0,
  voiceMeteringLevels = [],
  editingNote,
  onCancelEdit,
  showAttachments,
  onToggleAttachments,
  pendingAttachment,
  onClearAttachment,
}: NoteInputProps) {
  const { iconColor, brandText, placeholderColor, color, background, backgroundStrong } = useThemeColor()
  const [text, setText] = useState('')
  const inputRef = useRef<TextInput>(null)

  // Populate input with note content when editing, clear when done
  useEffect(() => {
    if (editingNote) {
      const content = editingNote.content || ''
      setText(content)
      // Focus input and move cursor to end
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.setSelection(content.length, content.length)
      }, 100)
    } else {
      setText('')
    }
  }, [editingNote])

  const handleSend = useCallback(() => {
    const trimmedText = text.trim()
    if (pendingAttachment) {
      onSend({ content: trimmedText || undefined, type: pendingAttachment.type })
      setText('')
      onClearAttachment?.()
      return
    }
    if (trimmedText) {
      onSend({ content: trimmedText, type: 'text' })
      setText('')
    }
  }, [text, onSend, pendingAttachment, onClearAttachment])

  const handleAttachmentPress = useCallback((id: string) => {
    onToggleAttachments()
    onAttachmentSelect(id)
  }, [onToggleAttachments, onAttachmentSelect])

  const hasText = text.trim().length > 0
  const canSend = hasText || !!pendingAttachment

  const attachmentPanel = showAttachments && !isVoiceRecording && (
    <XStack
      backgroundColor={background + 'CC'}
      paddingHorizontal="$4"
      paddingVertical="$3"
      flexWrap="wrap"
      justifyContent="flex-start"
      gap="$4"
    >
      {attachmentOptions.map((option) => (
        <YStack
          key={option.id}
          alignItems="center"
          gap="$1"
          width="28%"
          pressStyle={{ opacity: 0.7 }}
          onPress={() => handleAttachmentPress(option.id)}
        >
          <XStack
            width={52}
            height={52}
            borderRadius={14}
            backgroundColor={option.color}
            alignItems="center"
            justifyContent="center"
          >
            <Ionicons name={option.icon as any} size={26} color={iconColor} />
          </XStack>
          <Text fontSize="$1" color="$colorSubtle">{option.label}</Text>
        </YStack>
      ))}
    </XStack>
  )

  const getAttachmentLabel = () => {
    if (!pendingAttachment) return ''
    switch (pendingAttachment.type) {
      case 'image': return pendingAttachment.filename || 'Photo'
      case 'video': return pendingAttachment.filename || 'Video'
      case 'file': return pendingAttachment.filename || 'Document'
      case 'audio': return pendingAttachment.filename || 'Audio'
      case 'voice': return pendingAttachment.duration
        ? `Voice note (${formatTime(pendingAttachment.duration)})`
        : 'Voice note'
      default: return 'Attachment'
    }
  }

  const getAttachmentIcon = (): string => {
    if (!pendingAttachment) return 'attach'
    switch (pendingAttachment.type) {
      case 'image': return 'image'
      case 'video': return 'videocam'
      case 'file': return 'document'
      case 'audio': return 'musical-notes'
      case 'voice': return 'mic'
      default: return 'attach'
    }
  }

  return (
    <YStack
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor="rgba(128,128,128,0.2)"
      backgroundColor={background + 'CC'}
    >
      {attachmentPanel}

      {!isVoiceRecording && pendingAttachment && (
        <XStack
          backgroundColor={backgroundStrong + 'CC'}
          paddingLeft="$3"
          paddingRight="$2"
          paddingVertical="$2"
          alignItems="center"
          gap="$2"
        >
          {(pendingAttachment.type === 'image' || pendingAttachment.type === 'video') && pendingAttachment.localUri ? (
            <Image
              source={{ uri: resolveAttachmentUri(pendingAttachment.thumbnail || pendingAttachment.localUri!) }}
              style={{ width: 40, height: 40, borderRadius: 6 }}
              contentFit="cover"
            />
          ) : (
            <XStack
              width={40}
              height={40}
              borderRadius={6}
              backgroundColor="$brandBackground"
              alignItems="center"
              justifyContent="center"
            >
              <Ionicons name={getAttachmentIcon() as any} size={20} color={brandText} />
            </XStack>
          )}
          <Text fontSize="$3" color="$color" numberOfLines={1} flex={1}>
            {getAttachmentLabel()}
          </Text>
          <Button size="$3" circular chromeless onPress={onClearAttachment}>
            <Ionicons name="close" size={20} color={iconColor} />
          </Button>
        </XStack>
      )}

      {!isVoiceRecording && editingNote && (
        <XStack
          backgroundColor={backgroundStrong + 'CC'}
          paddingLeft="$4"
          paddingRight="$2"
          paddingVertical="$2"
          alignItems="center"
          justifyContent="space-between"
          gap="$2"
        >
          <XStack alignItems="center" gap="$2" flex={1}>
            <Ionicons name="pencil" size={16} color={iconColor} />
            <Text fontSize="$2" color="$colorSubtle" numberOfLines={1} flex={1}>
              Editing note
            </Text>
          </XStack>
          <Button size="$3" circular chromeless onPress={onCancelEdit}>
            <Ionicons name="close" size={20} color={iconColor} />
          </Button>
        </XStack>
      )}

      {isVoiceRecording ? (
        <XStack
          paddingHorizontal="$2"
          paddingVertical="$2"
          alignItems="center"
          gap="$2"
        >
          <Button
            size="$4"
            circular
            chromeless
            onPress={onVoiceCancel}
            icon={<Ionicons name="trash-outline" size={22} color={iconColor} />}
          />

          <XStack
            flex={1}
            backgroundColor={backgroundStrong + 'AA'}
            borderRadius="$4"
            height={44}
            alignItems="center"
            paddingHorizontal="$3"
            gap="$2"
          >
            <XStack
              width={8}
              height={8}
              borderRadius={4}
              backgroundColor="$red10"
            />

            <XStack flex={1} height={30} alignItems="center" justifyContent="flex-end" gap={2} overflow="hidden">
              {voiceMeteringLevels.map((level, i) => (
                <YStack
                  key={i}
                  width={3}
                  borderRadius={1.5}
                  backgroundColor="$red10"
                  height={Math.max(4, level * 26)}
                />
              ))}
            </XStack>

            <Text
              fontSize="$3"
              color="$colorSubtle"
              fontFamily="$mono"
              minWidth={40}
              textAlign="right"
            >
              {formatTime(voiceDuration)}
            </Text>
          </XStack>

          <Button
            size="$4"
            circular
            backgroundColor="$red10"
            pressStyle={{ backgroundColor: '$red11', scale: 0.95 }}
            onPress={onVoiceToggle}
            icon={<Ionicons name="stop" size={20} color="white" />}
          />
        </XStack>
      ) : (
        <XStack
          paddingHorizontal="$2"
          paddingVertical="$2"
          alignItems="flex-end"
          gap="$2"
        >
          <Button
            size="$3"
            circular
            chromeless
            onPress={onToggleAttachments}
            icon={<Ionicons name={showAttachments ? 'close' : 'attach-outline'} size={24} color={iconColor} />}
          />

          <XStack
            flex={1}
            backgroundColor={backgroundStrong + 'AA'}
            borderRadius="$4"
            minHeight={44}
            maxHeight={120}
            alignItems="center"
          >
            <TextInput
              ref={inputRef}
              style={{ flex: 1, fontSize: 16, color, paddingHorizontal: 12 }}
              placeholder={pendingAttachment ? 'Add a caption...' : 'Type a note...'}
              placeholderTextColor={placeholderColor}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={5000}
              returnKeyType="default"
            />
          </XStack>

          {canSend ? (
            <Button
              size="$4"
              circular
              backgroundColor="$brandBackground"
              pressStyle={{ backgroundColor: '$brandBackgroundHover', scale: 0.95 }}
              onPress={handleSend}
              icon={<Ionicons name="send" size={20} color={brandText} />}
            />
          ) : (
            <Button
              size="$4"
              circular
              backgroundColor="$brandBackground"
              pressStyle={{ backgroundColor: '$brandBackgroundHover', scale: 0.95 }}
              onPress={onVoiceToggle}
              icon={<Ionicons name="mic" size={20} color={brandText} />}
            />
          )}
        </XStack>
      )}
    </YStack>
  )
}
