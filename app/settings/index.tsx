import { useDb } from '@/contexts/DatabaseContext'
import {
  cancelAllReminders,
  requestPermissions,
  scheduleTaskReminder,
} from '@/services/notifications/notification.service'
import { getNoteRepository } from '@/services/repositories'
import { Ionicons } from '@expo/vector-icons'
import { Directory, Paths } from 'expo-file-system/next'
import { useFocusEffect, useRouter } from 'expo-router'
import { Database, SunMoon } from 'lucide-react-native'
import { useCallback, useEffect, useState } from 'react'
import { Alert, Image, ScrollView, Switch } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Separator, Text, XStack, YStack } from 'tamagui'
import { ScreenBackground } from '../../components/ScreenBackground'
import { useSyncService } from '../../hooks/useSyncService'
import { useThemeColor } from '../../hooks/useThemeColor'
import { useDeleteServerAccount, useDeleteLocalData, useUpdateUser, useUser } from '../../hooks/useUser'
import { deleteAccountInfo, deleteRemoteData, logout, resolveAvatarUri } from '../../services/api'
import { clearAll, getAuthToken, getSyncEnabled, setSyncEnabled } from '../../services/storage'

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

interface SettingsItemProps {
  icon: keyof typeof Ionicons.glyphMap
  iconColor: string
  title: string
  subtitle?: string
  onPress: () => void
  showArrow?: boolean
  danger?: boolean
  customIcon?: React.ReactNode
}

