import { useState, useRef } from 'react'
import { ChevronDown, Pin, Lock, Trash2 } from 'lucide-react'
import type { ThreadWithLastNote } from '../../api/types'
import { useUpdateThread, useDeleteThread } from '../../hooks/useThreads'
import { Avatar } from '../common/Avatar'
import { Dropdown } from '../common/Dropdown'
import { formatRelativeTime } from '../../utils/formatters'

interface ThreadListItemProps {
  thread: ThreadWithLastNote
  isSelected: boolean
  onSelect: () => void
}

const NOTE_TYPE_LABELS: Record<string, string> = {
  image: 'Photo',
  video: 'Video',
  voice: 'Voice message',
  audio: 'Audio',
  file: 'File',
  location: 'Location',
  contact: 'Contact',
}

export function ThreadListItem({ thread, isSelected, onSelect }: ThreadListItemProps) {
  const [showMenu, setShowMenu] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const updateThread = useUpdateThread()
  const deleteThread = useDeleteThread()

  const lastNotePreview = thread.lastNote
    ? thread.lastNote.type !== 'text'
      ? NOTE_TYPE_LABELS[thread.lastNote.type] || thread.lastNote.type
      : thread.lastNote.content || ''
    : ''

  const menuItems = [
    {
      label: thread.isPinned ? 'Unpin' : 'Pin',
      icon: <Pin size={14} />,
      onClick: () => updateThread.mutate({ id: thread.id, isPinned: !thread.isPinned }),
    },
    {
      label: thread.isLocked ? 'Unlock' : 'Lock',
      icon: <Lock size={14} />,
      onClick: () => updateThread.mutate({ id: thread.id, isLocked: !thread.isLocked }),
    },
    ...(!thread.isSystemThread ? [{
      label: 'Delete',
      icon: <Trash2 size={14} />,
      onClick: () => deleteThread.mutate(thread.id),
      danger: true,
    }] : []),
  ]

  return (
    <div
      className={`group relative flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 mb-0.5 transition-colors ${
        isSelected
          ? 'bg-[var(--header-bg)]'
          : 'hover:bg-[var(--sidebar-hover)]'
      }`}
      onClick={onSelect}
    >
      <Avatar name={thread.name} icon={thread.icon} size="md" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className={`truncate text-[15px] font-medium ${isSelected ? 'text-white' : 'text-[var(--text)]'}`}>
              {thread.name}
            </span>
            {thread.isPinned && <Pin size={12} className={`shrink-0 ${isSelected ? 'text-white/60' : 'text-[var(--accent-muted)]'}`} />}
            {thread.isLocked && <Lock size={12} className={`shrink-0 ${isSelected ? 'text-white/60' : 'text-[var(--icon)]'}`} />}
          </div>
          {thread.lastNote && (
            <span className={`ml-2 shrink-0 text-[11px] ${isSelected ? 'text-white/60' : 'text-[var(--text-subtle)]'}`}>
              {formatRelativeTime(thread.lastNote.timestamp)}
            </span>
          )}
        </div>
        {lastNotePreview && (
          <p className={`mt-0.5 truncate text-[13px] ${isSelected ? 'text-white/70' : 'text-[var(--text-subtle)]'}`}>{lastNotePreview}</p>
        )}
      </div>

      <button
        ref={menuButtonRef}
        onClick={(e) => {
          e.stopPropagation()
          setShowMenu(!showMenu)
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[var(--icon)] opacity-0 transition-opacity hover:bg-[var(--bg-tertiary)] group-hover:opacity-100"
      >
        <ChevronDown size={16} />
      </button>

      {showMenu && (
        <Dropdown
          items={menuItems}
          onClose={() => setShowMenu(false)}
          anchorRef={menuButtonRef}
        />
      )}
    </div>
  )
}
