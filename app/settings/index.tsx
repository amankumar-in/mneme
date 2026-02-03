import { useState, useCallback } from 'react'
import { useFocusEffect } from 'expo-router'
import { ScrollView, Alert, Image, Switch } from 'react-native'
import { YStack, XStack, Text, Button, Separator } from 'tamagui'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Directory, Paths } from 'expo-file-system/next'
import { useThemeColor } from '../../hooks/useThemeColor'
import { useUser, useUpdateUser, useDeleteAccount } from '../../hooks/useUser'
import { deleteRemoteData, deleteAccountInfo, logout } from '../../services/api'
import { clearAll } from '../../services/storage'

interface SettingsItemProps {
  icon: keyof typeof Ionicons.glyphMap
  iconColor: string
  title: string
  subtitle?: string
  onPress: () => void
  showArrow?: boolean
  danger?: boolean
}

function SettingsItem({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
  showArrow = true,
  danger = false,
}: SettingsItemProps) {
  const { iconColor: defaultIconColor, errorColor } = useThemeColor()

  return (
    <XStack
      paddingHorizontal="$4"
      paddingVertical="$3"
      gap="$3"
      alignItems="center"
      pressStyle={{ backgroundColor: '$backgroundHover' }}
      onPress={onPress}
    >
      <XStack
        width={36}
        height={36}
        borderRadius="$2"
        backgroundColor={danger ? '$red3' : '$backgroundStrong'}
        alignItems="center"
        justifyContent="center"
      >
        <Ionicons name={icon} size={20} color={danger ? errorColor : iconColor} />
      </XStack>

      <YStack flex={1}>
        <Text fontSize="$4" color={danger ? '$errorColor' : '$color'}>
          {title}
        </Text>
        {subtitle && (
          <Text fontSize="$2" color="$colorSubtle">
            {subtitle}
          </Text>
        )}
      </YStack>

      {showArrow && <Ionicons name="chevron-forward" size={20} color={defaultIconColor} />}
    </XStack>
  )
}

interface SettingsToggleItemProps {
  icon: keyof typeof Ionicons.glyphMap
  iconColor: string
  title: string
  subtitle?: string
  value: boolean
  onValueChange: (value: boolean) => void
  trackColor: string
}

function SettingsToggleItem({
  icon,
  iconColor,
  title,
  subtitle,
  value,
  onValueChange,
  trackColor,
}: SettingsToggleItemProps) {
  return (
    <XStack
      paddingHorizontal="$4"
      paddingVertical="$3"
      gap="$3"
      alignItems="center"
    >
      <XStack
        width={36}
        height={36}
        borderRadius="$2"
        backgroundColor="$backgroundStrong"
        alignItems="center"
        justifyContent="center"
      >
        <Ionicons name={icon} size={20} color={iconColor} />
      </XStack>

      <YStack flex={1}>
        <Text fontSize="$4" color="$color">
          {title}
        </Text>
        {subtitle && (
          <Text fontSize="$2" color="$colorSubtle">
            {subtitle}
          </Text>
        )}
      </YStack>

      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#767577', true: trackColor }}
        thumbColor="white"
      />
    </XStack>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text
      fontSize="$2"
      fontWeight="600"
      color="$colorSubtle"
      paddingHorizontal="$4"
      paddingTop="$4"
      paddingBottom="$2"
      textTransform="uppercase"
    >
      {title}
    </Text>
  )
}

