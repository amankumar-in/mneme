import { useState, useRef } from 'react'
import {
  ChevronDown,
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

  const menuItems = [
    { label: 'Copy', icon: <Copy size={14} />, onClick: handleCopy },
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
        <div className="flex max-w-[65%] items-center gap-2 rounded-lg bg-[#005c4b] px-3 py-2">
          <Lock size={14} className="text-[#8696a0]" />
          <span className="text-sm italic text-[#8696a0]">Locked note</span>
          <span className="ml-2 text-[11px] text-[#ffffff99]">{formatTime(note.createdAt)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="group my-1 flex justify-end">
      <div className="relative max-w-[65%] rounded-lg bg-[#005c4b] shadow-sm">
        <div className="px-2 pb-1 pt-1.5">
          {renderNoteContent(note, isEditing, editContent, setEditContent, handleSaveEdit, setShowImage)}
        </div>

        <div className="flex items-center justify-end gap-1 px-2 pb-1.5">
          {note.isEdited && (
            <span className="text-[11px] text-[#ffffff80]">edited</span>
          )}
          {note.isStarred && <Star size={11} className="fill-[#ffd700] text-[#ffd700]" />}
          {note.isPinned && <Pin size={11} className="text-[#ffffff99]" />}
          {note.task.isTask && (
            <CheckSquare
              size={11}
              className={note.task.isCompleted ? 'text-[#00a884]' : 'text-[#ffffff99]'}
            />
          )}
          <span className="text-[11px] text-[#ffffff99]">{formatTime(note.createdAt)}</span>
        </div>

        <button
          ref={menuRef}
          onClick={() => setShowMenu(!showMenu)}
          className="absolute right-1 top-1 rounded p-0.5 text-[#ffffff80] opacity-0 transition-opacity hover:bg-[#ffffff15] group-hover:opacity-100"
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
              className="w-full resize-none rounded bg-[#00493e] p-1 text-sm text-[#e9edef] outline-none"
              rows={3}
            />
            <div className="flex justify-end gap-1 pt-1">
              <button
                onClick={handleSaveEdit}
                className="rounded px-2 py-0.5 text-xs text-[#00a884] hover:bg-[#00493e]"
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
          <p className="whitespace-pre-wrap break-words text-sm text-[#e9edef]">
            {segments.map((seg, i) =>
              seg.type === 'url' ? (
                <a
                  key={i}
                  href={seg.text}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#53bdeb] underline"
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
          className="cursor-pointer overflow-hidden rounded"
          onClick={() => setShowImage(true)}
        >
          <img
            src={note.attachment?.url}
            alt=""
            className="max-h-[300px] max-w-full rounded object-cover"
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
            <span className="text-xs text-[#8696a0]">{note.attachment.filename}</span>
          )}
        </div>
      )

    case 'file':
      return (
        <a
          href={note.attachment?.url}
          download={note.attachment?.filename || 'file'}
          className="flex items-center gap-3 rounded bg-[#00493e] p-3"
        >
          <FileIcon size={32} className="shrink-0 text-[#8696a0]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-[#e9edef]">
              {note.attachment?.filename || 'Unnamed file'}
            </p>
            {note.attachment?.size && (
              <p className="text-xs text-[#8696a0]">{formatFileSize(note.attachment.size)}</p>
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
          className="flex items-center gap-2 text-sm text-[#53bdeb]"
        >
          <MapPin size={16} />
          <span>{note.location?.address || 'View on Map'}</span>
        </a>
      )

    case 'contact':
      return (
        <div className="flex items-center gap-2">
          <User size={16} className="text-[#8696a0]" />
          <span className="text-sm text-[#e9edef]">{note.content || 'Contact'}</span>
        </div>
      )

    default:
      return <p className="text-sm text-[#e9edef]">{note.content}</p>
  }
}
