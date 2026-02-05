import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'

// Configure foreground notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

// Set up default Android notification channel
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('task-reminders', {
    name: 'Task Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
  }).then(() => {
    console.log('[Notifications] Android channel created')
  })
}

// Log when notifications are actually received/displayed
Notifications.addNotificationReceivedListener((notification) => {
  console.log('[Notifications] RECEIVED:', notification.request.identifier)
})

Notifications.addNotificationResponseReceivedListener((response) => {
  console.log('[Notifications] TAPPED:', response.notification.request.identifier)
})

export async function requestPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync()
  if (existing === 'granted') return true
  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

export async function scheduleTaskReminder(
  noteId: string,
  content: string,
  reminderAt: Date,
  threadName?: string
): Promise<string | null> {
  // Don't schedule if the date is in the past
  if (reminderAt.getTime() <= Date.now()) {
    console.log('[Notifications] Skipped - reminder date is in the past:', reminderAt.toISOString())
    return null
  }

  const hasPermission = await requestPermissions()
  if (!hasPermission) {
    console.log('[Notifications] Skipped - permission not granted')
    return null
  }

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: threadName ? `Reminder · ${threadName}` : 'Task Reminder',
        body: content || 'You have a task due',
        data: { noteId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderAt,
        channelId: Platform.OS === 'android' ? 'task-reminders' : undefined,
      },
    })

    console.log('[Notifications] Scheduled:', notificationId, 'for', reminderAt.toISOString())

    // Verify it was actually scheduled
    const scheduled = await Notifications.getAllScheduledNotificationsAsync()
    console.log('[Notifications] Total scheduled:', scheduled.length)

    return notificationId
  } catch (error) {
    console.error('[Notifications] Failed to schedule:', error)
    return null
  }
}

export async function cancelReminder(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId)
  } catch {
    // Notification may already have fired or been dismissed
  }
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync()
}