export default function SettingsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { iconColorStrong, iconColor, brandText, accentColor, successColor, warningColor, infoColor, errorColor } = useThemeColor()
  const { data: user, refetch: refetchUser } = useUser()
  const updateUser = useUpdateUser()

  // Refetch user when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetchUser()
    }, [refetchUser])
  )

  // User must have at least one identifier for sync to work
  const hasIdentity = !!(user?.username || user?.email || user?.phone)
  const [dataSyncEnabled, setDataSyncEnabled] = useState(hasIdentity)

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  const handleProfile = useCallback(() => {
    router.push('/settings/profile')
  }, [router])

  const handlePrivacy = useCallback(() => {
    router.push('/settings/privacy')
  }, [router])

  const handleTheme = useCallback(() => {
    Alert.alert('Theme', 'Choose a theme', [
      { text: 'Light', onPress: () => console.log('Light') },
      { text: 'Dark', onPress: () => console.log('Dark') },
      { text: 'System (Default)', onPress: () => console.log('System') },
      { text: 'Cancel', style: 'cancel' },
    ])
  }, [])

  const handleHelp = useCallback(() => {
    console.log('Help')
  }, [])

  const handleAbout = useCallback(() => {
    Alert.alert(
      'About Mneme',
      'Version 1.0.0\n\nA personal note-taking app using familiar instant messaging UI.\n\nBuilt with Expo and Tamagui.'
    )
  }, [])

  const handleDeleteRemoteData = useCallback(() => {
    Alert.alert(
      'Delete Remote Data',
      'This will permanently delete all threads, tasks, and notes stored online. Local data will remain. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const stats = await deleteRemoteData()
              Alert.alert(
                'Remote Data Deleted',
                `Deleted ${stats.chatsDeleted} threads and ${stats.messagesDeleted} messages from the server.`
              )
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.error || 'Failed to delete remote data')
            }
          },
        },
      ]
    )
  }, [])

  const handleDeleteAccountInfo = useCallback(() => {
    Alert.alert(
      'Delete Account Information',
      'This will remove your name, email, phone, username, and password. Your threads and messages will be preserved. Sync will be disabled until you set up your profile again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccountInfo()
              // Clear local user data to match server state
              await updateUser.mutateAsync({
                username: null,
                email: null,
                phone: null,
                avatar: null,
                name: 'Me',
              })
              // Clear auth token since credentials are deleted
              await logout()
              Alert.alert('Account Info Deleted', 'Your profile information has been removed. Your threads and messages are preserved.')
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.error || 'Failed to delete account information')
            }
          },
        },
      ]
    )
  }, [updateUser])

  const handleDeleteMedia = useCallback(() => {
    Alert.alert(
      'Delete All Media',
      'This will delete all photos, videos, and files stored locally. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete local media directories
              const mediaDir = new Directory(Paths.document, 'media')
              const cacheMediaDir = new Directory(Paths.cache, 'media')

              if (mediaDir.exists) {
                mediaDir.delete()
              }

              if (cacheMediaDir.exists) {
                cacheMediaDir.delete()
              }

              Alert.alert('Media Deleted', 'All locally stored media has been deleted.')
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete media')
            }
          },
        },
      ]
    )
  }, [])

  const deleteAccount = useDeleteAccount()

  const handleDeleteEverything = useCallback(() => {
    Alert.alert(
      'Delete Everything',
      'This will delete all remote data, local data, settings, and reset the app as if started for the first time. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete from server first (if authenticated)
              await deleteAccount.mutateAsync()

              // Clear local storage
              await clearAll()

              // Delete local media
              const mediaDir = new Directory(Paths.document, 'media')
              const cacheMediaDir = new Directory(Paths.cache, 'media')

              if (mediaDir.exists) {
                mediaDir.delete()
              }

              if (cacheMediaDir.exists) {
                cacheMediaDir.delete()
              }

              Alert.alert(
                'Everything Deleted',
                'All your data has been deleted. The app will restart.',
                [{ text: 'OK', onPress: () => router.replace('/') }]
              )
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.error || error.message || 'Failed to delete everything')
            }
          },
        },
      ]
    )
  }, [deleteAccount, router])

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
          Settings
        </Text>
      </XStack>

      <ScrollView>
        <XStack
          paddingHorizontal="$4"
          paddingVertical="$4"
          gap="$3"
          alignItems="center"
          pressStyle={{ backgroundColor: '$backgroundHover' }}
          onPress={handleProfile}
        >
          {user?.avatar ? (
            <Image
              source={{ uri: user.avatar }}
              style={{ width: 60, height: 60, borderRadius: 30 }}
            />
          ) : (
            <XStack
              width={60}
              height={60}
              borderRadius={30}
              backgroundColor="$brandBackground"
              alignItems="center"
              justifyContent="center"
            >
              <Text color={brandText} fontSize="$6" fontWeight="600">
                {(user?.name || 'Me').slice(0, 2).toUpperCase()}
              </Text>
            </XStack>
          )}

          <YStack flex={1}>
            <Text fontSize="$5" fontWeight="600" color="$color">
              {user?.name || 'Me'}
            </Text>
            <Text fontSize="$3" color="$colorSubtle">
              {user?.username ? `@${user.username}` : 'Username not set'}
            </Text>
          </YStack>

          <XStack backgroundColor="$backgroundStrong" paddingHorizontal="$2" paddingVertical="$1" borderRadius="$2">
            <Text fontSize="$2" color="$colorSubtle">View Profile</Text>
          </XStack>
        </XStack>

        <Separator />

        <SettingsItem
          icon="lock-closed-outline"
          iconColor={successColor}
          title="Privacy"
          subtitle="Who can find you"
          onPress={handlePrivacy}
        />
        <SettingsToggleItem
          icon="alarm-outline"
          iconColor={warningColor}
          title="Task Reminders"
          subtitle="Get notified when a task reminder is due"
          value={user?.settings?.notifications?.taskReminders ?? true}
          onValueChange={(value) => {
            updateUser.mutate({
              settings: {
                ...user?.settings,
                notifications: {
                  ...user?.settings?.notifications,
                  taskReminders: value,
                },
              },
            })
          }}
          trackColor={warningColor}
        />
        <SettingsItem
          icon="color-palette-outline"
          iconColor="#8b5cf6"
          title="Theme"
          subtitle="System"
          onPress={handleTheme}
        />
        <SettingsItem
          icon="help-circle-outline"
          iconColor="#6366f1"
          title="Help"
          onPress={handleHelp}
        />
        <SettingsItem
          icon="information-circle-outline"
          iconColor={iconColor}
          title="About Mneme"
          onPress={handleAbout}
        />

        <SectionHeader title="Data Control" />
        <SettingsToggleItem
          icon="sync-outline"
          iconColor={hasIdentity ? accentColor : iconColor}
          title="Data Sync"
          subtitle={
            !hasIdentity
              ? 'Set username, email, or phone to enable sync'
              : dataSyncEnabled
                ? 'Syncing to cloud backup'
                : 'Fully offline mode'
          }
          value={hasIdentity && dataSyncEnabled}
          onValueChange={(value) => {
            if (!hasIdentity) {
              Alert.alert(
                'Identity Required',
                'Set a username, email, or phone number in your profile to enable sync.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Go to Profile', onPress: () => router.push('/settings/profile') },
                ]
              )
              return
            }
            setDataSyncEnabled(value)
          }}
          trackColor={accentColor}
        />
        <SettingsItem
          icon="cloud-offline-outline"
          iconColor={warningColor}
          title="Delete Remote Data"
          subtitle="Remove all threads, tasks, and notes from cloud"
          onPress={handleDeleteRemoteData}
          showArrow={false}
        />
        <SettingsItem
          icon="person-remove-outline"
          iconColor={warningColor}
          title="Delete Account Information"
          subtitle="Remove name, email, phone, username"
          onPress={handleDeleteAccountInfo}
          showArrow={false}
        />
        <SettingsItem
          icon="images-outline"
          iconColor={warningColor}
          title="Delete All Media"
          subtitle="Remove all locally stored photos and files"
          onPress={handleDeleteMedia}
          showArrow={false}
        />
        <SettingsItem
          icon="nuclear-outline"
          iconColor=""
          title="Delete Everything"
          subtitle="Reset app to factory state"
          onPress={handleDeleteEverything}
          showArrow={false}
          danger
        />

        <YStack height={insets.bottom + 20} />
      </ScrollView>
    </YStack>
  )
}
