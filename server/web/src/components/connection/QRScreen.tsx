import { useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Smartphone, RefreshCw } from 'lucide-react'
import { useConnectionStore } from '../../store/connectionStore'
import { Spinner } from '../common/Spinner'
import { assetUrl } from '../../utils/assets'

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
          <div className="mb-2 flex items-center gap-4">
            <img src={assetUrl('icon.png')} alt="LaterBox" className="h-14 w-14 rounded-2xl" />
            <h1 className="text-4xl font-bold tracking-tight">
              <span className="text-[var(--text)]">Later</span>
              <span className="text-[var(--accent)]">Box</span>
              <span className="text-[var(--text-subtle)] font-light"> Web</span>
            </h1>
          </div>
          <p className="mb-8 text-lg text-[var(--text-subtle)]">
            Access your notes from your browser
          </p>

          <ol className="space-y-6">
            <li className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-semibold text-white">
                1
              </span>
              <div>
                <p className="font-medium text-[var(--text)]">Open LaterBox on your phone</p>
                <p className="text-sm text-[var(--text-subtle)]">Make sure your phone is connected to the internet</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-semibold text-white">
                2
              </span>
              <div>
                <p className="font-medium text-[var(--text)]">Tap the QR code icon</p>
                <p className="text-sm text-[var(--text-subtle)]">It's in the top-right corner of the home screen</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-semibold text-white">
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
                  className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
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
