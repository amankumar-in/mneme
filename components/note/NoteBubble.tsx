import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useCallback, useMemo, useState } from 'react'
import { Alert, Linking, Pressable, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import FileViewer from 'react-native-file-viewer'
import { Text, XStack, YStack } from 'tamagui'
import { useNoteFontScale } from '../../contexts/FontScaleContext'
import { useNoteViewStyle } from '../../contexts/NoteViewContext'
import { useThemeColor } from '../../hooks/useThemeColor'
import { attachmentExists, resolveAttachmentUri } from '../../services/fileStorage'
import type { NoteWithDetails } from '../../types'
import { LinkPreviewCard } from '../share/LinkPreviewCard'

interface NoteBubbleProps {
  note: NoteWithDetails
  onLongPress: (note: NoteWithDetails) => void
  onPress?: (note: NoteWithDetails) => void
  onTaskToggle?: (note: NoteWithDetails) => void
  onImageView?: (uri: string) => void
  onVideoView?: (uri: string) => void
  onAudioToggle?: (noteId: string, uri: string) => void
  onAudioSeek?: (noteId: string, positionMs: number) => void
  playingNoteId?: string | null
  isAudioPlaying?: boolean
  audioPositionMs?: number
  audioDurationMs?: number
  isHighlighted?: boolean
  isSelected?: boolean
}

// Waveform bar dimensions (px)
const BAR_WIDTH = 3
const BAR_GAP = 1.5
const BAR_STEP = BAR_WIDTH + BAR_GAP // 4.5px per bar
const BAR_MAX_HEIGHT = 28

/** Resample a waveform array to a target bar count (max-in-bucket down, lerp up) */
function resampleWaveform(waveform: number[], targetCount: number): number[] {
  const len = waveform.length
  if (len === 0 || targetCount <= 0) return []
  if (len === targetCount) return waveform

  const result: number[] = new Array(targetCount)

  if (targetCount < len) {
    for (let i = 0; i < targetCount; i++) {
      const start = (i / targetCount) * len
      const end = ((i + 1) / targetCount) * len
      const fromIdx = Math.floor(start)
      const toIdx = Math.min(Math.ceil(end), len)
      let max = 0
      for (let j = fromIdx; j < toIdx; j++) {
        if (waveform[j] > max) max = waveform[j]
      }
      result[i] = max
    }
  } else {
    for (let i = 0; i < targetCount; i++) {
      const srcIndex = (i / (targetCount - 1)) * (len - 1)
      const lower = Math.floor(srcIndex)
      const upper = Math.min(lower + 1, len - 1)
      const fraction = srcIndex - lower
      result[i] = waveform[lower] * (1 - fraction) + waveform[upper] * fraction
    }
  }

  return result
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
      opacity={0.7}
    >
      <Ionicons name={icon as any} size={20} color={iconColor} />
      <Text fontSize="$3" color="$colorSubtle">{label}</Text>
    </XStack>
  )
}

