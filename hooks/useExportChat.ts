import { useCallback, useState } from 'react'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { exportChat } from '../services/api'

interface ExportState {
  isExporting: boolean
  error: string | null
}

export function useExportChat() {
  const [state, setState] = useState<ExportState>({
    isExporting: false,
    error: null,
  })

  const handleExport = useCallback(async (chatId: string, chatName: string) => {
    setState({ isExporting: true, error: null })

    try {
      // Get export data from API as text
      const text = await exportChat(chatId, 'txt')

      // Create filename with sanitized chat name
      const sanitizedName = chatName.replace(/[^a-zA-Z0-9]/g, '_')
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `${sanitizedName}_${timestamp}.txt`

      // Create file in cache directory (no permissions needed)
      const file = new File(Paths.cache, filename)

      // Write text content to file
      await file.write(text)

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync()
      if (!isAvailable) {
        throw new Error('Sharing is not available on this device')
      }

      // Share the file
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/plain',
        dialogTitle: `Export ${chatName}`,
      })

      // Clean up temp file after sharing
      await file.delete()

      setState({ isExporting: false, error: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed'
      setState({ isExporting: false, error: message })
      throw error
    }
  }, [])

  return {
    exportChat: handleExport,
    isExporting: state.isExporting,
    exportError: state.error,
  }
}
