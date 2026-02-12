import type { SQLiteDatabase } from 'expo-sqlite'
import { getNoteRepository } from '../../repositories/note.repository'
import type { Router } from '../router'
import { rewriteNotesUrls } from '../utils/rewriteUrls'

export function registerSearchRoutes(router: Router, db: SQLiteDatabase): void {
  const noteRepo = getNoteRepository(db)

  // GET /api/search - Global search
  router.get('/api/search', async (req) => {
    const query = req.query.q || req.query.query || ''
    if (!query.trim()) {
      return router.json(400, { error: 'Search query is required' })
    }

    const page = req.query.page ? parseInt(req.query.page, 10) : undefined
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined

    const result = await noteRepo.search({ query, page, limit })
    const baseUrl = router.getBaseUrl()
    return router.json(200, {
      ...result,
      data: rewriteNotesUrls(result.data, baseUrl),
    })
  })

  // GET /api/search/thread/:id - Search within a thread
  router.get('/api/search/thread/:id', async (req, params) => {
    const query = req.query.q || req.query.query || ''
    if (!query.trim()) {
      return router.json(400, { error: 'Search query is required' })
    }

    const page = req.query.page ? parseInt(req.query.page, 10) : undefined
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined

    const result = await noteRepo.searchInThread(params.id, query, { page, limit })
    const baseUrl = router.getBaseUrl()
    return router.json(200, {
      ...result,
      data: rewriteNotesUrls(result.data, baseUrl),
    })
  })
}
