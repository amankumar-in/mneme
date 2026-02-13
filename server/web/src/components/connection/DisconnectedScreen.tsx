import { WifiOff, RefreshCw, QrCode } from 'lucide-react'
import { useConnectionStore } from '../../store/connectionStore'

const REASON_MESSAGES: Record<string, string> = {
  manual: 'You disconnected from your phone.',
  session_expired: 'Your session has expired. Please scan a new QR code.',
  handshake_failed: 'Could not connect to your phone. Make sure both devices are on the same network.',
  signaling_error: 'Connection to the server was lost.',
  signaling_closed: 'Connection to the server was closed unexpectedly.',
  session_creation_failed: 'Could not create a session. Please try again.',
  phone_offline: 'Your phone appears to be offline. Open the LaterBox app to reconnect.',
}

export function DisconnectedScreen() {
  const { disconnectReason, retry, createSession } = useConnectionStore()
  const isSessionExpired = disconnectReason === 'session_expired'
  const isPhoneOffline = disconnectReason === 'phone_offline'
  const message = REASON_MESSAGES[disconnectReason || ''] || 'Connection lost. Please try again.'

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-[var(--bg)]">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--bg-tinted)]">
        <WifiOff size={36} className="text-[var(--icon)]" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-medium text-[var(--text)]">
          {isPhoneOffline ? 'Phone Offline' : 'Connection Lost'}
        </h2>
        <p className="mt-2 max-w-md text-sm text-[var(--text-subtle)]">{message}</p>
      </div>
      <div className="flex gap-3">
        {!isSessionExpired && (
          <button
            onClick={retry}
            className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
          >
            <RefreshCw size={16} />
            Reconnect
          </button>
        )}
        <button
          onClick={isSessionExpired ? retry : () => { localStorage.removeItem('laterbox-session'); createSession() }}
          className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium transition-colors ${
            isSessionExpired
              ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]'
              : 'border border-[var(--border)] text-[var(--text-subtle)] hover:bg-[var(--bg-tertiary)]'
          }`}
        >
          <QrCode size={16} />
          Scan Again
        </button>
      </div>
    </div>
  )
}
