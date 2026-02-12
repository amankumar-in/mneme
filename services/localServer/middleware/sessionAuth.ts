/**
 * Session authentication for the local server.
 * Validates Bearer token on every request.
 */

interface AuthState {
  token: string | null
  failedAttempts: Map<string, { count: number; blockedUntil: number }>
}

const state: AuthState = {
  token: null,
  failedAttempts: new Map(),
}

const MAX_FAILURES = 5
const BLOCK_DURATION_MS = 5 * 60 * 1000 // 5 minutes

export function setSessionToken(token: string): void {
  state.token = token
  state.failedAttempts.clear()
}

export function clearSessionToken(): void {
  state.token = null
  state.failedAttempts.clear()
}

export function getSessionToken(): string | null {
  return state.token
}

export interface AuthResult {
  authorized: boolean
  error?: string
  statusCode?: number
}

export function validateAuth(
  authHeader: string | undefined,
  clientIp?: string
): AuthResult {
  if (!state.token) {
    return { authorized: false, error: 'No active session', statusCode: 503 }
  }

  // Check if IP is blocked
  if (clientIp) {
    const record = state.failedAttempts.get(clientIp)
    if (record && record.blockedUntil > Date.now()) {
      return {
        authorized: false,
        error: 'Too many failed attempts. Try again later.',
        statusCode: 429,
      }
    }
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    recordFailure(clientIp)
    return { authorized: false, error: 'Missing or invalid authorization header', statusCode: 401 }
  }

  const token = authHeader.slice(7)
  if (token !== state.token) {
    recordFailure(clientIp)
    return { authorized: false, error: 'Invalid token', statusCode: 401 }
  }

  // Success — clear failures for this IP
  if (clientIp) {
    state.failedAttempts.delete(clientIp)
  }

  return { authorized: true }
}

function recordFailure(clientIp?: string): void {
  if (!clientIp) return
  const record = state.failedAttempts.get(clientIp) ?? { count: 0, blockedUntil: 0 }
  record.count++
  if (record.count >= MAX_FAILURES) {
    record.blockedUntil = Date.now() + BLOCK_DURATION_MS
    record.count = 0
  }
  state.failedAttempts.set(clientIp, record)
}