/** Fixed-width voice waveform with tap/drag-to-seek (WhatsApp-style) */
function VoiceWaveform({
  note,
  playingNoteId,
  isAudioPlaying,
  audioPositionMs,
  audioDurationMs,
  onAudioToggle,
  onAudioSeek,
  scaledFontSize,
  contentColor,
  iconColor,
  accentColor,
  accentColorMuted,
  background,
}: {
  note: NoteWithDetails
  playingNoteId: string | null
  isAudioPlaying: boolean
  audioPositionMs: number
  audioDurationMs: number
  onAudioToggle?: (noteId: string, uri: string) => void
  onAudioSeek?: (noteId: string, positionMs: number) => void
  scaledFontSize: number
  contentColor: string
  iconColor: string
  accentColor: string
  accentColorMuted: string
  background: string
}) {
  const [containerWidth, setContainerWidth] = useState(0)
  const voiceExists = note.attachment?.url ? attachmentExists(note.attachment.url) : false

  if (note.attachment?.url && !voiceExists) {
    return (
      <YStack>
        <MissingFile icon="mic-outline" label="Voice note unavailable" iconColor={iconColor} />
        {note.content && (
          <Text fontSize={scaledFontSize} marginTop="$2" color={contentColor}>
            {note.content}
          </Text>
        )}
      </YStack>
    )
  }

  const waveform = note.attachment?.waveform
  const totalDuration = note.attachment?.duration || 0

  const isThisPlaying = playingNoteId === note.id && isAudioPlaying
  const isThisActive = playingNoteId === note.id

  const progressRatio = isThisActive && audioDurationMs > 0
    ? audioPositionMs / audioDurationMs
    : 0

  const displayTime = isThisActive
    ? `${formatDuration(audioPositionMs / 1000)} / ${formatDuration(totalDuration)}`
    : formatDuration(totalDuration)

  // Calculate bar count from available width and resample
  const barCount = containerWidth > 0 ? Math.floor(containerWidth / BAR_STEP) : 0
  const resampledWaveform = useMemo(
    () => (waveform && barCount > 0 ? resampleWaveform(waveform, barCount) : null),
    [waveform, barCount]
  )

  const playedBarCount = resampledWaveform
    ? Math.floor(progressRatio * resampledWaveform.length)
    : 0

  // Seek handler: convert X position to audio position
  const seekToX = useCallback((x: number) => {
    if (!isThisActive || audioDurationMs <= 0 || containerWidth <= 0) return
    const ratio = Math.max(0, Math.min(1, x / containerWidth))
    onAudioSeek?.(note.id, ratio * audioDurationMs)
  }, [isThisActive, audioDurationMs, containerWidth, note.id, onAudioSeek])

  const panGesture = Gesture.Pan()
    .onUpdate((e) => seekToX(e.x))
    .minDistance(0)
    .activeOffsetX([-5, 5])

  const tapGesture = Gesture.Tap()
    .onEnd((e) => seekToX(e.x))

  const composedGesture = Gesture.Simultaneous(tapGesture, panGesture)

  return (
    <YStack>
      <Pressable onPress={() => {
        if (note.attachment?.url) {
          onAudioToggle?.(note.id, resolveAttachmentUri(note.attachment.url))
        }
      }}>
        <XStack alignItems="center" gap="$2">
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
            {resampledWaveform && resampledWaveform.length > 0 ? (
              <GestureDetector gesture={composedGesture}>
                <View
                  style={{ height: BAR_MAX_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: BAR_GAP }}
                  onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
                >
                  {resampledWaveform.map((level, i) => (
                    <View
                      key={i}
                      style={{
                        width: BAR_WIDTH,
                        borderRadius: BAR_WIDTH / 2,
                        height: Math.max(3, (level / 100) * BAR_MAX_HEIGHT),
                        backgroundColor: i < playedBarCount ? accentColor : accentColorMuted,
                      }}
                    />
                  ))}
                </View>
              </GestureDetector>
            ) : (
              <YStack
                height={BAR_MAX_HEIGHT}
                justifyContent="center"
                onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
              >
                <YStack
                  height={4}
                  borderRadius={2}
                  backgroundColor="$accentColorMuted"
                  overflow="hidden"
                >
                  <YStack
                    height={4}
                    borderRadius={2}
                    backgroundColor="$accentColor"
                    width={`${Math.round(progressRatio * 100)}%`}
                  />
                </YStack>
              </YStack>
            )}
            <Text fontSize="$2" color="$colorSubtle">
              {displayTime}
            </Text>
          </YStack>
        </XStack>
      </Pressable>
      {note.content && (
        <Text fontSize={scaledFontSize} marginTop="$2" color={contentColor}>
          {note.content}
        </Text>
      )}
    </YStack>
  )
}

const MAX_LINES = 30

