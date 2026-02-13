import type { Router, LocalRequest, LocalResponse } from '../router'

let cachedHtml: string | null = null
let cacheTimestamp: number = 0
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

function getProductionBaseUrl(): string {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || ''
  // EXPO_PUBLIC_API_URL is like "https://host/api" → we want "https://host"
  return apiUrl.replace(/\/api$/, '')
}

async function fetchAndRewriteHtml(): Promise<string> {
  const baseUrl = getProductionBaseUrl()
  const indexUrl = `${baseUrl}/web/index.html`

  const response = await fetch(indexUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch index.html: ${response.status}`)
  }

  let html = await response.text()

  // Rewrite asset paths: ="/web/ → absolute HTTPS production URLs
  // HTTP page loading HTTPS assets is allowed (not mixed content)
  html = html.replace(/="\/web\//g, `="${baseUrl}/web/`)

  // Inject production URL so SPA knows where to redirect for QR re-scan
  const script = `<script>window.__LATERBOX_PRODUCTION__ = '${baseUrl}/web/';</script>`
  html = html.replace('</head>', `${script}\n</head>`)

  return html
}

async function getHtml(): Promise<string> {
  const now = Date.now()
  if (cachedHtml && now - cacheTimestamp < CACHE_TTL) {
    return cachedHtml
  }

  cachedHtml = await fetchAndRewriteHtml()
  cacheTimestamp = now
  return cachedHtml
}

export function registerWebRoutes(router: Router): void {
  const handler = async (_req: LocalRequest, _params: Record<string, string>): Promise<LocalResponse> => {
    try {
      const html = await getHtml()
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: html,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: `<!DOCTYPE html>
<html><head><title>LaterBox</title></head>
<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
  <div style="text-align:center">
    <h2>Could not load web client</h2>
    <p>${message}</p>
    <button onclick="location.reload()" style="margin-top:16px;padding:8px 24px;font-size:16px;cursor:pointer">Retry</button>
  </div>
</body></html>`,
      }
    }
  }

  // Serve the SPA HTML for navigation routes only.
  // Requests with file extensions (e.g. .js, .css, .svg) are assets that should
  // load from production via the rewritten paths in the HTML — don't serve HTML for those.
  const spaHandler = async (req: LocalRequest): Promise<LocalResponse> => {
    const wildcard = req.path.replace(/^\/web\/?/, '')
    if (wildcard && wildcard.includes('.')) {
      return { statusCode: 404, headers: {}, body: 'Not found' }
    }
    return handler(req, {})
  }

  router.get('/web', handler)
  router.get('/web/', handler)
  router.get('/web/*', spaHandler)
}
