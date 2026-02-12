import type { SQLiteDatabase } from 'expo-sqlite'
import { getNoteRepository } from '../../repositories/note.repository'
import type { Router } from '../router'
import { rewriteNoteUrls, rewriteNotesUrls } from '../utils/rewriteUrls'
import type { TaskFilter } from '../../database/types'

export function registerTaskRoutes(router: Router, db: SQLiteDatabase): void {
  const noteRepo = getNoteRepository(db)

  // GET /api/tasks - List tasks
  router.get('/api/tasks', async (req) => {
    const filter = (req.query.filter || 'all') as TaskFilter
    const threadId = req.query.threadId || undefined
    const page = req.query.page ? parseInt(req.query.page, 10) : undefined
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined

    const result = await noteRepo.getTasks({ filter, threadId, page, limit })
    const baseUrl = router.getBaseUrl()
    return router.json(200, {
      ...result,
      data: rewriteNotesUrls(result.data, baseUrl),
    })
  })

  // PUT /api/tasks/:id/complete - Complete a task
  router.put('/api/tasks/:id/complete', async (_req, params) => {
    const note = await noteRepo.completeTask(params.id)
    if (!note) {
      return router.json(404, { error: 'Task not found' })
    }
    const baseUrl = router.getBaseUrl()
    return router.json(200, rewriteNoteUrls(note, baseUrl))
  })
}
