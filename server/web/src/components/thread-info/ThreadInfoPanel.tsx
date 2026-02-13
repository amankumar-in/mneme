import { useMemo, useState } from 'react'
import { X, Calendar, ChevronRight, FileIcon, Image, Paperclip } from 'lucide-react'
import { useNotes } from '../../hooks/useNotes'
import { Avatar } from '../common/Avatar'
import { MediaGallery } from './MediaGallery'
import { formatDate } from '../../utils/formatters'

interface ThreadInfoPanelProps {
  threadId: string
  threadName: string
  onClose: () => void
}

const MEDIA_PREVIEW_COUNT = 6
const FILE_PREVIEW_COUNT = 4

export function ThreadInfoPanel({ threadId, threadName, onClose }: ThreadInfoPanelProps) {
  const { data } = useNotes(threadId)
  const [showAllMedia, setShowAllMedia] = useState(false)
  const [showAllFiles, setShowAllFiles] = useState(false)

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
  const visibleMedia = showAllMedia ? mediaNotes : mediaNotes.slice(0, MEDIA_PREVIEW_COUNT)
  const visibleFiles = showAllFiles ? fileNotes : fileNotes.slice(0, FILE_PREVIEW_COUNT)

  return (
    <div className="flex w-[380px] shrink-0 flex-col border-l border-[var(--border)] bg-[var(--sidebar-bg)]">
      <div className="flex h-16 items-center gap-3 px-5">
        <button
          onClick={onClose}
          className="rounded-xl p-1.5 text-[var(--icon)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text)] transition-colors"
        >
          <X size={18} />
        </button>
        <h3 className="text-base font-semibold text-[var(--text)]">Thread Info</h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Thread avatar and name */}
        <div className="flex flex-col items-center px-4 py-8">
          <Avatar name={threadName} size="lg" />
          <h4 className="mt-4 text-xl font-semibold text-[var(--text)]">{threadName}</h4>
          {firstNote && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-subtle)]">
              <Calendar size={12} />
              <span>Created {formatDate(new Date(firstNote.createdAt))}</span>
            </div>
          )}
          <div className="mt-3 flex items-center gap-4 text-xs text-[var(--text-subtle)]">
            <span className="flex items-center gap-1">
              <Paperclip size={12} /> {allNotes.length} notes
            </span>
            {mediaNotes.length > 0 && (
              <span className="flex items-center gap-1">
                <Image size={12} /> {mediaNotes.length} media
              </span>
            )}
            {fileNotes.length > 0 && (
              <span className="flex items-center gap-1">
                <FileIcon size={12} /> {fileNotes.length} files
              </span>
            )}
          </div>
        </div>

        {/* Media section */}
        {mediaNotes.length > 0 && (
          <div className="px-4 py-4">
            <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-subtle)]">
              Media
            </h5>
            <MediaGallery notes={visibleMedia} />
            {mediaNotes.length > MEDIA_PREVIEW_COUNT && !showAllMedia && (
              <button
                onClick={() => setShowAllMedia(true)}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--input-bg)] py-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                View all {mediaNotes.length} media
                <ChevronRight size={14} />
              </button>
            )}
            {showAllMedia && mediaNotes.length > MEDIA_PREVIEW_COUNT && (
              <button
                onClick={() => setShowAllMedia(false)}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--input-bg)] py-2 text-sm font-medium text-[var(--text-subtle)] hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                Show less
              </button>
            )}
          </div>
        )}

        {/* Files section */}
        {fileNotes.length > 0 && (
          <div className="px-4 py-4">
            <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-subtle)]">
              Files
            </h5>
            <div className="space-y-1.5">
              {visibleFiles.map((note) => (
                <a
                  key={note.id}
                  href={note.attachment?.url}
                  download
                  className="flex items-center gap-3 rounded-xl bg-[var(--input-bg)] px-3 py-2.5 text-sm text-[var(--text)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/10">
                    <FileIcon size={16} className="text-[var(--accent)]" />
                  </div>
                  <span className="truncate flex-1">
                    {note.attachment?.filename || 'File'}
                  </span>
                </a>
              ))}
            </div>
            {fileNotes.length > FILE_PREVIEW_COUNT && !showAllFiles && (
              <button
                onClick={() => setShowAllFiles(true)}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--input-bg)] py-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                View all {fileNotes.length} files
                <ChevronRight size={14} />
              </button>
            )}
            {showAllFiles && fileNotes.length > FILE_PREVIEW_COUNT && (
              <button
                onClick={() => setShowAllFiles(false)}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--input-bg)] py-2 text-sm font-medium text-[var(--text-subtle)] hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                Show less
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
