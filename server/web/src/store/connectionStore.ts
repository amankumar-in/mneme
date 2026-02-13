import { create } from 'zustand'
import axios from 'axios'

declare global {
  interface Window {
    __LATERBOX_PRODUCTION__?: string
  }
}

export type ConnectionStatus = 'restoring' | 'qr-loading' | 'qr-displayed' | 'connecting' | 'connected' | 'disconnected'

interface ConnectionState {
  status: ConnectionStatus
  sessionId: string | null
  token: string | null
  phoneUrl: string | null
  qrData: string | null
  disconnectReason: string | null
  reconnectAttempts: number
  _signalingWs: WebSocket | null

  createSession: () => Promise<void>
  restoreSession: () => Promise<void>
  handlePhoneReady: (ip: string, port: number) => void
  connectToPhone: (ip: string, port: number) => Promise<void>
  disconnect: (reason?: string) => void
  retry: () => void
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  status: (localStorage.getItem('laterbox-session') || new URLSearchParams(window.location.search).has('token')) ? 'restoring' : 'qr-loading',
  sessionId: null,
  token: null,
  phoneUrl: null,
  qrData: null,
  disconnectReason: null,
  reconnectAttempts: 0,
  _signalingWs: null,

  createSession: async () => {
    console.log('[WEB] createSession called')

    // If on the phone's HTTP origin, redirect back to the origin user came from
    if (window.location.protocol === 'http:') {
      const productionUrl = localStorage.getItem('laterbox-production-url')
        || window.__LATERBOX_PRODUCTION__
      if (productionUrl) {
        window.location.href = productionUrl
        return
      }
    }

    set({ status: 'qr-loading', disconnectReason: null })
    try {
      const res = await axios.post('/api/web-session/create')
      const { sessionId, token, relay } = res.data
      console.log('[WEB] session created:', sessionId, 'relay:', relay)

      const qrData = JSON.stringify({
        type: 'laterbox-web',
        v: 1,
        sessionId,
        token,
        relay,
      })

      set({ sessionId, token, qrData, status: 'qr-displayed' })

      // Browser connects to signaling via its own host (localhost works browser-to-server)
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const signalingUrl = `${wsProtocol}//${window.location.host}/ws/signaling?sessionId=${sessionId}&role=browser`
      console.log('[WEB] connecting signaling WS:', signalingUrl)
      const ws = new WebSocket(signalingUrl)
      let phoneReadyReceived = false

      ws.onopen = () => {
        console.log('[WEB] signaling WS opened')
      }

      ws.onmessage = (event) => {
        console.log('[WEB] signaling WS message:', event.data)
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'phone-ready') {
            phoneReadyReceived = true
            console.log('[WEB] phone-ready received, ip:', msg.ip, 'port:', msg.port)
            get().handlePhoneReady(msg.ip, msg.port)
          }
        } catch (e) {
          console.error('[WEB] signaling message parse error:', e)
        }
      }

      ws.onerror = (e) => {
        console.error('[WEB] signaling WS error:', e)
        if (!phoneReadyReceived) {
          set({ status: 'disconnected', disconnectReason: 'signaling_error' })
        }
      }

      ws.onclose = (e) => {
        console.log('[WEB] signaling WS closed, code:', e.code, 'reason:', e.reason, 'phoneReadyReceived:', phoneReadyReceived)
        // Relay closes after forwarding phone-ready — that's expected, not an error
        if (!phoneReadyReceived) {
          const state = get()
          console.log('[WEB] current status on close:', state.status)
          if (state.status !== 'connected' && state.status !== 'disconnected') {
            set({ status: 'disconnected', disconnectReason: 'signaling_closed' })
          }
        }
      }

