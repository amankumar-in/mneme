import { useState } from 'react'
import { XStack, YStack, Text } from 'tamagui'
import { Alert, Linking, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import FileViewer from 'react-native-file-viewer'
import { useThemeColor } from '../../hooks/useThemeColor'
import { resolveAttachmentUri, attachmentExists } from '../../services/fileStorage'
import type { NoteWithDetails } from '../../types'

interface NoteBubbleProps {
  note: NoteWithDetails
  onLongPress: (note: NoteWithDetails) => void
  onPress?: (note: NoteWithDetails) => void
  onTaskToggle?: (note: NoteWithDetails) => void
  onImageView?: (uri: string) => void
  onVideoView?: (uri: string) => void
  onAudioToggle?: (noteId: string, uri: string) => void
  playingNoteId?: string | null
  isAudioPlaying?: boolean
  audioPositionMs?: number
  audioDurationMs?: number
  isHighlighted?: boolean
  isSelected?: boolean
}

const WAVEFORM_BAR_COUNT = 28

function generateWaveform(noteId: string): number[] {
  let hash = 0
  for (let i = 0; i < noteId.length; i++) {
    hash = ((hash << 5) - hash + noteId.charCodeAt(i)) | 0
  }
  const bars: number[] = []
  for (let i = 0; i < WAVEFORM_BAR_COUNT; i++) {
    hash = (hash * 1664525 + 1013904223) | 0
    const value = Math.abs(hash % 100) / 100
    bars.push(0.15 + value * 0.85)
  }
  return bars
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function openDocument(storedPath: string) {
  const uri = resolveAttachmentUri(storedPath)
  const path = uri.startsWith('file://') ? uri.slice(7) : uri
  FileViewer.open(path).catch(() => {
    Alert.alert('Cannot Open', 'No app available to open this file.')
  })
}

function openInMaps(location?: { latitude: number; longitude: number; address?: string } | null) {
  if (!location) return
  Linking.openURL(`https://maps.google.com/?q=${location.latitude},${location.longitude}`)
}

function MissingFile({ icon, label, iconColor }: { icon: string; label: string; iconColor: string }) {
  return (
    <XStack
      backgroundColor="$backgroundStrong"
      borderRadius="$3"
      paddingHorizontal="$3"
      paddingVertical="$2"
      alignItems="center"
      gap="$2"
      minWidth={180}
      opacity={0.7}
    >
      <Ionicons name={icon as any} size={20} color={iconColor} />
      <Text fontSize="$3" color="$colorSubtle">{label}</Text>
    </XStack>
  )
}

const MAX_LINES = 30

export function NoteBubble({ note, onLongPress, onPress, onTaskToggle, onImageView, onVideoView, onAudioToggle, playingNoteId, isAudioPlaying, audioPositionMs = 0, audioDurationMs = 0, isHighlighted = false, isSelected = false }: NoteBubbleProps) {
  const { brandText, iconColor, accentColor, background } = useThemeColor()
  const [isExpanded, setIsExpanded] = useState(false)

  const handleLongPress = () => {
    onLongPress(note)
  }

  const handlePress = () => {
    onPress?.(note)
  }

  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  // Check if content needs truncation (by newlines or estimated character count)
  const contentLines = note.content?.split('\n').length || 0
  const estimatedLines = Math.ceil((note.content?.length || 0) / 40) // ~40 chars per line
  const totalEstimatedLines = Math.max(contentLines, estimatedLines)
  const needsTruncation = totalEstimatedLines > MAX_LINES

  const showHighlight = isHighlighted || isSelected

  const renderContent = () => {
    switch (note.type) {
      case 'image': {
        const imageExists = note.attachment?.url ? attachmentExists(note.attachment.url) : false
        return (
          <YStack>
            {note.attachment?.url && imageExists ? (
              <Pressable onPress={() => {
                if (note.attachment?.url) {
                  onImageView?.(resolveAttachmentUri(note.attachment.url))
                }
              }}>
                <Image
                  source={{ uri: resolveAttachmentUri(note.attachment.url) }}
                  style={{ width: 200, height: 150, borderRadius: 8 }}
                  contentFit="cover"
                />
              </Pressable>
            ) : note.attachment?.url ? (
              <MissingFile icon="image-outline" label="Photo unavailable" iconColor={iconColor} />
            ) : (
              <XStack
                backgroundColor="$backgroundStrong"
                borderRadius="$3"
                width={200}
                height={150}
                alignItems="center"
                justifyContent="center"
              >
                <Ionicons name="image" size={40} color={iconColor} />
              </XStack>
            )}
            {note.content && (
              <Text fontSize="$4" marginTop="$2" color={brandText}>
                {note.content}
              </Text>
            )}
          </YStack>
        )
      }

      case 'video': {
        const videoExists = note.attachment?.url ? attachmentExists(note.attachment.url) : false
        return (
          <YStack>
            {note.attachment?.url && !videoExists ? (
              <MissingFile icon="videocam-outline" label="Video unavailable" iconColor={iconColor} />
            ) : (
              <Pressable onPress={() => {
                if (note.attachment?.url) {
                  onVideoView?.(resolveAttachmentUri(note.attachment.url))
                }
              }}>
                <XStack position="relative">
                  {note.attachment?.thumbnail && attachmentExists(note.attachment.thumbnail) ? (
                    <Image
                      source={{ uri: resolveAttachmentUri(note.attachment.thumbnail) }}
                      style={{ width: 200, height: 150, borderRadius: 8 }}
                      contentFit="cover"
                    />
                  ) : (
                    <XStack
                      backgroundColor="$backgroundStrong"
                      borderRadius="$3"
                      width={200}
                      height={150}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Ionicons name="videocam" size={40} color={iconColor} />
                    </XStack>
                  )}
                  <XStack
                    position="absolute"
                    top={0}
                    left={0}
                    right={0}
                    bottom={0}
                    alignItems="center"
                    justifyContent="center"
                  >
                    <XStack
                      width={44}
                      height={44}
                      borderRadius={22}
                      backgroundColor="rgba(0,0,0,0.5)"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Ionicons name="play" size={24} color="#fff" />
                    </XStack>
                  </XStack>
                  {note.attachment?.duration != null && (
                    <XStack
                      position="absolute"
                      bottom={4}
                      right={4}
                      backgroundColor="rgba(0,0,0,0.6)"
                      borderRadius={4}
                      paddingHorizontal="$1"
                    >
                      <Text color="#fff" fontSize={10}>
                        {formatDuration(note.attachment.duration)}
                      </Text>
                    </XStack>
                  )}
                </XStack>
              </Pressable>
            )}
            {note.content && (
              <Text fontSize="$4" marginTop="$2" color={brandText}>
                {note.content}
              </Text>
            )}
          </YStack>
        )
      }

      case 'voice': {
        const voiceExists = note.attachment?.url ? attachmentExists(note.attachment.url) : false
        if (note.attachment?.url && !voiceExists) {
          return (
            <YStack>
              <MissingFile icon="mic-outline" label="Voice note unavailable" iconColor={iconColor} />
              {note.content && (
                <Text fontSize="$4" marginTop="$2" color={brandText}>
                  {note.content}
                </Text>
              )}
            </YStack>
          )
        }
        const isThisPlaying = playingNoteId === note.id && isAudioPlaying
        const isThisActive = playingNoteId === note.id
        const waveformBars = generateWaveform(note.id)
        const progressRatio = isThisActive && audioDurationMs > 0
          ? audioPositionMs / audioDurationMs
          : 0
        const playedBars = Math.floor(progressRatio * WAVEFORM_BAR_COUNT)
        const displayTime = isThisActive
          ? formatDuration(audioPositionMs / 1000)
          : formatDuration(note.attachment?.duration || 0)
        return (
          <YStack>
            <Pressable onPress={() => {
              if (note.attachment?.url) {
                onAudioToggle?.(note.id, resolveAttachmentUri(note.attachment.url))
              }
            }}>
              <XStack alignItems="center" gap="$2" minWidth={200}>
                <XStack
                  width={36}
                  height={36}
                  borderRadius={18}
                  backgroundColor={background}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Ionicons name={isThisPlaying ? 'pause' : 'play'} size={20} color={accentColor} />
                </XStack>
                <YStack flex={1} gap="$1">
                  <XStack height={28} alignItems="center" gap={2}>
                    {waveformBars.map((level, i) => (
                      <YStack
                        key={i}
                        width={3}
                        borderRadius={1.5}
                        height={Math.max(4, level * 24)}
                        backgroundColor={i < playedBars ? '$color' : '$blue8'}
                      />
                    ))}
                  </XStack>
                  <Text fontSize="$2" color="$blue12">
                    {displayTime}
                  </Text>
                </YStack>
              </XStack>
            </Pressable>
            {note.content && (
              <Text fontSize="$4" marginTop="$2" color={brandText}>
                {note.content}
              </Text>
            )}
          </YStack>
        )
      }

      case 'file': {
        const fileExists = note.attachment?.url ? attachmentExists(note.attachment.url) : false
        if (note.attachment?.url && !fileExists) {
          return (
            <MissingFile
              icon="document-outline"
              label="File unavailable"
              iconColor={iconColor}
            />
          )
        }
        return (
          <Pressable onPress={() => note.attachment?.url && openDocument(note.attachment.url)}>
            <XStack alignItems="center" gap="$2" minWidth={180}>
              <XStack
                width={40}
                height={40}
                borderRadius="$2"
                backgroundColor="$blue8"
                alignItems="center"
                justifyContent="center"
              >
                <Ionicons name="document" size={24} color={brandText} />
              </XStack>
              <YStack flex={1}>
                <Text fontSize="$3" fontWeight="500" numberOfLines={1} color={brandText}>
                  {note.attachment?.filename || 'File'}
                </Text>
                <Text fontSize="$2" color="$blue12">
                  {note.attachment?.size ? formatFileSize(note.attachment.size) : ''}
                </Text>
              </YStack>
            </XStack>
          </Pressable>
        )
      }

      case 'location':
        return (
          <Pressable onPress={() => openInMaps(note.location)}>
            <YStack>
              <XStack
                backgroundColor="$backgroundStrong"
                borderRadius="$3"
                width={200}
                height={120}
                alignItems="center"
                justifyContent="center"
              >
                <Ionicons name="location" size={40} color={iconColor} />
              </XStack>
              <XStack alignItems="center" gap="$1" marginTop="$1">
                <Ionicons name="navigate" size={12} color={accentColor} />
                <Text fontSize="$3" color={accentColor} numberOfLines={2} flex={1}>
                  {note.location?.address || 'Shared location'}
                </Text>
              </XStack>
            </YStack>
          </Pressable>
        )

      case 'contact':
        return (
          <YStack gap="$1" minWidth={180}>
            <XStack alignItems="center" gap="$2">
              <XStack
                width={40}
                height={40}
                borderRadius={20}
                backgroundColor="$orange5"
                alignItems="center"
                justifyContent="center"
              >
                <Ionicons name="person" size={22} color={iconColor} />
              </XStack>
              <Text fontSize="$4" fontWeight="600" color={brandText}>
                {note.attachment?.filename || 'Contact'}
              </Text>
            </XStack>
            {note.content && (
              <Text fontSize="$3" color="$blue12" numberOfLines={4}>
                {note.content}
              </Text>
            )}
          </YStack>
        )

      case 'audio': {
        const audioFileExists = note.attachment?.url ? attachmentExists(note.attachment.url) : false
        if (note.attachment?.url && !audioFileExists) {
          return (
            <MissingFile
              icon="musical-notes-outline"
              label="Audio unavailable"
              iconColor={iconColor}
            />
          )
        }
        const isThisPlaying = playingNoteId === note.id && isAudioPlaying
        return (
          <Pressable onPress={() => {
            if (note.attachment?.url) {
              onAudioToggle?.(note.id, resolveAttachmentUri(note.attachment.url))
            }
          }}>
            <XStack alignItems="center" gap="$2" minWidth={180}>
              <XStack
                width={36}
                height={36}
                borderRadius={18}
                backgroundColor="$pink5"
                alignItems="center"
                justifyContent="center"
              >
                <Ionicons name={isThisPlaying ? 'pause' : 'musical-notes'} size={20} color={iconColor} />
              </XStack>
              <YStack flex={1}>
                <Text fontSize="$3" fontWeight="500" numberOfLines={1} color={brandText}>
                  {note.attachment?.filename || 'Audio'}
                </Text>
                <Text fontSize="$2" color="$blue12">
                  {note.attachment?.size ? formatFileSize(note.attachment.size) : ''}
                </Text>
              </YStack>
            </XStack>
          </Pressable>
        )
      }

      default: {
        const displayContent = !isExpanded && needsTruncation
          ? note.content?.split('\n').slice(0, MAX_LINES).join('\n')
          : note.content
        return (
          <YStack>
            <Text fontSize="$4" color={brandText}>
              {displayContent}
            </Text>
            {needsTruncation && (
              <Pressable onPress={toggleExpand}>
                <Text fontSize="$3" color="$blue11" marginTop="$1" fontWeight="600">
                  {isExpanded ? 'Show less' : 'View more...'}
                </Text>
              </Pressable>
            )}
          </YStack>
        )
      }
    }
  }

  return (
    <Pressable onLongPress={handleLongPress} onPress={handlePress}>
      <XStack
        justifyContent="flex-end"
        alignItems="flex-start"
        paddingHorizontal="$4"
        marginVertical="$1"
        backgroundColor={showHighlight ? '$yellow4' : 'transparent'}
        paddingVertical={showHighlight ? '$1' : 0}
        position="relative"
      >
        <YStack
          backgroundColor={showHighlight ? '$yellow8' : '$brandBackground'}
          paddingHorizontal="$3"
          paddingTop="$2"
          paddingBottom="$1"
          borderRadius="$4"
          borderBottomRightRadius="$1"
          maxWidth="80%"
          position="relative"
          borderWidth={note.isStarred ? 1 : 0}
          borderColor="#F59E0B"
        >
          {note.isStarred && (
            <XStack position="absolute" left={-24} top={8}>
              <Ionicons name="star" size={16} color="#F59E0B" />
            </XStack>
          )}
          {note.task?.isTask && (
            <Pressable
              onPress={() => onTaskToggle?.(note)}
              style={{ position: 'absolute', top: 8, right: 8 }}
            >
              <Ionicons
                name={note.task.isCompleted ? 'checkbox' : 'square-outline'}
                size={20}
                color={brandText}
              />
            </Pressable>
          )}

          <YStack paddingRight={note.task?.isTask ? '$6' : 0}>
            {renderContent()}
          </YStack>

          <XStack justifyContent="flex-end" alignItems="center" gap="$1" marginTop="$1">
            {note.isLocked && (
              <Ionicons name="lock-closed" size={12} color={brandText} />
            )}
            {note.isEdited && (
              <Text fontSize={10} color="$blue12" marginRight="$1">
                edited
              </Text>
            )}
            <Text fontSize={10} color="$blue12">
              {formatTime(note.createdAt)}
            </Text>
          </XStack>

          {note.task?.isTask && note.task.reminderAt && (
            <XStack
              alignItems="center"
              gap="$1"
              marginTop="$1"
              paddingTop="$1"
              borderTopWidth={1}
              borderTopColor="$blue8"
            >
              <Ionicons name="alarm" size={12} color={brandText} />
              <Text fontSize={10} color="$blue12">
                {new Date(note.task.reminderAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </XStack>
          )}
        </YStack>
      </XStack>
    </Pressable>
  )
}