function SettingsItem({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
  showArrow = true,
  danger = false,
  customIcon,
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
        {customIcon || <Ionicons name={icon} size={20} color={danger ? errorColor : iconColor} />}
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
  const db = useDb()
  const { data: user, refetch: refetchUser } = useUser()
  const updateUser = useUpdateUser()
  const { push, pull } = useSyncService()

  // Refetch user when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetchUser()
    }, [refetchUser])
  )

  // User must have at least one identifier for sync to work
  const hasIdentity = !!(user?.username || user?.email || user?.phone)
  const [dataSyncEnabled, setDataSyncEnabled] = useState(hasIdentity)

  // Load persisted sync preference on mount (otherwise restart would show default)
  useEffect(() => {
    getSyncEnabled().then(setDataSyncEnabled)
  }, [])

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  const handleProfile = useCallback(() => {
    router.push('/settings/profile')
  }, [router])

  const handlePrivacy = useCallback(() => {
    router.push('/settings/privacy')
  }, [router])

  const handleCustomize = useCallback(() => {
    router.push('/settings/customize')
  }, [router])

  const handleHelp = useCallback(() => {
    router.push('/settings/help')
  }, [router])

  const handleAbout = useCallback(() => {
    Alert.alert(
      'About LaterBox',
      'Version 1.0.0\n\nA privacy-focused, offline-first notes app with a familiar messaging interface. Your data stays on your device — cloud sync is entirely optional.\n\nMade by XCore Apps.'
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
                `Deleted ${stats.threadsDeleted} threads and ${stats.notesDeleted} notes from the server.`
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
      'This will remove your name, email, phone, username, and password. Your threads and notes will be preserved. Sync will be disabled until you set up your profile again.',
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
              Alert.alert('Account Info Deleted', 'Your profile information has been removed. Your threads and notes are preserved.')
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

  const deleteServer = useDeleteServerAccount()
  const deleteLocal = useDeleteLocalData()

  const performLocalDeletion = useCallback(async () => {
    await deleteLocal.mutateAsync()

    const mediaDir = new Directory(Paths.document, 'media')
    const cacheMediaDir = new Directory(Paths.cache, 'media')
    if (mediaDir.exists) mediaDir.delete()
    if (cacheMediaDir.exists) cacheMediaDir.delete()

    Alert.alert(
      'Everything Deleted',
      'All your data has been deleted. The app will restart.',
      [{ text: 'OK', onPress: () => router.replace('/') }]
    )
  }, [deleteLocal, router])

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
            const token = await getAuthToken()

            if (!token) {
              try {
                await performLocalDeletion()
              } catch (error: any) {
                Alert.alert('Error', error.message || 'Failed to delete local data')
              }
              return
            }

            // Authenticated — try server deletion first
            try {
              await deleteServer.mutateAsync()
            } catch (serverError: any) {
              // AUTH_CLEARED means server account is already gone — treat as success
              if (serverError.message !== 'AUTH_CLEARED') {
                Alert.alert(
                  'Server Deletion Failed',
                  'Could not delete your account from the server. Your server data (including username) will remain if you continue.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Retry', onPress: () => handleDeleteEverything() },
                    {
                      text: 'Delete Local Only',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await performLocalDeletion()
                        } catch (error: any) {
                          Alert.alert('Error', error.message || 'Failed to delete local data')
                        }
                      },
                    },
                  ]
                )
                return
              }
            }

            // Server deletion succeeded — now delete local
            try {
              await performLocalDeletion()
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete local data')
            }
          },
        },
      ]
    )
  }, [deleteServer, performLocalDeletion])

  return (
    <ScreenBackground>
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
              source={{ uri: resolveAvatarUri(user.avatar) || user.avatar }}
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
                {getInitials(user?.name || 'Me')}
              </Text>
            </XStack>
          )}

          <YStack flex={1}>
            <Text fontSize="$5" fontWeight="600" color="$color">
              {user?.name || 'Me'}
            </Text>
            <XStack alignItems="center" gap="$1.5">
              <Ionicons
                name={hasIdentity && dataSyncEnabled ? 'cloud-done-outline' : 'cloud-offline-outline'}
                size={14}
                color={hasIdentity && dataSyncEnabled ? successColor : warningColor}
              />
              <Text fontSize="$3" color="$colorSubtle">
                {user?.username ? `@${user.username}` : user?.phone || user?.email || 'Online identity not set'}
              </Text>
            </XStack>
          </YStack>

          <XStack backgroundColor="$backgroundStrong" paddingHorizontal="$2" paddingVertical="$1" borderRadius="$2">
            <Text fontSize="$2" color="$colorSubtle">View Profile</Text>
          </XStack>
        </XStack>

        <Separator />

        <SettingsToggleItem
          icon="alarm-outline"
          iconColor={warningColor}
          title="Task Reminders"
          subtitle="Get notified when a task reminder is due"
          value={user?.settings?.notifications?.taskReminders ?? true}
          onValueChange={async (value) => {
            updateUser.mutate({
              settings: {
                ...user?.settings,
                notifications: {
                  taskReminders: value,
                  sharedNotes: user?.settings?.notifications?.sharedNotes ?? true,
                },
              },
            })

            const noteRepo = getNoteRepository(db)

            if (!value) {
              // Turning OFF: cancel all scheduled notifications and clear IDs
              await cancelAllReminders()
              await noteRepo.clearAllNotificationIds()
            } else {
              // Turning ON: reschedule all future task reminders
              const granted = await requestPermissions()
              if (!granted) return

              const tasks = await noteRepo.getTasksNeedingNotifications()
              for (const task of tasks) {
                if (!task.task.reminderAt) continue
                const notificationId = await scheduleTaskReminder(
                  task.id,
                  task.content || '',
                  new Date(task.task.reminderAt),
                  task.threadName
                )
                if (notificationId) {
                  await noteRepo.saveNotificationId(task.id, notificationId)
                }
              }
            }
          }}
          trackColor={warningColor}
        />
        <SettingsItem
          icon="color-palette-outline"
          iconColor={accentColor}
          title="Customize"
          subtitle="Appearance and theme"
          onPress={handleCustomize}
          customIcon={<SunMoon size={20} color={accentColor} />}
        />

        <SectionHeader title="Security" />
        <SettingsItem
          icon="lock-closed-outline"
          iconColor={accentColor}
          title="App Lock"
          subtitle="Biometric and PIN protection"
          onPress={() => router.push('/settings/app-lock')}
        />
        <SettingsItem
          icon="trash-outline"
          iconColor={warningColor}
          title="Recently Deleted"
          subtitle="Restore or permanently delete items"
          onPress={() => router.push('/settings/trash')}
        />

        <SectionHeader title="Data Control" />
        <SettingsToggleItem
          icon={hasIdentity && dataSyncEnabled ? 'cloud-done-outline' : 'cloud-offline-outline'}
          iconColor={hasIdentity && dataSyncEnabled ? accentColor : iconColor}
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
            setSyncEnabled(value).then(() => {
              if (value) {
                push()
                  .catch((e) => {
                    if (e?.message !== 'AUTH_CLEARED') console.warn('[Settings] Sync on: push failed', e?.message)
                  })
                  .then(() => pull())
                  .catch((e) => {
                    if (e?.message !== 'AUTH_CLEARED') console.warn('[Settings] Sync on: pull failed', e?.message)
                  })
              }
            })
          }}
          trackColor={accentColor}
        />
        <SettingsItem
          icon="server-outline"
          iconColor={warningColor}
          customIcon={<Database size={20} color={warningColor} />}
          title="Delete Remote Data"
          subtitle="Remove all threads, tasks, and notes from cloud"
          onPress={handleDeleteRemoteData}
          showArrow={false}
        />
        <SettingsItem
          icon="person-remove-outline"
          iconColor={warningColor}
          title="Delete Account Information"
subtitle="Remove identity data from cloud and this device"          onPress={handleDeleteAccountInfo}
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
          icon="trash-outline"
          iconColor=""
          title="Delete Everything"
          subtitle="Remove all data from cloud and this device"
          onPress={handleDeleteEverything}
          showArrow={false}
          danger
        />

        <SectionHeader title="Information" />
        <SettingsItem
          icon="shield-checkmark-outline"
          iconColor={successColor}
          title="End-to-End Encryption"
          subtitle="Data encrypted before sync"
          onPress={() => {
            Alert.alert(
              'End-to-End Encryption',
              'When enabled, your notes and thread names are encrypted on your device before syncing. Only you can decrypt them with your password.\n\nThis feature activates automatically when you have an account with a password and sync is enabled.',
              [{ text: 'OK' }]
            )
          }}
        />
        <SettingsItem
          icon="help-circle-outline"
          iconColor="#6366f1"
          title="Help"
          subtitle="Frequently asked questions"
          onPress={handleHelp}
        />
        <SettingsItem
          icon="information-circle-outline"
          iconColor={iconColor}
          title="About LaterBox"
          onPress={handleAbout}
        />

        <YStack height={insets.bottom + 20} />
      </ScrollView>
    </ScreenBackground>
  )
}
