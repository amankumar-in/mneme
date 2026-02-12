import { MessageSquare } from 'lucide-react'
import { NoteArea } from '../notes/NoteArea'

interface MainPanelProps {
  threadId: string | null
  threadName: string
}

export function MainPanel({ threadId, threadName }: MainPanelProps) {
  if (!threadId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-[#0b141a]">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#1a2a33]">
          <MessageSquare size={40} className="text-[#8696a0]" />
        </div>
        <h2 className="mt-6 text-2xl font-light text-[#e9edef]">LaterBox Web</h2>
        <p className="mt-2 text-sm text-[#8696a0]">
          Select a thread to view your notes
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#0b141a]">
      <NoteArea threadId={threadId} threadName={threadName} />
    </div>
  )
}
