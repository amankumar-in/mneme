import type { SQLiteDatabase } from 'expo-sqlite'
import { getThreadRepository } from '../../repositories/thread.repository'
import type { Router } from '../router'

export function registerThreadRoutes(router: Router, db: SQLiteDatabase): void {
  const threadRepo = getThreadRepository(db)

  // GET /api/threads - List threads
  router.get('/api/threads', async (req) => {
    const search = req.query.search || undefined
    const page = req.query.page ? parseInt(req.query.page, 10) : undefined
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined

    const result = await threadRepo.getAll({ search, page, limit })
    return router.json(200, result)
  })

  // GET /api/threads/:id - Get single thread
  router.get('/api/threads/:id', async (_req, params) => {
    const thread = await threadRepo.getById(params.id)
    if (!thread) {
      return router.json(404, { error: 'Thread not found' })
    }
    return router.json(200, thread)
  })

  // POST /api/threads - Create thread
  router.post('/api/threads', async (req) => {
    const body = JSON.parse(req.body || '{}')
    if (!body.name || typeof body.name !== 'string') {
      return router.json(400, { error: 'name is required' })
    }
    const thread = await threadRepo.create({
      name: body.name.trim(),
      icon: body.icon ?? null,
    })
    return router.json(201, thread)
  })

  // PUT /api/threads/:id - Update thread
  router.put('/api/threads/:id', async (req, params) => {
    const body = JSON.parse(req.body || '{}')
    const thread = await threadRepo.update(params.id, {
      name: body.name,
      icon: body.icon,
      isPinned: body.isPinned,
      isLocked: body.isLocked,
      wallpaper: body.wallpaper,
    })
    if (!thread) {
      return router.json(404, { error: 'Thread not found' })
    }
    return router.json(200, thread)
  })

  // DELETE /api/threads/:id - Delete thread
  router.delete('/api/threads/:id', async (_req, params) => {
    const result = await threadRepo.delete(params.id)
    if (!result.success) {
      return router.json(400, { error: 'Cannot delete system thread' })
    }
    return router.json(200, result)
  })
}
