import { useCallback } from 'react'
import Shortcuts from '@rn-org/react-native-shortcuts'
import type { Chat } from '../types'

export function useShortcuts() {
  const addShortcut = useCallback(async (chat: Chat) => {
    try {
      const isSupported = await Shortcuts.isShortcutSupported()
      if (!isSupported) {
        console.warn('Shortcuts not supported on this device')
        return false
      }

      // Check if shortcut already exists
      const exists = await Shortcuts.isShortcutExists(chat._id)
      if (exists) {
        // Update existing shortcut
        await Shortcuts.updateShortcut({
          id: chat._id,
          title: chat.name,
          longLabel: chat.lastMessage?.content?.slice(0, 25) || chat.name,
          subTitle: chat.lastMessage?.content?.slice(0, 50) || 'Open chat',
          iconName: 'shortcut_icon',
          symbolName: 'note.text',
        })
      } else {
        // Add new shortcut
        await Shortcuts.addShortcut({
          id: chat._id,
          title: chat.name,
          longLabel: chat.lastMessage?.content?.slice(0, 25) || chat.name,
          subTitle: chat.lastMessage?.content?.slice(0, 50) || 'Open chat',
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

  const removeShortcut = useCallback(async (chatId: string) => {
    try {
      await Shortcuts.removeShortcut(chatId)
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
