import type { Router } from '../router'
import { getSessionToken } from '../middleware/sessionAuth'

export function registerHandshakeRoutes(router: Router): void {
  router.get('/api/handshake', async (req) => {
    const token = req.query.token
    const sessionToken = getSessionToken()

    if (!sessionToken) {
      return router.json(503, { error: 'No active session' })
    }

    if (!token || token !== sessionToken) {
      return router.json(401, { error: 'Invalid token' })
    }

    return router.json(200, {
      status: 'connected',
      timestamp: new Date().toISOString(),
    })
  })
}
