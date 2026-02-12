import { useEffect } from 'react'
import { useConnectionStore } from './store/connectionStore'
import { AppLayout } from './components/layout/AppLayout'
import { QRScreen } from './components/connection/QRScreen'
import { ConnectingScreen } from './components/connection/ConnectingScreen'
import { DisconnectedScreen } from './components/connection/DisconnectedScreen'

function App() {
  const status = useConnectionStore((s) => s.status)

  // Initialize dark mode from system preference or localStorage
  useEffect(() => {
    const stored = localStorage.getItem('laterbox-theme')
    if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  // Try to restore previous session on mount (survives refresh)
  useEffect(() => {
    useConnectionStore.getState().restoreSession()
  }, [])

  // BroadcastChannel: only one tab active at a time
  useEffect(() => {
    const channel = new BroadcastChannel('laterbox-web')
    channel.postMessage({ type: 'tab-active' })

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'tab-active') {
        // Another tab became active — disconnect this one
        useConnectionStore.getState().disconnect('another_tab')
      }
    }

    channel.addEventListener('message', handleMessage)
    return () => {
      channel.removeEventListener('message', handleMessage)
      channel.close()
    }
  }, [])

  if (status === 'connected') return <AppLayout />
  if (status === 'connecting' || status === 'restoring') return <ConnectingScreen />
  if (status === 'disconnected') return <DisconnectedScreen />
  return <QRScreen />
}

export default App
