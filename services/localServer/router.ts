/**
 * Path-based request dispatcher for the local HTTP server.
 * Routes incoming requests to the appropriate handler.
 */
import type { SQLiteDatabase } from 'expo-sqlite'
import { validateAuth, getSessionToken } from './middleware/sessionAuth'

export interface LocalRequest {
  id: string
  method: string
  path: string
  headers: Record<string, string>
  query: Record<string, string>
  body: string
}

export interface LocalResponse {
  statusCode: number
  headers: Record<string, string>
  body: string
}

export type RouteHandler = (
  req: LocalRequest,
  params: Record<string, string>
) => Promise<LocalResponse>

interface Route {
  method: string
  pattern: RegExp
  paramNames: string[]
  handler: RouteHandler
}

export class Router {
  private routes: Route[] = []
  private serverBaseUrl: string = ''

  setBaseUrl(url: string): void {
    this.serverBaseUrl = url
  }

  getBaseUrl(): string {
    return this.serverBaseUrl
  }

  add(method: string, path: string, handler: RouteHandler): void {
    const paramNames: string[] = []
    const patternStr = path.replace(/:([a-zA-Z]+)/g, (_match, paramName) => {
      paramNames.push(paramName)
      return '([^/]+)'
    })
    // Support wildcard paths like /api/files/*
    const finalPattern = patternStr.replace(/\*/g, '(.*)')
    this.routes.push({
      method: method.toUpperCase(),
      pattern: new RegExp(`^${finalPattern}$`),
      paramNames,
      handler,
    })
  }

  get(path: string, handler: RouteHandler): void {
    this.add('GET', path, handler)
  }

  post(path: string, handler: RouteHandler): void {
    this.add('POST', path, handler)
  }

  put(path: string, handler: RouteHandler): void {
    this.add('PUT', path, handler)
  }

  delete(path: string, handler: RouteHandler): void {
    this.add('DELETE', path, handler)
  }

  async handle(req: LocalRequest): Promise<LocalResponse> {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: this.corsHeaders(),
        body: '',
      }
    }

    // Auth check — handshake uses query param token; files allow token in query
    const isAuthExempt = req.path === '/api/handshake' || req.path.startsWith('/api/files/') || req.path.startsWith('/web')
    if (!isAuthExempt) {
      const authResult = validateAuth(req.headers['authorization'])
      if (!authResult.authorized) {
        return this.json(authResult.statusCode ?? 401, {
          error: authResult.error,
        })
      }
    }

    // Find matching route
    for (const route of this.routes) {
      if (route.method !== req.method.toUpperCase()) continue
      const match = route.pattern.exec(req.path)
      if (!match) continue

      const params: Record<string, string> = {}
      route.paramNames.forEach((name, i) => {
        params[name] = match[i + 1]
      })

      try {
        const response = await route.handler(req, params)
        return {
          ...response,
          headers: { ...this.corsHeaders(), ...response.headers },
        }
      } catch (error) {
        console.error(`[LocalServer] Route error ${req.method} ${req.path}:`, error)
        return this.json(500, {
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return this.json(404, { error: 'Not found' })
  }

  json(statusCode: number, data: unknown): LocalResponse {
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        ...this.corsHeaders(),
      },
      body: JSON.stringify(data),
    }
  }

  private corsHeaders(): Record<string, string> {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Private-Network': 'true',
      'Access-Control-Max-Age': '86400',
    }
  }
}
