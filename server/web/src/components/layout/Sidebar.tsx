import { useState } from 'react'
import { Search, Plus, X } from 'lucide-react'
import { ThreadList } from '../threads/ThreadList'
import { useCreateThread } from '../../hooks/useThreads'
import { Modal } from '../common/Modal'

interface SidebarProps {
  selectedThreadId: string | null
  onSelectThread: (id: string, name: string) => void
  searchInputRef?: React.RefObject<HTMLInputElement | null>
  className?: string
}

export function Sidebar({ selectedThreadId, onSelectThread, searchInputRef, className }: SidebarProps) {
  const [search, setSearch] = useState('')
  const [showNewThread, setShowNewThread] = useState(false)
  const [newThreadName, setNewThreadName] = useState('')
  const createThread = useCreateThread()

  const handleCreateThread = () => {
    if (!newThreadName.trim()) return
    createThread.mutate(
      { name: newThreadName.trim() },
      {
        onSuccess: (data) => {
          onSelectThread(data.id, data.name)
          setShowNewThread(false)
          setNewThreadName('')
        },
      },
    )
  }

  return (
    <aside className={`flex shrink-0 flex-col border-r border-[#2a3942] bg-[#111b21] ${className ?? 'w-[350px]'}`}>
      <div className="p-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8696a0]" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search threads... (Ctrl+K)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg bg-[#202c33] py-2 pl-10 pr-3 text-sm text-[#e9edef] placeholder-[#8696a0] outline-none focus:ring-1 focus:ring-[#00a884]"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8696a0] hover:text-[#e9edef]"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <ThreadList
          search={search}
          selectedThreadId={selectedThreadId}
          onSelectThread={onSelectThread}
        />
      </div>

      <div className="border-t border-[#2a3942] p-2">
        <button
          onClick={() => setShowNewThread(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#00a884] px-4 py-2 text-sm font-medium text-white hover:bg-[#00997a] transition-colors"
        >
          <Plus size={16} />
          New Thread
        </button>
      </div>

      {showNewThread && (
        <Modal
          title="New Thread"
          onClose={() => {
            setShowNewThread(false)
            setNewThreadName('')
          }}
        >
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Thread name"
              value={newThreadName}
              onChange={(e) => setNewThreadName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateThread()}
              autoFocus
              className="w-full rounded-lg border border-[#2a3942] bg-[#2a3942] px-4 py-2.5 text-sm text-[#e9edef] placeholder-[#8696a0] outline-none focus:border-[#00a884]"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowNewThread(false)
                  setNewThreadName('')
                }}
                className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:bg-[#2a3942]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateThread}
                disabled={!newThreadName.trim() || createThread.isPending}
                className="rounded-lg bg-[#00a884] px-4 py-2 text-sm font-medium text-white hover:bg-[#00997a] disabled:opacity-50 transition-colors"
              >
                {createThread.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </aside>
  )
}
