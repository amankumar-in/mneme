import { XStack, YStack, Text } from 'tamagui'
import { Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useThemeColor } from '../hooks/useThemeColor'
import type { ThreadWithLastNote } from '../types'

interface ThreadListItemProps {
  thread: ThreadWithLastNote
  onPress?: () => void
  onLongPress?: () => void
  isSelected?: boolean
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d`

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function getNotePreview(thread: ThreadWithLastNote): string {
  if (!thread.lastNote) return 'It is a blank slate!'

  switch (thread.lastNote.type) {
    case 'image':
      return thread.lastNote.content || '📷 Photo'
    case 'video':
      return thread.lastNote.content || '🎬 Video'
    case 'voice':
      return '🎤 Voice note'
    case 'file':
      return `📄 ${thread.lastNote.content || 'File'}`
    case 'location':
      return '📍 Location'
    case 'contact':
      return `👤 ${thread.lastNote.content || 'Contact'}`
    case 'audio':
      return `🎵 ${thread.lastNote.content || 'Audio'}`
    default:
      return thread.lastNote.content || ''
  }
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function ThreadListItem({ thread, onPress, onLongPress, isSelected }: ThreadListItemProps) {
  const { warningColor } = useThemeColor()
  const timestamp = thread.lastNote?.timestamp || thread.createdAt

  return (
    <XStack
      paddingHorizontal="$4"
      paddingVertical="$3"
      gap="$3"
      alignItems="center"
      backgroundColor={isSelected ? '$yellow4' : 'transparent'}
      pressStyle={{ backgroundColor: '$backgroundHover' }}
      onPress={onPress}
      onLongPress={onLongPress}
      cursor="pointer"
    >
      <XStack width={48} height={48} position="relative">
        {thread.icon && (thread.icon.startsWith('file://') || thread.icon.startsWith('content://')) ? (
          <Image
            source={{ uri: thread.icon }}
            style={{ width: 48, height: 48, borderRadius: 24 }}
          />
        ) : (
          <XStack
            width={48}
            height={48}
            borderRadius={24}
            backgroundColor="$backgroundTinted"
            alignItems="center"
            justifyContent="center"
          >
            {thread.icon ? (
              <Text fontSize="$5">{thread.icon}</Text>
            ) : (
              <Text color="$accentColor" fontWeight="600">
                {getInitials(thread.name)}
              </Text>
            )}
          </XStack>
        )}
        {isSelected && (
          <XStack
            position="absolute"
            top={0}
            left={0}
            width={48}
            height={48}
            borderRadius={24}
            backgroundColor="$accentColor"
            opacity={0.85}
            alignItems="center"
            justifyContent="center"
          >
            <Ionicons name="checkmark" size={24} color="#fff" />
          </XStack>
        )}
      </XStack>

      <YStack flex={1} gap="$1">
        <XStack justifyContent="space-between" alignItems="center">
          <Text fontSize="$5" fontWeight="600" numberOfLines={1} flex={1} color="$color">
            {thread.name}
          </Text>
          <Text fontSize="$2" color="$colorSubtle">
            {formatRelativeTime(timestamp)}
          </Text>
        </XStack>

        <XStack alignItems="center" gap="$2">
          <Text fontSize="$3" color="$colorSubtle" numberOfLines={1} flex={1} ellipsizeMode="tail">
            {thread.isLocked ? 'Locked Thread' : getNotePreview(thread)}
          </Text>
          {thread.isLocked && (
            <Ionicons name="lock-closed" size={14} color={warningColor} />
          )}
          {thread.isPinned && (
            <Ionicons name="bookmark" size={14} color={warningColor} />
          )}
        </XStack>
      </YStack>
    </XStack>
  )
}
