import { Button } from 'tamagui'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useThemeColor } from '../hooks/useThemeColor'

interface FABProps {
  icon?: keyof typeof Ionicons.glyphMap
  onPress: () => void
  disabled?: boolean
}

export function FAB({ icon = 'add', onPress, disabled }: FABProps) {
  const { brandText } = useThemeColor()
  const insets = useSafeAreaInsets()

  return (
    <Button
      position="absolute"
      bottom={insets.bottom + 16}
      right="$4"
      size="$6"
      circular
      backgroundColor="$brandBackground"
      pressStyle={{ backgroundColor: '$brandBackgroundHover', scale: 0.95 }}
      elevation={4}
      onPress={onPress}
      disabled={disabled}
      opacity={disabled ? 0.5 : 1}
      icon={<Ionicons name={icon} size={28} color={brandText} />}
    />
  )
}
