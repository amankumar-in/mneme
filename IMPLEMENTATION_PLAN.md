# Mneme App - Implementation Plan & Bug Tracker

## Session Summary (Feb 4, 2026)

---

## CRITICAL REQUIREMENT: Equal-Rank Authentication

**All 3 identifiers (username, email, phone) must have EQUAL rank:**
- User can authenticate with ANY of the three
- Verifying one auto-fetches the others from existing account
- Example: Reinstall app → verify phone → username and email auto-fetched
- Sync can be enabled if any of these is set but sync is optional.


# Do not use tamagui input fields if placeholder is needed. instead use react native

not receiving reminder notification.

Android Bundled 130ms node_modules/expo-router/entry.js (1 module)
 LOG  [Notifications] Android channel created
 LOG  [Sync] No pending changes to push
 LOG  [Sync] Pull completed successfully
 LOG  [Task] onSuccess: {"isCompleted": undefined, "isTask": true, "noteId": "45672c53-9e90-433e-987d-ec5c8d085156", "reminderAt": "2026-02-06T05:12:00.000Z"}
 LOG  [Task] Notification check: {"hasReminderAt": true, "isCompleted": undefined, "isTask": true}
 LOG  [Task] User taskReminders: true
 LOG  [Notifications] Scheduled: 4da2e7e4-53c7-4b66-ad5a-b49aa2224a55 for 2026-02-06T05:12:00.000Z
 LOG  [Notifications] Total scheduled: 3
 LOG  [Task] Notification result: 4da2e7e4-53c7-4b66-ad5a-b49aa2224a55
 LOG  [Sync] Push completed successfully


tested with app in foreground, background both. do not make any edits. do not create any plans. only find the issue. use context7 mcp to learn.