import { useMemo } from 'react'
import { X, Calendar } from 'lucide-react'
import { useNotes } from '../../hooks/useNotes'
import { Avatar } from '../common/Avatar'
import { MediaGallery } from './MediaGallery'
import { formatDate } from '../../utils/formatters'

interface ThreadInfoPanelProps {
  threadId: string
  threadName: string
  onClose: () => void
}

export function ThreadInfoPanel({ threadId, threadName, onClose }: ThreadInfoPanelProps) {
  const { data } = useNotes(threadId)

  const allNotes = useMemo(() => {
    if (!data?.pages) return []
    return data.pages.flatMap((p) => p.data)
  }, [data])

  const mediaNotes = useMemo(
    () => allNotes.filter((n) => n.type === 'image' || n.type === 'video'),
    [allNotes],
  )

  const fileNotes = useMemo(
    () => allNotes.filter((n) => n.type === 'file'),
    [allNotes],
  )

  const firstNote = allNotes[allNotes.length - 1]

  return (
    <div className="flex w-[400px] shrink-0 flex-col border-l border-[var(--border)] bg-[var(--bg-secondary)]">
      <div className="flex h-14 items-center gap-3 border-b border-[var(--border)] px-4">
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-[var(--icon)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text)]"
        >
          <X size={20} />
        </button>
        <h3 className="text-base font-medium text-[var(--text)]">Thread Info</h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center px-4 py-8">
          <Avatar name={threadName} size="lg" />
          <h4 className="mt-4 text-xl font-medium text-[var(--text)]">{threadName}</h4>
          {firstNote && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-subtle)]">
              <Calendar size={12} />
              <span>Created {formatDate(new Date(firstNote.createdAt))}</span>
            </div>
          )}
        </div>

        {mediaNotes.length > 0 && (
          <div className="border-t border-[var(--border)] px-4 py-4">
            <h5 className="mb-3 text-sm font-medium text-[var(--text-subtle)]">
              Media ({mediaNotes.length})
            </h5>
            <MediaGallery notes={mediaNotes} />
          </div>
        )}

        {fileNotes.length > 0 && (
          <div className="border-t border-[var(--border)] px-4 py-4">
            <h5 className="mb-3 text-sm font-medium text-[var(--text-subtle)]">
              Files ({fileNotes.length})
            </h5>
            <div className="space-y-2">
              {fileNotes.map((note) => (
                <a
                  key={note.id}
                  href={note.attachment?.url}
                  download
                  className="flex items-center gap-3 rounded-xl bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  <span className="truncate flex-1">
                    {note.attachment?.filename || 'File'}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-[var(--border)] px-4 py-4">
          <p className="text-sm text-[var(--text-subtle)]">
            {allNotes.length} note{allNotes.length !== 1 ? 's' : ''} in this thread
          </p>
        </div>
      </div>
    </div>
  )
}
