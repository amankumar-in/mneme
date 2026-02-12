import type { NoteWithDetails, ThreadWithLastNote } from '../../database/types'

/**
 * Rewrite relative attachment paths in notes to full HTTP URLs
 * served by the local server.
 *
 * e.g. "laterbox/attachments/images/x.jpg"
 *   → "http://192.168.1.5:8765/api/files/laterbox/attachments/images/x.jpg"
 */
export function rewriteNoteUrls(
  note: NoteWithDetails,
  baseUrl: string
): NoteWithDetails {
  const rewritten = { ...note }

  if (rewritten.attachment) {
    rewritten.attachment = { ...rewritten.attachment }
    if (rewritten.attachment.url && isRelativePath(rewritten.attachment.url)) {
      rewritten.attachment.url = `${baseUrl}/api/files/${rewritten.attachment.url}`
    }
    if (
      rewritten.attachment.thumbnail &&
      isRelativePath(rewritten.attachment.thumbnail)
    ) {
      rewritten.attachment.thumbnail = `${baseUrl}/api/files/${rewritten.attachment.thumbnail}`
    }
  }

  if (rewritten.linkPreview) {
    rewritten.linkPreview = { ...rewritten.linkPreview }
    if (
      rewritten.linkPreview.image &&
      isRelativePath(rewritten.linkPreview.image)
    ) {
      rewritten.linkPreview.image = `${baseUrl}/api/files/${rewritten.linkPreview.image}`
    }
  }

  return rewritten
}

export function rewriteNotesUrls(
  notes: NoteWithDetails[],
  baseUrl: string
): NoteWithDetails[] {
  return notes.map((note) => rewriteNoteUrls(note, baseUrl))
}

function isRelativePath(path: string): boolean {
  return !path.startsWith('http://') && !path.startsWith('https://') && !path.startsWith('file://')
}
