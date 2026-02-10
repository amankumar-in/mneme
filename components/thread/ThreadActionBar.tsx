import { XStack, Text, Button, YStack } from 'tamagui'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useThemeColor } from '../../hooks/useThemeColor'
import { useWallpaper } from '../../contexts/WallpaperContext'

interface ThreadActionBarProps {
  selectedCount: number
  onClose: () => void
  onPin: () => void
  onExport: () => void
  onShortcut: () => void
  onDelete: () => void
  allPinned: boolean
  hideDelete?: boolean
}

function Separator() {
  return (
    <YStack
      width={1}
      height={20}
      backgroundColor="$borderColor"
      opacity={0.5}
    />
  )
}

export function ThreadActionBar({
  selectedCount,
  onClose,
  onPin,
  onExport,
  onShortcut,
  onDelete,
  allPinned,
  hideDelete,
}: ThreadActionBarProps) {
  const { iconColorStrong, warningColor, accentColor, errorColor, backgroundStrong } = useThemeColor()
  const { homeWallpaper } = useWallpaper()
  const insets = useSafeAreaInsets()

  return (
    <XStack
      backgroundColor={homeWallpaper ? backgroundStrong + 'CC' : '$backgroundStrong'}
      paddingHorizontal="$4"
      paddingTop="$3"
      paddingBottom={insets.bottom + 12}
      alignItems="center"
      justifyContent="space-between"
      borderTopWidth={1}
      borderTopColor="$borderColor"
    >
      <XStack alignItems="center" gap="$3">
        <Button
          size="$3"
          circular
          chromeless
          onPress={onClose}
          icon={<Ionicons name="close-outline" size={24} color={iconColorStrong} />}
        />
        <Text fontSize="$4" fontWeight="600" color="$color">
          {selectedCount}
        </Text>
      </XStack>

      <XStack alignItems="center" gap="$3">
        <Button
          size="$3"
          circular
          chromeless
          onPress={onPin}
          icon={
            <Ionicons
              name={allPinned ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={warningColor}
            />
          }
        />
        <Separator />
        <Button
          size="$3"
          circular
          chromeless
          onPress={onExport}
          icon={<Ionicons name="share-outline" size={20} color={accentColor} />}
        />
        <Separator />
        <Button
          size="$3"
          circular
          chromeless
          onPress={onShortcut}
          icon={<Ionicons name="home-outline" size={20} color={accentColor} />}
        />
        {!hideDelete && (
          <>
            <Separator />
            <Button
              size="$3"
              circular
              chromeless
              onPress={onDelete}
              icon={<Ionicons name="trash-outline" size={20} color={errorColor} />}
            />
          </>
        )}
      </XStack>
    </XStack>
  )
}
