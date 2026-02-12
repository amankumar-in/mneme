import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useConnectionStore } from '../store/connectionStore'

const MAX_RECONNECT_ATTEMPTS = 10
const BASE_DELAY = 1000

export function useWebSocket() {
  const queryClient = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { status, phoneUrl, token, disconnect } = useConnectionStore()
  const [reconnecting, setReconnecting] = useState(false)

  const connect = useCallback(() => {
    if (!phoneUrl || !token) return

    const url = new URL(phoneUrl)
    const wsPort = parseInt(url.port) + 1
    const wsUrl = `ws://${url.hostname}:${wsPort}/ws?token=${token}`
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0
      setReconnecting(false)
      // Authenticate
      ws.send(JSON.stringify({ type: 'auth', token }))
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        switch (msg.type) {
          case 'note:created':
          case 'note:updated':
          case 'note:deleted':
            queryClient.invalidateQueries({ queryKey: ['notes', msg.threadId] })
            queryClient.invalidateQueries({ queryKey: ['threads'] })
            break
          case 'thread:created':
          case 'thread:updated':
          case 'thread:deleted':
            queryClient.invalidateQueries({ queryKey: ['threads'] })
            break
          case 'session:expired':
            disconnect('session_expired')
            break
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }))
            break
        }
      } catch {
        // ignore parse errors
      }
    }

    ws.onclose = () => {
      wsRef.current = null
      const currentStatus = useConnectionStore.getState().status
      if (currentStatus === 'connected' && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        setReconnecting(true)
        const delay = BASE_DELAY * Math.pow(2, reconnectAttemptsRef.current)
        reconnectAttemptsRef.current++
        reconnectTimerRef.current = setTimeout(connect, delay)
      } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        setReconnecting(false)
        disconnect('connection_lost')
      }
    }

    ws.onerror = () => {
      ws.close()
    }

    wsRef.current = ws
  }, [phoneUrl, token, disconnect, queryClient])

  useEffect(() => {
    if (status === 'connected') {
      connect()
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }
  }, [status, connect])

  return { reconnecting, reconnectAttempt: reconnectAttemptsRef.current }
}