      set({ _signalingWs: ws })
    } catch {
      set({ status: 'disconnected', disconnectReason: 'session_creation_failed' })
    }
  },

  restoreSession: async () => {
    // Check if we arrived from redirect with token in URL (phone's HTTP origin)
    const urlParams = new URLSearchParams(window.location.search)
    const urlToken = urlParams.get('token')
    if (urlToken && window.location.protocol === 'http:') {
      console.log('[WEB] restoring from URL token on phone origin')
      set({ status: 'connecting', token: urlToken })
      try {
        const phoneUrl = window.location.origin
        const res = await axios.get(`${phoneUrl}/api/handshake`, {
          params: { token: urlToken },
          timeout: 5000,
        })
        if (res.status === 200) {
          localStorage.setItem('laterbox-session', JSON.stringify({ phoneUrl, token: urlToken }))
          // Save origin for redirect-back: prefer `from` param (actual origin user came from),
          // fall back to phone-injected value (hardcoded production URL)
          const from = urlParams.get('from')
          localStorage.setItem('laterbox-production-url', from || window.__LATERBOX_PRODUCTION__ || '')
          // Clean params from URL
          window.history.replaceState({}, '', window.location.pathname)
          set({ phoneUrl, token: urlToken, status: 'connected', reconnectAttempts: 0 })
          return
        }
      } catch (e) {
        console.error('[WEB] URL token handshake failed:', e)
      }
      // Fall through to existing restore logic
    }

    // Existing localStorage restore flow (handles page refresh)
    const stored = localStorage.getItem('laterbox-session')
    if (!stored) {
      get().createSession()
      return
    }
    try {
      const { phoneUrl, token } = JSON.parse(stored)
      if (!phoneUrl || !token) throw new Error('invalid')

      // HTTPS can't probe HTTP (mixed content), so we can't verify the phone is up.
      // Show the "phone offline" screen and let the user choose to reconnect or scan again.
      // Retry will call connectToPhone which does the redirect when the user is ready.
      if (window.location.protocol === 'https:' && phoneUrl.startsWith('http:')) {
        set({ phoneUrl, token, status: 'disconnected', disconnectReason: 'phone_offline' })
        return
      }

      set({ status: 'connecting', token })
      const res = await axios.get(`${phoneUrl}/api/handshake`, {
        params: { token },
        timeout: 5000,
      })
      if (res.status === 200) {
        set({ phoneUrl, status: 'connected', reconnectAttempts: 0 })
      } else {
        throw new Error('handshake failed')
      }
    } catch {
      // Phone is probably offline — keep the session and show a retry state
      // instead of wiping credentials and forcing a new QR scan
      set({ status: 'disconnected', disconnectReason: 'phone_offline' })
    }
  },

  handlePhoneReady: (ip: string, port: number) => {
    get().connectToPhone(ip, port)
  },

  connectToPhone: async (ip: string, port: number) => {
    console.log('[WEB] connectToPhone called, ip:', ip, 'port:', port)
    set({ status: 'connecting' })
    const { token } = get()
    const phoneUrl = `http://${ip}:${port}`
    // Persist session on the current origin so returning to this URL auto-reconnects
    localStorage.setItem('laterbox-session', JSON.stringify({ phoneUrl, token }))
    // Redirect to phone's local server — SPA will boot on HTTP origin, no mixed content
    // Pass current origin so disconnect redirects back here, not a hardcoded URL
    const from = encodeURIComponent(window.location.origin + '/web/')
    window.location.href = `${phoneUrl}/web/?token=${token}&from=${from}`
  },

  disconnect: (reason?: string) => {
    const { _signalingWs } = get()
    if (_signalingWs) {
      _signalingWs.close()
    }
    // Only wipe session for intentional disconnects
    const clearSession = !reason || reason === 'manual' || reason === 'session_expired'
    if (clearSession) {
      localStorage.removeItem('laterbox-session')
    }
    set({
      status: 'disconnected',
      disconnectReason: reason || 'manual',
      phoneUrl: clearSession ? null : get().phoneUrl,
      _signalingWs: null,
    })
  },

  retry: () => {
    const state = get()
    if (state.disconnectReason === 'phone_offline' && state.phoneUrl) {
      // User chose to reconnect — redirect to phone directly
      const url = new URL(state.phoneUrl)
      set({ reconnectAttempts: state.reconnectAttempts + 1 })
      get().connectToPhone(url.hostname, parseInt(url.port))
    } else if (state.phoneUrl && state.disconnectReason !== 'session_expired') {
      const url = new URL(state.phoneUrl)
      set({ reconnectAttempts: state.reconnectAttempts + 1 })
      get().connectToPhone(url.hostname, parseInt(url.port))
    } else {
      get().createSession()
    }
  },
}))
