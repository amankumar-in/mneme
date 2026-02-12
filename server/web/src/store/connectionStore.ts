import { create } from 'zustand'
import axios from 'axios'

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
  status: localStorage.getItem('laterbox-session') ? 'restoring' : 'qr-loading',
  sessionId: null,
  token: null,
  phoneUrl: null,
  qrData: null,
  disconnectReason: null,
  reconnectAttempts: 0,
  _signalingWs: null,

  createSession: async () => {
    console.log('[WEB] createSession called')
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
    const stored = localStorage.getItem('laterbox-session')
    if (!stored) {
      get().createSession()
      return
    }
    try {
      const { phoneUrl, token } = JSON.parse(stored)
      if (!phoneUrl || !token) throw new Error('invalid')
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
      localStorage.removeItem('laterbox-session')
      get().createSession()
    }
  },

  handlePhoneReady: (ip: string, port: number) => {
    get().connectToPhone(ip, port)
  },

  connectToPhone: async (ip: string, port: number) => {
    console.log('[WEB] connectToPhone called, ip:', ip, 'port:', port)
    set({ status: 'connecting' })
    const { token } = get()
    const url = `http://${ip}:${port}/api/handshake`
    console.log('[WEB] handshake request:', url)
    try {
      const res = await axios.get(url, {
        params: { token },
        timeout: 10000,
      })
      console.log('[WEB] handshake success:', res.status, res.data)
      const phoneUrl = `http://${ip}:${port}`
      set({ phoneUrl, status: 'connected', reconnectAttempts: 0 })
      localStorage.setItem('laterbox-session', JSON.stringify({ phoneUrl, token: get().token }))
    } catch (err) {
      console.error('[WEB] handshake failed:', err)
      set({ status: 'disconnected', disconnectReason: 'handshake_failed' })
    }
  },

  disconnect: (reason?: string) => {
    const { _signalingWs } = get()
    if (_signalingWs) {
      _signalingWs.close()
    }
    localStorage.removeItem('laterbox-session')
    set({
      status: 'disconnected',
      disconnectReason: reason || 'manual',
      phoneUrl: null,
      _signalingWs: null,
    })
  },

  retry: () => {
    const state = get()
    if (state.phoneUrl && state.disconnectReason !== 'session_expired') {
      const url = new URL(state.phoneUrl)
      set({ reconnectAttempts: state.reconnectAttempts + 1 })
      get().connectToPhone(url.hostname, parseInt(url.port))
    } else {
      get().createSession()
    }
  },
}))
