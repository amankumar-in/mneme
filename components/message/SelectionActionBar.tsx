import { XStack, Text, Button, YStack } from 'tamagui'
import { Ionicons } from '@expo/vector-icons'
import { SquarePen } from 'lucide-react-native'
import { useThemeColor } from '../../hooks/useThemeColor'

interface SelectionActionBarProps {
  selectedCount: number
  onClose: () => void
  onLock: () => void
  onDelete: () => void
  onTask: () => void
  onEdit: () => void
  onStar: () => void
  allLocked: boolean
  allStarred: boolean
  allTasks: boolean
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
  onLock,
  onDelete,
  onTask,
  onEdit,
  onStar,
  allLocked,
  allStarred,
  allTasks,
  canEdit,
}: SelectionActionBarProps) {
  const { iconColorStrong } = useThemeColor()

  return (
    <XStack
      backgroundColor="$backgroundStrong"
      paddingHorizontal="$4"
      paddingVertical="$3"
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
