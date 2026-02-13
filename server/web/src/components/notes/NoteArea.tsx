import { useRef, useEffect, useCallback, useMemo, useState } from 'react'
import { Info, Search, X, Moon, Sun, LogOut, ArrowLeft, Wifi, Monitor, Smartphone, HelpCircle } from 'lucide-react'
import { useNotes } from '../../hooks/useNotes'
import { useConnectionStore } from '../../store/connectionStore'
import { NoteBubble } from './NoteBubble'
import { NoteInput } from './NoteInput'
import { DateSeparator } from './DateSeparator'
import { ThreadInfoPanel } from '../thread-info/ThreadInfoPanel'
import { HelpPanel } from '../help/HelpPanel'
import { Spinner } from '../common/Spinner'
import { Avatar } from '../common/Avatar'
import type { NoteWithDetails } from '../../api/types'
import { isSameDay } from 'date-fns'

interface NoteAreaProps {
  threadId: string
  threadName: string
  isSystemThread: boolean
  isDark: boolean
  onToggleDark: () => void
  onDisconnect: () => void
  onBack?: () => void
}

export function NoteArea({ threadId, threadName, isSystemThread, isDark, onToggleDark, onDisconnect, onBack }: NoteAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showInfo, setShowInfo] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [noteSearch, setNoteSearch] = useState('')
  const [showConnectionInfo, setShowConnectionInfo] = useState(false)
  const [wifiFlash, setWifiFlash] = useState(false)
  const connectionRef = useRef<HTMLDivElement>(null)
  const phoneUrl = useConnectionStore((s) => s.phoneUrl)

  useEffect(() => {
    const interval = setInterval(() => setWifiFlash((v) => !v), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!showConnectionInfo) return
    const handleClick = (e: MouseEvent) => {
      if (connectionRef.current && !connectionRef.current.contains(e.target as Node)) {
        setShowConnectionInfo(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showConnectionInfo])
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
        {/* Thread header with controls */}
        <div className="flex h-14 shrink-0 items-center justify-between bg-[var(--header-bg)] px-5">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="rounded-xl p-1.5 text-white/70 hover:text-white hover:bg-white/10"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="flex items-center gap-3 rounded-xl px-1 py-1 -ml-1 hover:bg-white/10 transition-colors"
            >
              <Avatar name={threadName} size="sm" />
              <h2 className="text-base font-semibold text-white">{threadName}</h2>
            </button>
          </div>
          <div className="flex items-center gap-1">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
              <input
                type="text"
                placeholder={`Search notes in ${threadName}`}
                value={noteSearch}
                onChange={(e) => setNoteSearch(e.target.value)}
                className="w-64 rounded-xl bg-white/15 py-1.5 pl-9 pr-8 text-sm text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-white/30 transition-shadow"
              />
              {noteSearch && (
                <button
                  onClick={() => setNoteSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowInfo(!showInfo)}
              className={`rounded-xl p-2 transition-colors ${
                showInfo
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
              title="Thread info"
            >
              <Info size={17} />
            </button>
            <div className="mx-1 h-5 w-px bg-white/20" />
            <div className="relative" ref={connectionRef}>
              <button
                onClick={() => setShowConnectionInfo(!showConnectionInfo)}
                className="flex items-center gap-0.5 rounded-xl p-2 hover:bg-white/10 transition-colors"
              >
                <Wifi size={14} className={`transition-colors duration-300 ${wifiFlash ? 'text-white' : 'text-white/30'}`} />
              </button>
              {showConnectionInfo && (
                <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl bg-[var(--bg)] p-4 shadow-xl shadow-black/15">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--header-bg)]">
                      <Wifi size={14} className="text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">Connected</p>
                      <p className="text-[11px] text-[var(--text-subtle)]">Via local network</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs">
                    {phoneUrl && (() => {
                      try {
                        const url = new URL(phoneUrl)
                        return (
                          <>
                            <div className="flex items-center gap-2 rounded-lg bg-[var(--input-bg)] px-3 py-2">
                              <Smartphone size={13} className="shrink-0 text-[var(--icon)]" />
                              <div>
                                <p className="text-[var(--text-subtle)]">Phone IP</p>
                                <p className="font-medium text-[var(--text)]">{url.hostname}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 rounded-lg bg-[var(--input-bg)] px-3 py-2">
                              <Monitor size={13} className="shrink-0 text-[var(--icon)]" />
                              <div>
                                <p className="text-[var(--text-subtle)]">Port</p>
                                <p className="font-medium text-[var(--text)]">{url.port}</p>
                              </div>
                            </div>
                          </>
                        )
                      } catch { return null }
                    })()}
                    <div className="flex items-center gap-2 rounded-lg bg-[var(--input-bg)] px-3 py-2">
                      <Monitor size={13} className="shrink-0 text-[var(--icon)]" />
                      <div>
                        <p className="text-[var(--text-subtle)]">Browser</p>
                        <p className="font-medium text-[var(--text)]">{window.location.host}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={onToggleDark}
              className="rounded-xl p-2 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title={isDark ? 'Light mode' : 'Dark mode'}
            >
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              onClick={onDisconnect}
              className="rounded-xl p-2 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Disconnect"
            >
              <LogOut size={17} />
            </button>
            <div className="mx-1 h-5 w-px bg-white/20" />
            <button
              onClick={() => setShowHelp(!showHelp)}
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-medium transition-colors ${
                showHelp
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
              title="Help"
            >
              <HelpCircle size={15} />
              <span>Help</span>
            </button>
          </div>
        </div>

        {/* Note list */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-16 py-4"
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="md" />
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--text-subtle)]">
              <p className="text-sm">
                {noteSearch ? 'No matching notes' : isSystemThread ? 'No locked notes yet.' : 'No notes yet. Start by sending one below.'}
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

        {isSystemThread ? (
          <div className="bg-[var(--bg)] px-4 py-3">
            <div className="rounded-2xl bg-[var(--input-bg)] px-4 py-3 text-center text-sm text-[var(--text-subtle)]">
              Locked notes from all your threads appear here.
            </div>
          </div>
        ) : (
          <NoteInput threadId={threadId} onSent={scrollToBottom} />
        )}
      </div>

      {showInfo && (
        <ThreadInfoPanel
          threadId={threadId}
          threadName={threadName}
          onClose={() => setShowInfo(false)}
        />
      )}
      {showHelp && (
        <HelpPanel onClose={() => setShowHelp(false)} />
      )}
    </div>
  )
}
