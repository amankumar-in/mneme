import { useEffect } from 'react'
import { useDb } from '@/contexts/DatabaseContext'
import { getNoteRepository } from '@/services/repositories'
import {
  requestPermissions,
  scheduleTaskReminder,
} from '@/services/notifications/notification.service'
import { useUser } from './useUser'

/**
 * Initialize notifications on app startup.
 * - Requests permission if there are existing tasks with reminders
 * - Re-schedules any future task reminders that lost their notification_id
 *   (e.g. after app reinstall or on OEMs that clear scheduled notifications)
 *
 * Waits for user data to be loaded (via React Query) to avoid
 * racing with initializeLocalUser for database access.
 */
export function useNotifications() {
  const db = useDb()
  const { data: user } = useUser()

  useEffect(() => {
    // Wait until user is loaded to avoid racing with initializeLocalUser
    if (!user) return
    if (user.settings?.notifications?.taskReminders === false) return

    const init = async () => {
      const noteRepo = getNoteRepository(db)

      // Get tasks that need notifications scheduled
      const tasks = await noteRepo.getTasksNeedingNotifications()
      if (tasks.length === 0) return

      // Request permission only if we actually have tasks to schedule
      const granted = await requestPermissions()
      if (!granted) return

      // Schedule notifications for tasks missing them
      for (const task of tasks) {
        if (!task.task.reminderAt) continue
        const reminderDate = new Date(task.task.reminderAt)

        const notificationId = await scheduleTaskReminder(
          task.id,
          task.content || '',
          reminderDate,
          task.threadName
        )
        if (notificationId) {
          await noteRepo.saveNotificationId(task.id, notificationId)
        }
      }
    }

    init()
  }, [db, user])
}
