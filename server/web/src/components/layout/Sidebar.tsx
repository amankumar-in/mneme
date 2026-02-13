import { useState } from 'react'
import { Search, Plus, X } from 'lucide-react'
import { ThreadList } from '../threads/ThreadList'
import { useCreateThread } from '../../hooks/useThreads'
import { Modal } from '../common/Modal'
import { assetUrl } from '../../utils/assets'

interface SidebarProps {
  selectedThreadId: string | null
  onSelectThread: (id: string, name: string, isSystemThread: boolean) => void
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
          onSelectThread(data.id, data.name, false)
          setShowNewThread(false)
          setNewThreadName('')
        },
      },
    )
  }

  return (
    <aside className={`flex shrink-0 flex-col bg-[var(--sidebar-bg)] ${className ?? 'w-[380px]'}`}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4">
        <img src={assetUrl('icon.png')} alt="LaterBox" className="h-9 w-9 rounded-xl" />
        <span className="text-lg font-bold tracking-tight">
          <span className="text-[var(--text)]">Later</span>
          <span className="text-[var(--accent)]">Box</span>
        </span>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--icon)]" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search threads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border-none bg-[var(--input-bg)] py-2 pl-9 pr-3 text-sm text-[var(--text)] placeholder-[var(--text-placeholder)] outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-shadow"
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

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto px-2">
        <ThreadList
          search={search}
          selectedThreadId={selectedThreadId}
          onSelectThread={onSelectThread}
        />
      </div>

      {/* New Thread button */}
      <div className="px-3 pt-3 pb-5">
        <button
          onClick={() => setShowNewThread(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--header-bg)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] transition-colors shadow-sm"
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
                className="rounded-xl bg-[var(--header-bg)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
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
