import { useCallback, useState } from 'react'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { useDb } from '@/contexts/DatabaseContext'
import { getNoteRepository, getThreadRepository } from '@/services/repositories'

interface ExportState {
  isExporting: boolean
  error: string | null
}

export function useExportThread() {
  const db = useDb()
  const [state, setState] = useState<ExportState>({
    isExporting: false,
    error: null,
  })

  const handleExport = useCallback(async (threadId: string, threadName: string) => {
    setState({ isExporting: true, error: null })

    try {
      const threadRepo = getThreadRepository(db)
      const noteRepo = getNoteRepository(db)

      // Get thread info
      const thread = await threadRepo.getById(threadId)
      if (!thread) {
        throw new Error('Thread not found')
      }

      // Get all notes for this thread
      const allNotes: string[] = []
      let hasMore = true
      let cursor: string | undefined

      while (hasMore) {
        const result = await noteRepo.getByThread(threadId, { before: cursor, limit: 100 })
        // Notes come newest first, we want oldest first for export
        const notesFormatted = result.data.reverse().map(note => {
          const date = new Date(note.createdAt).toLocaleString()
          let content = note.content || ''

          if (note.type === 'image') content = '[Image]'
          else if (note.type === 'voice') content = '[Voice Note]'
          else if (note.type === 'file') content = `[File: ${note.attachment?.filename || 'attachment'}]`
          else if (note.type === 'location') content = `[Location: ${note.location?.address || 'shared location'}]`

          if (note.task.isTask) {
            content = `[${note.task.isCompleted ? '✓' : '○'}] ${content}`
          }

          return `[${date}] ${content}`
        })

        allNotes.push(...notesFormatted)
        hasMore = result.hasMore
        if (result.data.length > 0) {
          cursor = result.data[0].createdAt // oldest in this batch (we reversed)
        }
      }

      // Reverse to get chronological order
      allNotes.reverse()

      // Build export text
      const exportText = [
        `# ${thread.name}`,
        `Exported on ${new Date().toLocaleString()}`,
        `Total notes: ${allNotes.length}`,
        '',
        '---',
        '',
        ...allNotes,
      ].join('\n')

      // Create filename with sanitized thread name
      const sanitizedName = threadName.replace(/[^a-zA-Z0-9]/g, '_')
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `${sanitizedName}_${timestamp}.txt`

      // Create file in cache directory (no permissions needed)
      const file = new File(Paths.cache, filename)

      // Write text content to file
      await file.write(exportText)

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync()
      if (!isAvailable) {
        throw new Error('Sharing is not available on this device')
      }

      // Share the file
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/plain',
        dialogTitle: `Export ${threadName}`,
      })

      // Clean up temp file after sharing
      await file.delete()

      setState({ isExporting: false, error: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed'
      setState({ isExporting: false, error: message })
      throw error
    }
  }, [db])

  return {
    exportThread: handleExport,
    isExporting: state.isExporting,
    exportError: state.error,
  }
}
