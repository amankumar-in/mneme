import { XStack, Text, Button } from 'tamagui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useThemeColor } from '../hooks/useThemeColor'
import { useAppTheme } from '@/contexts/ThemeContext'
import LogoIconLight from '@/assets/images/logo-icon-light-mode.svg'
import LogoIconDark from '@/assets/images/logo-icon-dark-mode.svg'

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
  const { resolvedTheme } = useAppTheme()
  const LogoIcon = resolvedTheme === 'dark' ? LogoIconDark : LogoIconLight

  return (
    <XStack
      paddingTop={insets.top + 8}
      paddingHorizontal="$4"
      paddingBottom="$2"
      alignItems="center"
      justifyContent="space-between"
    >
      <XStack flex={1} alignItems="center" gap="$2">
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
        <XStack alignItems="center" gap="$2">
          <LogoIcon width={28} height={22} />
          <XStack>
            <Text fontSize="$7" fontWeight="700" color="$color">
              Later
            </Text>
            <Text fontSize="$7" fontWeight="700" color="$accentColor">
              Box
            </Text>
          </XStack>
        </XStack>
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
