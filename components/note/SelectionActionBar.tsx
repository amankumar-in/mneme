import { XStack, Text, Button, YStack } from 'tamagui'
import { Ionicons } from '@expo/vector-icons'
import { SquarePen } from 'lucide-react-native'
import { useThemeColor } from '../../hooks/useThemeColor'

interface SelectionActionBarProps {
  selectedCount: number
  onClose: () => void
  onCopy: () => void
  onLock: () => void
  onDelete: () => void
  onTask: () => void
  onEdit: () => void
  onStar: () => void
  onPin: () => void
  allLocked: boolean
  allStarred: boolean
  allTasks: boolean
  allPinned: boolean
  canEdit: boolean
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

export function SelectionActionBar({
  selectedCount,
  onClose,
  onCopy,
  onLock,
  onDelete,
  onTask,
  onEdit,
  onStar,
  onPin,
  allLocked,
  allStarred,
  allTasks,
  allPinned,
  canEdit,
}: SelectionActionBarProps) {
  const { iconColorStrong } = useThemeColor()

  return (
    <XStack
      backgroundColor="$backgroundStrong"
      paddingHorizontal="$3"
      paddingVertical="$3"
      alignItems="center"
      borderTopWidth={1}
      borderTopColor="$borderColor"
    >
      {/* Close + Count */}
      <XStack alignItems="center" gap="$1">
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

      {/* Actions — fill remaining space, spread evenly */}
      <XStack flex={1} alignItems="center" justifyContent="flex-end" gap="$2">
        <Button
          size="$3"
          circular
          chromeless
          onPress={onCopy}
          icon={<Ionicons name="copy-outline" size={20} color="#6366F1" />}
        />
        <Separator />
        <Button
          size="$3"
          circular
          chromeless
          onPress={onEdit}
          disabled={!canEdit}
          opacity={canEdit ? 1 : 0.3}
          icon={<SquarePen size={20} color="#3B82F6" />}
        />
        <Separator />
        <Button
          size="$3"
          circular
          chromeless
          onPress={onStar}
          icon={<Ionicons name={allStarred ? 'star' : 'star-outline'} size={20} color="#F59E0B" />}
        />
        <Separator />
        <Button
          size="$3"
          circular
          chromeless
          onPress={onPin}
          icon={<Ionicons name={allPinned ? 'pin' : 'pin-outline'} size={20} color="#F97316" />}
        />
        <Separator />
        <Button
          size="$3"
          circular
          chromeless
          onPress={onTask}
          icon={
            <Ionicons
              name={allTasks ? 'alarm' : 'alarm-outline'}
              size={20}
              color="#8B5CF6"
            />
          }
        />
        <Separator />
        <Button
          size="$3"
          circular
          chromeless
          onPress={onLock}
          icon={
            <Ionicons
              name={allLocked ? 'lock-open-outline' : 'lock-closed-outline'}
              size={20}
              color="#10B981"
            />
          }
        />
        <Separator />
        <Button
          size="$3"
          circular
          chromeless
          onPress={onDelete}
          icon={<Ionicons name="trash-outline" size={20} color="#EF4444" />}
        />
      </XStack>
    </XStack>
  )
}