export function NoteBubble({ note, onLongPress, onPress, onTaskToggle, onImageView, onVideoView, onAudioToggle, onAudioSeek, playingNoteId, isAudioPlaying, audioPositionMs = 0, audioDurationMs = 0, isHighlighted = false, isSelected = false }: NoteBubbleProps) {
  const { brandText, paperText, iconColor, accentColor, accentColorMuted, background } = useThemeColor()
  const { fontScale } = useNoteFontScale()
  const { noteViewStyle } = useNoteViewStyle()
  const isPaper = noteViewStyle === 'paper'
  const scaledFontSize = Math.round(14 * fontScale)
  const contentColor = isPaper ? paperText : brandText
  const [isExpanded, setIsExpanded] = useState(false)

  // Non-text types and text with link preview should fill the bubble width
  const isMediaType = note.type !== 'text' || note.linkPreview != null

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
                  style={{ width: '100%', height: 200, borderRadius: 8 }}
                  contentFit="cover"
                />
              </Pressable>
            ) : note.attachment?.url ? (
              <MissingFile icon="image-outline" label="Photo unavailable" iconColor={iconColor} />
            ) : (
              <XStack
                backgroundColor="$backgroundStrong"
                borderRadius="$3"
                width="100%"
                height={200}
                alignItems="center"
                justifyContent="center"
              >
                <Ionicons name="image" size={40} color={iconColor} />
              </XStack>
            )}
            {note.content && (
              <Text fontSize={scaledFontSize} marginTop="$2" color={contentColor}>
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
                      style={{ width: '100%', height: 200, borderRadius: 8 }}
                      contentFit="cover"
                    />
                  ) : (
                    <XStack
                      backgroundColor="$backgroundStrong"
                      borderRadius="$3"
                      width="100%"
                      height={200}
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
              <Text fontSize={scaledFontSize} marginTop="$2" color={contentColor}>
                {note.content}
              </Text>
            )}
          </YStack>
        )
      }

      case 'voice': {
        return (
          <VoiceWaveform
            note={note}
            playingNoteId={playingNoteId ?? null}
            isAudioPlaying={isAudioPlaying ?? false}
            audioPositionMs={audioPositionMs}
            audioDurationMs={audioDurationMs}
            onAudioToggle={onAudioToggle}
            onAudioSeek={onAudioSeek}
            scaledFontSize={scaledFontSize}
            contentColor={contentColor}
            iconColor={iconColor}
            accentColor={accentColor}
            accentColorMuted={accentColorMuted}
            background={background}
          />
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
            <XStack alignItems="center" gap="$2">
              <XStack
                width={40}
                height={40}
                borderRadius="$2"
                backgroundColor="$accentColorMuted"
                alignItems="center"
                justifyContent="center"
              >
                <Ionicons name="document" size={24} color={contentColor} />
              </XStack>
              <YStack flex={1}>
                <Text fontSize="$3" fontWeight="500" numberOfLines={1} color={contentColor}>
                  {note.attachment?.filename || 'File'}
                </Text>
                <Text fontSize="$2" color="$colorSubtle">
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
                width="100%"
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
          <YStack gap="$1">
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
              <Text fontSize={scaledFontSize} fontWeight="600" color={contentColor}>
                {note.attachment?.filename || 'Contact'}
              </Text>
            </XStack>
            {note.content && (
              <Text fontSize="$3" color="$colorSubtle" numberOfLines={4}>
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
            <XStack alignItems="center" gap="$2">
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
                <Text fontSize="$3" fontWeight="500" numberOfLines={1} color={contentColor}>
                  {note.attachment?.filename || 'Audio'}
                </Text>
                <Text fontSize="$2" color="$colorSubtle">
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
        // Hide raw text if it's just a URL and we have a link preview with a title
        const contentIsJustUrl = note.linkPreview?.title && note.content?.trim().match(/^https?:\/\/\S+$/)
        return (
          <YStack>
            {!contentIsJustUrl && (
              <Text fontSize={scaledFontSize} color={contentColor}>
                {displayContent}
              </Text>
            )}
            {!contentIsJustUrl && needsTruncation && (
              <Pressable onPress={toggleExpand}>
                <Text fontSize="$3" color="$accentColor" marginTop="$1" fontWeight="600">
                  {isExpanded ? 'Show less' : 'View more...'}
                </Text>
              </Pressable>
            )}
            {note.linkPreview && (
              <YStack marginTop={contentIsJustUrl ? 0 : '$2'}>
                <LinkPreviewCard
                  url={note.linkPreview.url}
                  title={note.linkPreview.title}
                  description={note.linkPreview.description}
                  image={note.linkPreview.image}
                />
              </YStack>
            )}
          </YStack>
        )
      }
    }
  }

  return (
    <Pressable onLongPress={handleLongPress} onPress={handlePress}>
      <XStack
        justifyContent={isPaper ? 'flex-start' : 'flex-end'}
        alignItems="flex-start"
        paddingHorizontal={isPaper ? 0 : '$4'}
        marginVertical={isPaper ? 0 : '$1'}
        backgroundColor={showHighlight ? '$yellow4' : 'transparent'}
        paddingVertical={showHighlight ? '$1' : 0}
        position="relative"
      >
        <YStack
          backgroundColor={
            showHighlight
              ? '$yellow8'
              : isPaper
                ? '$paperBackground'
                : '$brandBackground'
          }
          paddingHorizontal={isPaper ? '$4' : '$3'}
          paddingTop="$2"
          paddingBottom="$1"
          borderRadius={isPaper ? 0 : '$4'}
          borderBottomRightRadius={isPaper ? 0 : '$1'}
          maxWidth={isPaper ? '100%' : '80%'}
          width={isPaper ? '100%' : isMediaType ? '80%' : undefined}
          position="relative"
          borderWidth={isPaper ? 0 : note.isStarred ? 1 : 0}
          borderColor="#F59E0B"
          borderBottomWidth={note.isStarred && !isPaper ? 1 : 0}
          borderBottomColor="#F59E0B"
          marginBottom={isPaper ? 10 : 0}
        >
          {note.isStarred && (
            <XStack position="absolute" left={isPaper ? 4 : -24} top={8}>
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
                color={contentColor}
              />
            </Pressable>
          )}

          <YStack paddingRight={note.task?.isTask ? '$6' : 0}>
            {renderContent()}
          </YStack>

          <XStack justifyContent="flex-end" alignItems="center" gap="$1" marginTop="$1">
            {note.isPinned && (
              <Ionicons name="pin" size={12} color="#F59E0B" />
            )}
            {note.isLocked && (
              <Ionicons name="lock-closed" size={12} color={contentColor} />
            )}
            {note.isEdited && (
              <Text fontSize={10} color="$colorSubtle" marginRight="$1">
                edited
              </Text>
            )}
            <Text fontSize={10} color="$colorSubtle">
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
              borderTopColor="$accentColorMuted"
            >
              <Ionicons name="alarm" size={12} color={contentColor} />
              <Text fontSize={10} color="$colorSubtle">
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
