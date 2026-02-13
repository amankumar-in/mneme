import { useRef, useEffect, useCallback, useMemo, useState } from 'react'
import { Info, Search, X } from 'lucide-react'
import { useNotes } from '../../hooks/useNotes'
import { NoteBubble } from './NoteBubble'
import { NoteInput } from './NoteInput'
import { DateSeparator } from './DateSeparator'
import { ThreadInfoPanel } from '../thread-info/ThreadInfoPanel'
import { Spinner } from '../common/Spinner'
import type { NoteWithDetails } from '../../api/types'
import { isSameDay } from 'date-fns'

interface NoteAreaProps {
  threadId: string
  threadName: string
}

export function NoteArea({ threadId, threadName }: NoteAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showInfo, setShowInfo] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [noteSearch, setNoteSearch] = useState('')
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useNotes(threadId)

  const allNotes = useMemo(() => {
    if (!data?.pages) return []
    return data.pages.flatMap((p) => p.data).reverse()
  }, [data])

  const filteredNotes = useMemo(() => {
    if (!noteSearch) return allNotes
    const q = noteSearch.toLowerCase()
    return allNotes.filter((n) => n.content?.toLowerCase().includes(q))
  }, [allNotes, noteSearch])

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 150
  }, [])

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    })
  }, [])

  // Scroll to bottom on initial load and when new notes arrive (if near bottom)
  const prevNoteCountRef = useRef(0)
  useEffect(() => {
    if (allNotes.length === 0) return
    const isInitialLoad = prevNoteCountRef.current === 0
    const hasNewNotes = allNotes.length > prevNoteCountRef.current
    if (isInitialLoad || (hasNewNotes && isNearBottom())) {
      scrollToBottom()
    }
    prevNoteCountRef.current = allNotes.length
  }, [allNotes.length, scrollToBottom, isNearBottom])

  // Reset when thread changes
  useEffect(() => {
    prevNoteCountRef.current = 0
  }, [threadId])

  const handleScroll = () => {
    if (!scrollRef.current || !hasNextPage || isFetchingNextPage) return
    if (scrollRef.current.scrollTop < 100) {
      fetchNextPage()
    }
  }

  const groupedNotes = useMemo(() => {
    const groups: { date: Date; notes: NoteWithDetails[] }[] = []
    for (const note of filteredNotes) {
      const noteDate = new Date(note.createdAt)
      const lastGroup = groups[groups.length - 1]
      if (lastGroup && isSameDay(lastGroup.date, noteDate)) {
        lastGroup.notes.push(note)
      } else {
        groups.push({ date: noteDate, notes: [note] })
      }
    }
    return groups
  }, [filteredNotes])

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg)] px-4">
          <h2 className="text-base font-medium text-[var(--text)]">{threadName}</h2>
          <div className="flex items-center gap-1">
            {searchOpen ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search in thread..."
                  value={noteSearch}
                  onChange={(e) => setNoteSearch(e.target.value)}
                  autoFocus
                  className="w-48 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1.5 text-sm text-[var(--text)] placeholder-[var(--text-placeholder)] outline-none"
                />
                <button
                  onClick={() => {
                    setSearchOpen(false)
                    setNoteSearch('')
                  }}
                  className="rounded-lg p-1.5 text-[var(--icon)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text)]"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="rounded-lg p-1.5 text-[var(--icon)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text)]"
              >
                <Search size={18} />
              </button>
            )}
            <button
              onClick={() => setShowInfo(!showInfo)}
              className={`rounded-lg p-1.5 transition-colors ${
                showInfo
                  ? 'bg-[var(--bg-brand)] text-[var(--accent)]'
                  : 'text-[var(--icon)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text)]'
              }`}
            >
              <Info size={18} />
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto bg-[var(--bg)] px-16 py-4"
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="md" />
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--text-subtle)]">
              <p className="text-sm">
                {noteSearch ? 'No matching notes' : 'No notes yet. Start by sending one below.'}
              </p>
            </div>
          ) : (
            <div className="flex min-h-full flex-col justify-end">
              {isFetchingNextPage && (
                <div className="flex justify-center py-4">
                  <Spinner size="sm" />
                </div>
              )}
              {groupedNotes.map((group) => (
                <div key={group.date.toISOString()}>
                  <DateSeparator date={group.date} />
                  {group.notes.map((note) => (
                    <NoteBubble key={note.id} note={note} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <NoteInput threadId={threadId} onSent={scrollToBottom} />
      </div>

      {showInfo && (
        <ThreadInfoPanel
          threadId={threadId}
          threadName={threadName}
          onClose={() => setShowInfo(false)}
        />
      )}
    </div>
  )
}
