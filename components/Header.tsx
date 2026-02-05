import { XStack, Text, Button } from 'tamagui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useThemeColor } from '../hooks/useThemeColor'

interface HeaderProps {
  title: string
  leftIcon?: {
    name?: keyof typeof Ionicons.glyphMap
    icon?: React.ReactNode
    onPress: () => void
  }
  rightIcon?: {
    name: keyof typeof Ionicons.glyphMap
    onPress: () => void
  }
}

export function Header({ title, leftIcon, rightIcon }: HeaderProps) {
  const insets = useSafeAreaInsets()
  const { iconColorStrong } = useThemeColor()

  return (
    <XStack
      paddingTop={insets.top + 8}
      paddingHorizontal="$4"
      paddingBottom="$2"
      backgroundColor="$background"
      alignItems="center"
      justifyContent="space-between"
    >
      <XStack width={44} justifyContent="flex-start">
        {leftIcon && (
          <Button
            size="$3"
            circular
            chromeless
            onPress={leftIcon.onPress}
            icon={
              leftIcon.icon ?? (
                <Ionicons name={leftIcon.name!} size={24} color={iconColorStrong} />
              )
            }
          />
        )}
      </XStack>

      <XStack>
        <Text fontSize="$7" fontWeight="700" color="$color" textTransform="lowercase">
          mne
        </Text>
        <Text fontSize="$7" fontWeight="700" color="$accentColor" textTransform="lowercase">
          me
        </Text>
      </XStack>

      <XStack width={44} justifyContent="flex-end">
        {rightIcon && (
          <Button
            size="$3"
            circular
            chromeless
            onPress={rightIcon.onPress}
            icon={<Ionicons name={rightIcon.name} size={24} color={iconColorStrong} />}
          />
        )}
      </XStack>
    </XStack>
  )
}
