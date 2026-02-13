import { NoteArea } from '../notes/NoteArea'
import { assetUrl } from '../../utils/assets'

interface MainPanelProps {
  threadId: string | null
  threadName: string
  isSystemThread: boolean
  isDark: boolean
  onToggleDark: () => void
  onDisconnect: () => void
  onBack?: () => void
}

export function MainPanel({ threadId, threadName, isSystemThread, isDark, onToggleDark, onDisconnect, onBack }: MainPanelProps) {
  if (!threadId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-[var(--bg)]">
        <img src={assetUrl('icon.png')} alt="LaterBox" className="h-24 w-24 rounded-3xl shadow-lg" />
        <h2 className="mt-6 text-2xl font-bold tracking-tight">
          <span className="text-[var(--text)]">Later</span>
          <span className="text-[var(--accent)]">Box</span>
          <span className="text-[var(--text-subtle)] font-light"> Web</span>
        </h2>
        <p className="mt-2 text-sm text-[var(--text-subtle)]">
          Select a thread to view your notes
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--bg)]">
      <NoteArea
        threadId={threadId}
        threadName={threadName}
        isSystemThread={isSystemThread}
        isDark={isDark}
        onToggleDark={onToggleDark}
        onDisconnect={onDisconnect}
        onBack={onBack}
      />
    </div>
  )
}
