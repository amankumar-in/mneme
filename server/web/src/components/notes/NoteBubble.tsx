import { useState, useRef } from 'react'
import {
  ChevronDown,
  Download,
  Star,
  Pin,
  Lock,
  Copy,
  Pencil,
  Trash2,
  CheckSquare,
  MapPin,
  User,
  FileIcon,
} from 'lucide-react'
import type { NoteWithDetails } from '../../api/types'
import { useUpdateNote, useDeleteNote } from '../../hooks/useNotes'
import { Dropdown } from '../common/Dropdown'
import { LinkPreviewCard } from './LinkPreviewCard'
import { VoiceWaveform } from './VoiceWaveform'
import { ImageViewer } from './ImageViewer'
import { VideoPlayer } from './VideoPlayer'
import { formatTime, formatFileSize, linkify } from '../../utils/formatters'

interface NoteBubbleProps {
  note: NoteWithDetails
}

export function NoteBubble({ note }: NoteBubbleProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [showImage, setShowImage] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(note.content || '')
  const menuRef = useRef<HTMLButtonElement>(null)
  const updateNote = useUpdateNote()
  const deleteNote = useDeleteNote()

  const handleCopy = () => {
    if (note.content) navigator.clipboard.writeText(note.content)
  }

  const handleSaveEdit = () => {
    if (editContent.trim() !== note.content) {
      updateNote.mutate({
        id: note.id,
        threadId: note.threadId,
        content: editContent.trim(),
      })
    }
    setIsEditing(false)
  }

  const handleDownload = async () => {
    if (!note.attachment?.url) return
    try {
      const res = await fetch(note.attachment.url)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = note.attachment.filename || 'download'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // Fallback: open in new tab
      window.open(note.attachment.url, '_blank')
    }
  }

  const menuItems = [
    { label: 'Copy', icon: <Copy size={14} />, onClick: handleCopy },
    ...(note.attachment?.url
      ? [{ label: 'Download', icon: <Download size={14} />, onClick: handleDownload }]
      : []),
    ...(note.type === 'text'
      ? [
          {
            label: 'Edit',
            icon: <Pencil size={14} />,
            onClick: () => {
              setEditContent(note.content || '')
              setIsEditing(true)
            },
          },
        ]
      : []),
    {
      label: note.isPinned ? 'Unpin' : 'Pin',
      icon: <Pin size={14} />,
      onClick: () =>
        updateNote.mutate({ id: note.id, threadId: note.threadId, isPinned: !note.isPinned }),
    },
    {
      label: note.isStarred ? 'Unstar' : 'Star',
      icon: <Star size={14} />,
      onClick: () =>
        updateNote.mutate({ id: note.id, threadId: note.threadId, isStarred: !note.isStarred }),
    },
    {
      label: note.isLocked ? 'Unlock' : 'Lock',
      icon: <Lock size={14} />,
      onClick: () =>
        updateNote.mutate({ id: note.id, threadId: note.threadId, isLocked: !note.isLocked }),
    },
    {
      label: note.task.isTask ? 'Remove task' : 'Mark as task',
      icon: <CheckSquare size={14} />,
      onClick: () => {
        // Toggle task status via API
      },
    },
    {
      label: 'Delete',
      icon: <Trash2 size={14} />,
      onClick: () => deleteNote.mutate({ id: note.id, threadId: note.threadId }),
      danger: true,
    },
  ]

  if (note.isLocked) {
    return (
      <div className="my-1 flex justify-end">
        <div className="flex max-w-[65%] items-center gap-2 rounded-xl bg-[var(--bg-secondary)] px-3 py-2">
          <Lock size={14} className="text-[var(--icon)]" />
          <span className="text-sm italic text-[var(--text-subtle)]">Locked note</span>
          <span className="ml-2 text-[11px] text-[var(--text-subtle)]">{formatTime(note.createdAt)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="group my-1 flex justify-end">
      <div className="relative max-w-[65%] rounded-xl bg-[var(--bg-tinted)] shadow-sm">
        <div className="pb-1 pl-2 pr-4.5 pt-1.5">
          {renderNoteContent(note, isEditing, editContent, setEditContent, handleSaveEdit, setShowImage)}
        </div>

        <div className="flex items-center justify-end gap-1 px-2 pb-1.5">
          {note.isEdited && (
            <span className="text-[11px] text-[var(--text-subtle)]">edited</span>
          )}
          {note.isStarred && <Star size={11} className="fill-[var(--warning)] text-[var(--warning)]" />}
          {note.isPinned && <Pin size={11} className="text-[var(--icon)]" />}
          {note.task.isTask && (
            <CheckSquare
              size={11}
              className={note.task.isCompleted ? 'text-[var(--success)]' : 'text-[var(--icon)]'}
            />
          )}
          <span className="text-[11px] text-[var(--text-subtle)]">{formatTime(note.createdAt)}</span>
        </div>

        <button
          ref={menuRef}
          onClick={() => setShowMenu(!showMenu)}
          className="absolute right-1 top-1 rounded-lg bg-[var(--bg-tinted)] p-0.5 text-[var(--icon)] opacity-0 shadow transition-opacity hover:bg-[var(--bg-secondary)] group-hover:opacity-100"
        >
          <ChevronDown size={16} />
        </button>

        {showMenu && (
          <Dropdown items={menuItems} onClose={() => setShowMenu(false)} anchorRef={menuRef} />
        )}
      </div>

      {showImage && note.attachment?.url && (
        <ImageViewer
          src={note.attachment.url}
          onClose={() => setShowImage(false)}
        />
      )}
    </div>
  )
}

function renderNoteContent(
  note: NoteWithDetails,
  isEditing: boolean,
  editContent: string,
  setEditContent: (v: string) => void,
  handleSaveEdit: () => void,
  setShowImage: (v: boolean) => void,
) {
  switch (note.type) {
    case 'text': {
      if (isEditing) {
        return (
          <div className="min-w-[200px]">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSaveEdit()
                }
                if (e.key === 'Escape') handleSaveEdit()
              }}
              autoFocus
              className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2 text-sm text-[var(--text)] outline-none"
              rows={3}
            />
            <div className="flex justify-end gap-1 pt-1">
              <button
                onClick={handleSaveEdit}
                className="rounded-lg px-2 py-0.5 text-xs text-[var(--accent)] hover:bg-[var(--bg-secondary)]"
              >
                Save
              </button>
            </div>
          </div>
        )
      }

      const segments = linkify(note.content || '')
      return (
        <div>
          <p className="whitespace-pre-wrap break-words text-sm text-[var(--text)]">
            {segments.map((seg, i) =>
              seg.type === 'url' ? (
                <a
                  key={i}
                  href={seg.text}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--link)] underline"
                >
                  {seg.text}
                </a>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </p>
          {note.linkPreview && <LinkPreviewCard preview={note.linkPreview} />}
        </div>
      )
    }

    case 'image':
      return (
        <div
          className="cursor-pointer overflow-hidden rounded-xl"
          onClick={() => setShowImage(true)}
        >
          <img
            src={note.attachment?.url}
            alt=""
            className="max-h-[300px] max-w-full rounded-xl object-cover"
            loading="lazy"
          />
        </div>
      )

    case 'video':
      return <VideoPlayer src={note.attachment?.url || ''} poster={note.attachment?.thumbnail || undefined} />

    case 'voice':
      return (
        <VoiceWaveform
          src={note.attachment?.url || ''}
          duration={note.attachment?.duration || 0}
          waveform={note.attachment?.waveform || undefined}
        />
      )

    case 'audio':
      return (
        <div className="flex items-center gap-2">
          <audio controls src={note.attachment?.url} className="max-w-[300px]" />
          {note.attachment?.filename && (
            <span className="text-xs text-[var(--text-subtle)]">{note.attachment.filename}</span>
          )}
        </div>
      )

    case 'file':
      return (
        <a
          href={note.attachment?.url}
          download={note.attachment?.filename || 'file'}
          className="flex items-center gap-3 rounded-xl bg-[var(--bg-secondary)] p-3"
        >
          <FileIcon size={32} className="shrink-0 text-[var(--icon)]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-[var(--text)]">
              {note.attachment?.filename || 'Unnamed file'}
            </p>
            {note.attachment?.size && (
              <p className="text-xs text-[var(--text-subtle)]">{formatFileSize(note.attachment.size)}</p>
            )}
          </div>
        </a>
      )

    case 'location':
      return (
        <a
          href={`https://www.google.com/maps?q=${note.location?.latitude},${note.location?.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-[var(--link)]"
        >
          <MapPin size={16} />
          <span>{note.location?.address || 'View on Map'}</span>
        </a>
      )

    case 'contact':
      return (
        <div className="flex items-center gap-2">
          <User size={16} className="text-[var(--icon)]" />
          <span className="text-sm text-[var(--text)]">{note.content || 'Contact'}</span>
        </div>
      )

    default:
      return <p className="text-sm text-[var(--text)]">{note.content}</p>
  }
}
