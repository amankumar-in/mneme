import { useCallback } from 'react'
import Shortcuts from '@rn-org/react-native-shortcuts'
import type { ThreadWithLastNote } from '../types'

export function useShortcuts() {
  const addShortcut = useCallback(async (thread: ThreadWithLastNote) => {
    try {
      const isSupported = await Shortcuts.isShortcutSupported()
      if (!isSupported) {
        console.warn('Shortcuts not supported on this device')
        return false
      }

      // Check if shortcut already exists
      const exists = await Shortcuts.isShortcutExists(thread.id)
      if (exists) {
        // Update existing shortcut
        await Shortcuts.updateShortcut({
          id: thread.id,
          title: thread.name,
          longLabel: thread.lastNote?.content?.slice(0, 25) || thread.name,
          subTitle: thread.lastNote?.content?.slice(0, 50) || 'Open thread',
          iconName: 'shortcut_icon',
          symbolName: 'note.text',
        })
      } else {
        // Add new shortcut
        await Shortcuts.addShortcut({
          id: thread.id,
          title: thread.name,
          longLabel: thread.lastNote?.content?.slice(0, 25) || thread.name,
          subTitle: thread.lastNote?.content?.slice(0, 50) || 'Open thread',
          iconName: 'shortcut_icon',
          symbolName: 'note.text',
        })
      }

      return true
    } catch (error) {
      console.error('Failed to add shortcut:', error)
      return false
    }
  }, [])

  const removeShortcut = useCallback(async (threadId: string) => {
    try {
      await Shortcuts.removeShortcut(threadId)
      return true
    } catch (error) {
      console.error('Failed to remove shortcut:', error)
      return false
    }
  }, [])

  const clearShortcuts = useCallback(async () => {
    try {
      await Shortcuts.removeAllShortcuts()
      return true
    } catch (error) {
      console.error('Failed to clear shortcuts:', error)
      return false
    }
  }, [])

  return {
    addShortcut,
    removeShortcut,
    clearShortcuts,
  }
}
