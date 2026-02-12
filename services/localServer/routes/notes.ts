import type { SQLiteDatabase } from 'expo-sqlite'
import { getNoteRepository } from '../../repositories/note.repository'
import { getThreadRepository } from '../../repositories/thread.repository'
import type { Router } from '../router'
import { rewriteNoteUrls, rewriteNotesUrls } from '../utils/rewriteUrls'

/**
 * Strip local server URL prefix from attachment fields so we store relative paths in the DB.
 * e.g. "http://192.168.1.5:8765/api/files/laterbox/attachments/images/x.jpg"
 *   → "laterbox/attachments/images/x.jpg"
 */
function stripLocalUrls(
  attachment: { url?: string; thumbnail?: string; [key: string]: any },
  baseUrl: string
): typeof attachment {
  const prefix = `${baseUrl}/api/files/`
  const result = { ...attachment }
  if (result.url?.startsWith(prefix)) {
    result.url = result.url.slice(prefix.length)
  }
  if (result.thumbnail?.startsWith(prefix)) {
    result.thumbnail = result.thumbnail.slice(prefix.length)
  }
  return result
}

export function registerNoteRoutes(router: Router, db: SQLiteDatabase): void {
  const noteRepo = getNoteRepository(db)
  const threadRepo = getThreadRepository(db)

  // GET /api/threads/:id/notes - List notes for a thread (cursor-based)
  router.get('/api/threads/:id/notes', async (req, params) => {
    const cursor = {
      before: req.query.before || undefined,
      after: req.query.after || undefined,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
    }

    const result = await noteRepo.getByThread(params.id, cursor)
    const baseUrl = router.getBaseUrl()
    return router.json(200, {
      ...result,
      data: rewriteNotesUrls(result.data, baseUrl),
    })
  })

  // POST /api/threads/:id/notes - Create note
  router.post('/api/threads/:id/notes', async (req, params) => {
    const body = JSON.parse(req.body || '{}')
    const type = body.type || 'text'

    // Strip local server URL prefix from attachment URLs so we store relative paths
    const attachment = body.attachment ? stripLocalUrls(body.attachment, router.getBaseUrl()) : null

    const note = await noteRepo.create({
      threadId: params.id,
      content: body.content ?? null,
      type,
      attachment,
      location: body.location ?? null,
      linkPreview: body.linkPreview ?? null,
    })

    // Update thread's last note preview
    await threadRepo.updateLastNote(
      params.id,
      note.content,
      note.type,
      note.createdAt
    )

    const baseUrl = router.getBaseUrl()
    return router.json(201, rewriteNoteUrls(note, baseUrl))
  })

  // PUT /api/threads/:id/notes/:nid - Update note
  router.put('/api/threads/:id/notes/:nid', async (req, params) => {
    const body = JSON.parse(req.body || '{}')
    const note = await noteRepo.update(params.nid, {
      content: body.content,
    })
    if (!note) {
      return router.json(404, { error: 'Note not found' })
    }
    const baseUrl = router.getBaseUrl()
    return router.json(200, rewriteNoteUrls(note, baseUrl))
  })

  // DELETE /api/threads/:id/notes/:nid - Delete note
  router.delete('/api/threads/:id/notes/:nid', async (_req, params) => {
    await noteRepo.delete(params.nid)
    return router.json(200, { success: true })
  })

  // PUT /api/threads/:id/notes/:nid/lock - Toggle lock
  router.put('/api/threads/:id/notes/:nid/lock', async (req, params) => {
    const body = JSON.parse(req.body || '{}')
    const note = await noteRepo.setLocked(params.nid, !!body.isLocked)
    if (!note) {
      return router.json(404, { error: 'Note not found' })
    }
    const baseUrl = router.getBaseUrl()
    return router.json(200, rewriteNoteUrls(note, baseUrl))
  })

  // PUT /api/threads/:id/notes/:nid/star - Toggle star
  router.put('/api/threads/:id/notes/:nid/star', async (req, params) => {
    const body = JSON.parse(req.body || '{}')
    const note = await noteRepo.setStarred(params.nid, !!body.isStarred)
    if (!note) {
      return router.json(404, { error: 'Note not found' })
    }
    const baseUrl = router.getBaseUrl()
    return router.json(200, rewriteNoteUrls(note, baseUrl))
  })

  // PUT /api/threads/:id/notes/:nid/pin - Toggle pin
  router.put('/api/threads/:id/notes/:nid/pin', async (req, params) => {
    const body = JSON.parse(req.body || '{}')
    const note = await noteRepo.setPinned(params.nid, !!body.isPinned)
    if (!note) {
      return router.json(404, { error: 'Note not found' })
    }
    const baseUrl = router.getBaseUrl()
    return router.json(200, rewriteNoteUrls(note, baseUrl))
  })

  // PUT /api/threads/:id/notes/:nid/task - Set task
  router.put('/api/threads/:id/notes/:nid/task', async (req, params) => {
    const body = JSON.parse(req.body || '{}')
    const note = await noteRepo.setTask(params.nid, {
      isTask: body.isTask ?? true,
      reminderAt: body.reminderAt ?? null,
      isCompleted: body.isCompleted ?? false,
    })
    if (!note) {
      return router.json(404, { error: 'Note not found' })
    }
    const baseUrl = router.getBaseUrl()
    return router.json(200, rewriteNoteUrls(note, baseUrl))
  })

  // GET /api/threads/:id/media - Get media for a thread
  router.get('/api/threads/:id/media', async (req, params) => {
    const typesParam = req.query.types || 'image,video'
    const types = typesParam.split(',') as any[]
    const page = req.query.page ? parseInt(req.query.page, 10) : 1
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50

    const result = await noteRepo.getMediaByThread(params.id, types, page, limit)
    const baseUrl = router.getBaseUrl()
    return router.json(200, {
      ...result,
      data: rewriteNotesUrls(result.data, baseUrl),
    })
  })
}
