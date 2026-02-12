import { Paths } from 'expo-file-system'
import { resolveAttachmentUri, saveAttachment, categorizeByMimeType, ensureDirectories } from '../../fileStorage'
import type { Router, LocalRequest } from '../router'

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.json': 'application/json',
  '.zip': 'application/zip',
}

function getMimeType(filePath: string): string {
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase()
  return MIME_TYPES[ext] || 'application/octet-stream'
}

/**
 * File route registration.
 *
 * GET /api/files/* serves files from disk.
 * sendFileResponse is used for streaming files (handled at the native layer).
 *
 * POST /api/files/upload handles multipart uploads — the body from the
 * native HTTP server is base64-encoded file data.
 */
export function registerFileRoutes(
  router: Router,
  sendFileResponse: (requestId: string, statusCode: number, headers: Record<string, string>, filePath: string) => void
): void {
  // GET /api/files/* - Serve attachment files
  // This route returns a special response that tells the server to stream the file
  router.get('/api/files/*', async (req) => {
    const relativePath = req.path.replace('/api/files/', '')
    if (!relativePath) {
      return router.json(400, { error: 'File path is required' })
    }

    // Security: prevent path traversal
    if (relativePath.includes('..')) {
      return router.json(403, { error: 'Invalid path' })
    }

    try {
      const fullUri = resolveAttachmentUri(relativePath)
      const mimeType = getMimeType(relativePath)
      // Native sendFileResponse expects a plain filesystem path, not a file:// URI
      const filePath = fullUri.startsWith('file://') ? fullUri.slice(7) : fullUri

      // Use native file response for efficient streaming
      sendFileResponse(req.id, 200, {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      }, filePath)

      // Return a sentinel that tells the router not to send a regular response
      return { statusCode: -1, headers: {}, body: '' }
    } catch (error) {
      return router.json(404, { error: 'File not found' })
    }
  })

  // POST /api/files/upload - Upload file
  // Expects JSON body with: { data: base64, filename: string, mimeType: string }
  router.post('/api/files/upload', async (req) => {
    try {
      const body = JSON.parse(req.body || '{}')
      const { data, filename, mimeType } = body

      if (!data || !filename || !mimeType) {
        return router.json(400, { error: 'data, filename, and mimeType are required' })
      }

      await ensureDirectories()

      // Decode base64 data and write to temp file
      const category = categorizeByMimeType(mimeType)
      // Write the base64 data to a temp file, then use saveAttachment
      const tempPath = `${Paths.cache.uri}/upload_${Date.now()}_${filename}`

      // For now, we create a File from the base64 data
      const { File: ExpoFile } = require('expo-file-system')
      const tempFile = new ExpoFile(tempPath)
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
      tempFile.write(bytes)

      const result = await saveAttachment(tempPath, category, filename)

      // Clean up temp file
      try { tempFile.delete() } catch {}

      const baseUrl = router.getBaseUrl()
      return router.json(200, {
        attachment: {
          url: `${baseUrl}/api/files/${result.localUri}`,
          filename: result.filename,
          mimeType,
          size: bytes.length,
        },
      })
    } catch (error) {
      console.error('[LocalServer] Upload error:', error)
      return router.json(500, {
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })
}
