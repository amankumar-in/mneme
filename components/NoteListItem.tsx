import { XStack, YStack, Text } from 'tamagui'
import { Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useThemeColor } from '../hooks/useThemeColor'
import type { Chat } from '../types'

interface NoteListItemProps {
  chat: Chat
  onPress: () => void
  onLongPress: () => void
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

function getMessagePreview(chat: Chat): string {
  if (!chat.lastMessage) return 'It is a blank slate!'

  switch (chat.lastMessage.type) {
    case 'image':
      return '📷 Photo'
    case 'voice':
      return '🎤 Voice note'
    case 'file':
      return '📎 File'
    case 'location':
      return '📍 Location'
    default:
      return chat.lastMessage.content || ''
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function NoteListItem({ chat, onPress, onLongPress }: NoteListItemProps) {
  const { warningColor } = useThemeColor()
  const timestamp = chat.lastMessage?.timestamp || chat.updatedAt

  return (
    <XStack
      paddingHorizontal="$4"
      paddingVertical="$3"
      gap="$3"
      alignItems="center"
      backgroundColor="$background"
      pressStyle={{ backgroundColor: '$backgroundHover' }}
      onPress={onPress}
      onLongPress={onLongPress}
      cursor="pointer"
    >
      {chat.icon && (chat.icon.startsWith('file://') || chat.icon.startsWith('content://')) ? (
        <Image
          source={{ uri: chat.icon }}
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
          {chat.icon ? (
            <Text fontSize="$5">{chat.icon}</Text>
          ) : (
            <Text color="$accentColor" fontWeight="600">
              {getInitials(chat.name)}
            </Text>
          )}
        </XStack>
      )}

      <YStack flex={1} gap="$1">
        <XStack justifyContent="space-between" alignItems="center">
          <Text fontSize="$5" fontWeight="600" numberOfLines={1} flex={1} color="$color">
            {chat.name}
          </Text>
          <Text fontSize="$2" color="$colorSubtle">
            {formatRelativeTime(timestamp)}
          </Text>
        </XStack>

        <XStack alignItems="center" gap="$2">
          <Text fontSize="$3" color="$colorSubtle" numberOfLines={1} flex={1} ellipsizeMode="tail">
            {getMessagePreview(chat)}
          </Text>
          {chat.isPinned && (
            <Ionicons name="bookmark" size={14} color={warningColor} />
          )}
        </XStack>
      </YStack>
    </XStack>
  )
}
