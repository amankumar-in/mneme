import { useCallback } from 'react'
import { YStack, XStack, Text, Button } from 'tamagui'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useThemeColor } from '../../hooks/useThemeColor'
import { useUser, useUpdateUser } from '../../hooks/useUser'

type Visibility = 'public' | 'private' | 'contacts'

interface OptionProps {
  value: Visibility
  label: string
  description: string
  selected: boolean
  onSelect: () => void
}

function Option({ value, label, description, selected, onSelect }: OptionProps) {
  return (
    <XStack
      paddingVertical="$3"
      paddingHorizontal="$4"
      gap="$3"
      alignItems="flex-start"
      backgroundColor={selected ? '$blue2' : 'transparent'}
      borderRadius="$3"
      pressStyle={{ backgroundColor: '$backgroundHover' }}
      onPress={onSelect}
    >
      <XStack
        width={24}
        height={24}
        borderRadius={12}
        borderWidth={2}
        borderColor={selected ? '$brandBackground' : '$borderColor'}
        alignItems="center"
        justifyContent="center"
        marginTop="$0.5"
      >
        {selected && (
          <XStack
            width={12}
            height={12}
            borderRadius={6}
            backgroundColor="$brandBackground"
          />
        )}
      </XStack>

      <YStack flex={1}>
        <Text fontSize="$4" fontWeight="500" color="$color">
          {label}
        </Text>
        <Text fontSize="$3" color="$colorSubtle" marginTop="$1">
          {description}
        </Text>
      </YStack>
    </XStack>
  )
}

export default function PrivacyScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { iconColorStrong, iconColor } = useThemeColor()
  const { data: user } = useUser()
  const updateUser = useUpdateUser()

  const visibility = (user?.settings?.privacy?.visibility ?? 'private') as Visibility

  const handleVisibilityChange = useCallback((newVisibility: Visibility) => {
    updateUser.mutate({
      settings: {
        ...user?.settings,
        privacy: {
          ...user?.settings?.privacy,
          visibility: newVisibility,
        },
      },
    })
  }, [updateUser, user?.settings])

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  return (
    <YStack flex={1} backgroundColor="$background">
      <XStack
        paddingTop={insets.top + 8}
        paddingHorizontal="$4"
        paddingBottom="$2"
        backgroundColor="$background"
        alignItems="center"
        gap="$2"
        borderBottomWidth={1}
        borderBottomColor="$borderColor"
      >
        <Button
          size="$3"
          circular
          chromeless
          onPress={handleBack}
          icon={<Ionicons name="arrow-back" size={24} color={iconColorStrong} />}
        />
        <Text fontSize="$6" fontWeight="700" flex={1} color="$color">
          Privacy
        </Text>
      </XStack>

      <YStack padding="$4">
        <Text fontSize="$4" fontWeight="600" marginBottom="$2" color="$color">
          Who can find me
        </Text>
        <Text fontSize="$3" color="$colorSubtle" marginBottom="$4">
          Control who can look you up by username, email, or phone to share notes with
          you.
        </Text>

        <YStack gap="$2">
          <Option
            value="public"
            label="Everyone"
            description="Anyone can find and share notes with you"
            selected={visibility === 'public'}
            onSelect={() => handleVisibilityChange('public')}
          />

          <Option
            value="contacts"
            label="Contacts Only"
            description="Only people who have shared with you before can find you"
            selected={visibility === 'contacts'}
            onSelect={() => handleVisibilityChange('contacts')}
          />

          <Option
            value="private"
            label="No One"
            description="Nobody can find you or share notes with you"
            selected={visibility === 'private'}
            onSelect={() => handleVisibilityChange('private')}
          />
        </YStack>

        <YStack
          backgroundColor="$backgroundStrong"
          padding="$3"
          borderRadius="$3"
          marginTop="$6"
        >
          <XStack alignItems="flex-start" gap="$2">
            <Ionicons name="shield-checkmark" size={20} color={iconColor} />
            <YStack flex={1}>
              <Text fontSize="$3" fontWeight="500" color="$color">
                Your notes are always private
              </Text>
              <Text fontSize="$2" color="$colorSubtle" marginTop="$1">
                This setting only controls who can find you to share notes. Your personal
                notes remain completely private and encrypted on your device.
              </Text>
            </YStack>
          </XStack>
        </YStack>
      </YStack>
    </YStack>
  )
}
