import { WifiOff, RefreshCw, QrCode } from 'lucide-react'
import { useConnectionStore } from '../../store/connectionStore'

const REASON_MESSAGES: Record<string, string> = {
  manual: 'You disconnected from your phone.',
  session_expired: 'Your session has expired. Please scan a new QR code.',
  handshake_failed: 'Could not connect to your phone. Make sure both devices are on the same network.',
  signaling_error: 'Connection to the server was lost.',
  signaling_closed: 'Connection to the server was closed unexpectedly.',
  session_creation_failed: 'Could not create a session. Please try again.',
}

export function DisconnectedScreen() {
  const { disconnectReason, retry } = useConnectionStore()
  const isSessionExpired = disconnectReason === 'session_expired'
  const message = REASON_MESSAGES[disconnectReason || ''] || 'Connection lost. Please try again.'

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-[#0b141a]">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#1a2a33]">
        <WifiOff size={36} className="text-gray-400" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-medium text-white">Connection Lost</h2>
        <p className="mt-2 max-w-md text-sm text-gray-400">{message}</p>
      </div>
      <div className="flex gap-3">
        {!isSessionExpired && (
          <button
            onClick={retry}
            className="flex items-center gap-2 rounded-lg bg-[#00a884] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#00997a] transition-colors"
          >
            <RefreshCw size={16} />
            Reconnect
          </button>
        )}
        <button
          onClick={retry}
          className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-colors ${
            isSessionExpired
              ? 'bg-[#00a884] text-white hover:bg-[#00997a]'
              : 'border border-gray-600 text-gray-300 hover:bg-[#1a2a33]'
          }`}
        >
          <QrCode size={16} />
          Scan Again
        </button>
      </div>
    </div>
  )
}
