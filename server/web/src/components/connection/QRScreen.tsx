import { useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Smartphone, RefreshCw } from 'lucide-react'
import { useConnectionStore } from '../../store/connectionStore'
import { Spinner } from '../common/Spinner'

export function QRScreen() {
  const { status, qrData, createSession } = useConnectionStore()

  useEffect(() => {
    // Only create a new session if we don't already have QR data
    // (restoreSession already calls createSession on failure)
    if (!qrData && status === 'qr-loading') {
      createSession()
    }
  }, [createSession, qrData, status])

  return (
    <div className="flex h-full items-center justify-center bg-[var(--bg)]">
      <div className="flex max-w-[900px] items-center gap-16 px-8">
        <div className="flex-1">
          <h1 className="mb-2 text-4xl font-light tracking-tight text-[var(--text)]">LaterBox Web</h1>
          <p className="mb-8 text-lg text-[var(--text-subtle)]">
            Access your notes from your browser
          </p>

          <ol className="space-y-6">
            <li className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-brand)] text-sm font-semibold text-[var(--accent)]">
                1
              </span>
              <div>
                <p className="font-medium text-[var(--text)]">Open LaterBox on your phone</p>
                <p className="text-sm text-[var(--text-subtle)]">Make sure your phone is connected to the internet</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-brand)] text-sm font-semibold text-[var(--accent)]">
                2
              </span>
              <div>
                <p className="font-medium text-[var(--text)]">Go to Settings &gt; Web Client</p>
                <p className="text-sm text-[var(--text-subtle)]">Tap the menu icon and select Web Client</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-brand)] text-sm font-semibold text-[var(--accent)]">
                3
              </span>
              <div>
                <p className="font-medium text-[var(--text)]">Scan this QR code</p>
                <p className="text-sm text-[var(--text-subtle)]">Point your phone camera at the screen</p>
              </div>
            </li>
          </ol>

          <div className="mt-8 flex items-center gap-2 text-sm text-[var(--text-subtle)]">
            <Smartphone size={16} />
            <span>Both devices must be on the same network</span>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div className="rounded-2xl bg-white p-6 shadow-lg">
            {status === 'qr-loading' ? (
              <div className="flex h-[264px] w-[264px] items-center justify-center">
                <Spinner size="lg" />
              </div>
            ) : qrData ? (
              <QRCodeSVG
                value={qrData}
                size={264}
                level="M"
                bgColor="#ffffff"
                fgColor="#0f172a"
              />
            ) : (
              <div className="flex h-[264px] w-[264px] flex-col items-center justify-center gap-4">
                <p className="text-sm text-[var(--text-subtle)]">Failed to generate QR code</p>
                <button
                  onClick={() => createSession()}
                  className="flex items-center gap-2 rounded-xl bg-[var(--bg-brand)] px-4 py-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--bg-brand-hover)] transition-colors"
                >
                  <RefreshCw size={16} />
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
