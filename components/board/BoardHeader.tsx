import { XStack, Text, Button } from 'tamagui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useThemeColor } from '../../hooks/useThemeColor'
import { Image } from 'react-native'
import type { Board } from '../../types'

interface BoardHeaderProps {
  board: Board
  zoom: number
  onBack: () => void
  onBoardPress: () => void
  onShare: () => void
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function BoardHeader({ board, zoom, onBack, onBoardPress, onShare }: BoardHeaderProps) {
  const insets = useSafeAreaInsets()
  const { iconColorStrong, brandText } = useThemeColor()

  const zoomPercent = Math.round(zoom * 100)

  return (
    <XStack
      paddingTop={insets.top + 8}
      paddingHorizontal="$4"
      paddingBottom="$2"
      alignItems="center"
      gap="$2"
    >
      <Button
        size="$3"
        circular
        chromeless
        onPress={onBack}
        icon={<Ionicons name="arrow-back" size={24} color={iconColorStrong} />}
      />

      <XStack
        flex={1}
        alignItems="center"
        gap="$2"
        onPress={onBoardPress}
        pressStyle={{ opacity: 0.7 }}
      >
        <XStack
          width={36}
          height={36}
          borderRadius={18}
          backgroundColor="$brandBackground"
          alignItems="center"
          justifyContent="center"
          overflow="hidden"
        >
          {board.icon ? (
            board.icon.startsWith('file://') || board.icon.startsWith('content://') ? (
              <Image
                source={{ uri: board.icon }}
                style={{ width: 36, height: 36, borderRadius: 18 }}
              />
            ) : (
              <Text fontSize="$5">{board.icon}</Text>
            )
          ) : (
            <Text color={brandText} fontWeight="600" fontSize="$3">
              {getInitials(board.name)}
            </Text>
          )}
        </XStack>
        <Text fontSize="$5" fontWeight="600" numberOfLines={1} flex={1} color="$color">
          {board.name}
        </Text>
      </XStack>

      <XStack gap="$2" alignItems="center">
        <Text color="$colorSubtle" fontSize="$2">{zoomPercent}%</Text>
        <Button
          size="$3"
          circular
          chromeless
          onPress={onShare}
          icon={<Ionicons name="share-outline" size={22} color={iconColorStrong} />}
        />
      </XStack>
    </XStack>
  )
}
