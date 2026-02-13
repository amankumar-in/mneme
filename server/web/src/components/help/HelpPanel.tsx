import { X, Shield, Lock, WifiOff, Eye, EyeOff, Server, Monitor, ArrowLeftRight, FileCheck } from 'lucide-react'
import { assetUrl } from '../../utils/assets'

interface HelpPanelProps {
  onClose: () => void
}

export function HelpPanel({ onClose }: HelpPanelProps) {
  return (
    <div className="flex w-[380px] shrink-0 flex-col border-l border-[var(--border)] bg-[var(--sidebar-bg)]">
      <div className="flex h-16 items-center gap-3 px-5">
        <button
          onClick={onClose}
          className="rounded-xl p-1.5 text-[var(--icon)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text)] transition-colors"
        >
          <X size={18} />
        </button>
        <h3 className="text-base font-semibold text-[var(--text)]">About LaterBox Web</h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Hero */}
        <div className="flex flex-col items-center px-6 pt-6 pb-8">
          <div className="relative flex h-40 w-40 items-center justify-center">
            <Shield size={160} strokeWidth={1.2} className="absolute inset-0 text-[var(--header-bg)]" />
            <img
              src={assetUrl('icon.png')}
              alt="LaterBox"
              className="relative z-10 h-12 w-12 rounded-xl"
            />
          </div>
          <h4 className="mt-5 text-lg font-bold text-[var(--text)]">Your notes, your network.</h4>
          <p className="mt-1.5 text-center text-sm leading-relaxed text-[var(--text-subtle)]">
            LaterBox Web lets you access all your notes from the browser. Everything stays on your local Wi-Fi.
          </p>
        </div>

        {/* Security highlight */}
        <div className="mx-4 rounded-2xl bg-[var(--header-bg)] p-4">
          <div className="flex items-center gap-2.5">
            <Lock size={18} className="shrink-0 text-white" />
            <div>
              <p className="text-sm font-semibold text-white">Completely private</p>
              <p className="mt-0.5 text-xs leading-relaxed text-white/70">
                Your data travels directly between your phone and this browser over your local Wi-Fi. Zero servers involved.
              </p>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="px-4 pt-6 pb-2">
          <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-subtle)]">
            Built for privacy
          </h5>
          <div className="space-y-3">
            <FeatureRow
              icon={<WifiOff size={16} />}
              title="Runs on your Wi-Fi only"
              description="Everything happens over your local network. Your data stays in your home."
            />
            <FeatureRow
              icon={<EyeOff size={16} />}
              title="Truly private"
              description="Your notes only exist on your phone and this browser tab. That's it."
            />
            <FeatureRow
              icon={<Server size={16} />}
              title="Phone is the server"
              description="Your phone hosts everything. Close the app, the web session ends."
            />
            <FeatureRow
              icon={<Eye size={16} />}
              title="You're always in control"
              description="See the active connection, disconnect anytime with one tap from your phone."
            />
          </div>
        </div>

        {/* Features */}
        <div className="px-4 pt-4 pb-2">
          <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-subtle)]">
            Features
          </h5>
          <div className="space-y-3">
            <FeatureRow
              icon={<Monitor size={16} />}
              title="Browse all your threads"
              description="Read, search, and explore every thread on the big screen."
            />
            <FeatureRow
              icon={<ArrowLeftRight size={16} />}
              title="Send files between devices"
              description="Drop a file from your computer and it lands on your phone instantly."
            />
            <FeatureRow
              icon={<FileCheck size={16} />}
              title="Download attachments"
              description="Save photos, files, and media from your notes directly to your computer."
            />
          </div>
        </div>

        {/* How to connect */}
        <div className="px-4 pt-4 pb-6">
          <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-subtle)]">
            Getting started
          </h5>
          <div className="space-y-2.5">
            <Step number={1} text="Connect your phone and computer to the same Wi-Fi network." />
            <Step number={2} text="Open LaterBox on your phone and tap the QR icon in the top-right." />
            <Step number={3} text="Scan the QR code shown on this screen. Done!" />
          </div>
        </div>

        {/* Footer */}
        <div className="mx-4 mb-6 rounded-2xl bg-[var(--input-bg)] p-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <img src={assetUrl('icon.png')} alt="" className="h-5 w-5 rounded-md" />
            <span className="text-sm font-semibold">
              <span className="text-[var(--text)]">Later</span>
              <span className="text-[var(--accent)]">Box</span>
            </span>
          </div>
          <p className="mt-1.5 text-xs text-[var(--text-subtle)]">
            The safest way to access your notes from any device.
          </p>
        </div>
      </div>
    </div>
  )
}

function FeatureRow({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex gap-3 rounded-xl bg-[var(--input-bg)] px-3.5 py-3">
      <div className="mt-0.5 shrink-0 text-[var(--header-bg)]">{icon}</div>
      <div>
        <p className="text-sm font-medium text-[var(--text)]">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-subtle)]">{description}</p>
      </div>
    </div>
  )
}

function Step({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--header-bg)] text-xs font-bold text-white">
        {number}
      </div>
      <p className="text-sm leading-relaxed text-[var(--text-subtle)] pt-0.5">{text}</p>
    </div>
  )
}
