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
    <aside className={`flex shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-secondary)] ${className ?? 'w-[350px]'}`}>
      <div className="p-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--icon)]" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search threads... (Ctrl+K)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] py-2 pl-10 pr-3 text-sm text-[var(--text)] placeholder-[var(--text-placeholder)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--icon)] hover:text-[var(--text)]"
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

      <div className="border-t border-[var(--border)] p-2">
        <button
          onClick={() => setShowNewThread(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--bg-brand)] px-4 py-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--bg-brand-hover)] transition-colors"
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
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-placeholder)] outline-none focus:border-[var(--accent)]"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowNewThread(false)
                  setNewThreadName('')
                }}
                className="rounded-xl px-4 py-2 text-sm text-[var(--text-subtle)] hover:bg-[var(--bg-tertiary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateThread}
                disabled={!newThreadName.trim() || createThread.isPending}
                className="rounded-xl bg-[var(--bg-brand)] px-4 py-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--bg-brand-hover)] disabled:opacity-50 transition-colors"
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
