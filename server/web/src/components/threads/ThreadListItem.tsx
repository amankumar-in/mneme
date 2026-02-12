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
    {
      label: 'Delete',
      icon: <Trash2 size={14} />,
      onClick: () => deleteThread.mutate(thread.id),
      danger: true,
    },
  ]

  return (
    <div
      className={`group relative flex cursor-pointer items-center gap-3 px-3 py-3 transition-colors ${
        isSelected
          ? 'bg-[#2a3942]'
          : 'hover:bg-[#202c33]'
      }`}
      onClick={onSelect}
    >
      <Avatar name={thread.name} icon={thread.icon} size="md" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-medium text-[#e9edef]">
              {thread.name}
            </span>
            {thread.isPinned && <Pin size={12} className="shrink-0 text-[#8696a0]" />}
            {thread.isLocked && <Lock size={12} className="shrink-0 text-[#8696a0]" />}
          </div>
          {thread.lastNote && (
            <span className="ml-2 shrink-0 text-xs text-[#8696a0]">
              {formatRelativeTime(thread.lastNote.timestamp)}
            </span>
          )}
        </div>
        {lastNotePreview && (
          <p className="mt-0.5 truncate text-sm text-[#8696a0]">{lastNotePreview}</p>
        )}
      </div>

      <button
        ref={menuButtonRef}
        onClick={(e) => {
          e.stopPropagation()
          setShowMenu(!showMenu)
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#8696a0] opacity-0 transition-opacity hover:bg-[#374045] group-hover:opacity-100"
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
