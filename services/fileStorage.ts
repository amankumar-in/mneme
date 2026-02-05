import { Directory, File, Paths } from 'expo-file-system'
import * as VideoThumbnails from 'expo-video-thumbnails'
import { generateUUID } from './database'

const ATTACHMENTS_DIR = 'laterbox/attachments'

type AttachmentCategory = 'images' | 'videos' | 'documents' | 'audio'

function getDir(category: AttachmentCategory): Directory {
  return new Directory(Paths.document, `${ATTACHMENTS_DIR}/${category}`)
}

function getExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? `.${parts[parts.length - 1]}` : ''
}

let directoriesReady: Promise<void> | null = null

function createDirIfNeeded(dir: Directory): void {
  try {
    if (!dir.exists) {
      dir.create()
    }
  } catch {
    // Already exists (race condition) — safe to ignore
    if (!dir.exists) throw new Error(`Failed to create directory: ${dir.uri}`)
  }
}

export function ensureDirectories(): Promise<void> {
  if (directoriesReady) return directoriesReady

  directoriesReady = Promise.resolve().then(() => {
    // Create parent dirs first, then leaf dirs
    const base = new Directory(Paths.document, 'laterbox')
    createDirIfNeeded(base)
    const attachments = new Directory(base, 'attachments')
    createDirIfNeeded(attachments)

    const categories: AttachmentCategory[] = ['images', 'videos', 'documents', 'audio']
    for (const cat of categories) {
      const dir = new Directory(attachments, cat)
      createDirIfNeeded(dir)
    }
  })

  return directoriesReady
}

export async function saveAttachment(
  sourceUri: string,
  category: AttachmentCategory,
  originalFilename: string
): Promise<{ localUri: string; filename: string }> {
  await ensureDirectories()

  const id = generateUUID()
  const ext = getExtension(originalFilename)
  const newFilename = category === 'documents'
    ? `${id}_${originalFilename}`
    : `${id}${ext}`

  const dir = getDir(category)
  const sourceFile = new File(sourceUri)
  const destFile = new File(dir, newFilename)

  sourceFile.copy(destFile)

  // Store relative path so it survives iOS container path changes between launches
  const relativePath = `${ATTACHMENTS_DIR}/${category}/${newFilename}`

  return {
    localUri: relativePath,
    filename: originalFilename,
  }
}

/**
 * Resolve a stored attachment path to a full file:// URI.
 * Handles both relative paths (new) and legacy absolute URIs.
 */
export function resolveAttachmentUri(storedPath: string): string {
  // Already a full URI (legacy or non-local) — return as-is
  if (storedPath.startsWith('file://') || storedPath.startsWith('http')) {
    return storedPath
  }
  // Relative path — resolve against current document directory
  const file = new File(Paths.document, storedPath)
  return file.uri
}

/**
 * Check if an attachment file exists on disk.
 * Returns false for HTTP URLs (remote-only) or missing local files.
 */
export function attachmentExists(storedPath: string): boolean {
  if (!storedPath) return false
  // Remote URLs — can't verify, assume available
  if (storedPath.startsWith('http')) return true
  try {
    if (storedPath.startsWith('file://')) {
      return new File(storedPath).exists
    }
    return new File(Paths.document, storedPath).exists
  } catch {
    return false
  }
}

export async function deleteAttachment(storedPath: string): Promise<void> {
  try {
    const uri = resolveAttachmentUri(storedPath)
    const file = new File(uri)
    if (file.exists) {
      file.delete()
    }
  } catch (error) {
    console.warn('[FileStorage] Failed to delete attachment:', error)
  }
}

export async function generateThumbnail(videoStoredPath: string): Promise<string | null> {
  try {
    await ensureDirectories()
    // Resolve to full URI for the video thumbnails API
    const fullUri = resolveAttachmentUri(videoStoredPath)
    const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(fullUri, {
      time: 0,
    })

    // Save thumbnail — returns a relative path
    const result = await saveAttachment(thumbUri, 'images', 'thumb.jpg')
    return result.localUri
  } catch (error) {
    console.warn('[FileStorage] Failed to generate thumbnail:', error)
    return null
  }
}
