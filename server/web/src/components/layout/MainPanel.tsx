import { MessageSquare } from 'lucide-react'
import { NoteArea } from '../notes/NoteArea'

interface MainPanelProps {
  threadId: string | null
  threadName: string
}

export function MainPanel({ threadId, threadName }: MainPanelProps) {
  if (!threadId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-[var(--bg)]">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--bg-tinted)]">
          <MessageSquare size={40} className="text-[var(--accent)]" />
        </div>
        <h2 className="mt-6 text-2xl font-light text-[var(--text)]">LaterBox Web</h2>
        <p className="mt-2 text-sm text-[var(--text-subtle)]">
          Select a thread to view your notes
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--bg)]">
      <NoteArea threadId={threadId} threadName={threadName} />
    </div>
  )
}
