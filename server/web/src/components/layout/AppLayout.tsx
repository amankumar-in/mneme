import { useCallback, useEffect, useRef, useState } from 'react'
import { Wifi, LogOut, Moon, Sun, ArrowLeft } from 'lucide-react'
import { useConnectionStore } from '../../store/connectionStore'
import { useWebSocket } from '../../hooks/useWebSocket'
import { Sidebar } from './Sidebar'
import { MainPanel } from './MainPanel'

export function AppLayout() {
  const disconnect = useConnectionStore((s) => s.disconnect)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [selectedThreadName, setSelectedThreadName] = useState<string>('')
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const { reconnecting } = useWebSocket()

  // Responsive listener
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: deselect thread
      if (e.key === 'Escape') {
        if (isMobile && selectedThreadId) {
          setSelectedThreadId(null)
          return
        }
      }

      // Ctrl+K / Cmd+K: focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isMobile, selectedThreadId])

  const toggleDarkMode = useCallback(() => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('laterbox-theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('laterbox-theme', 'light')
    }
  }, [isDark])

  const handleBack = useCallback(() => {
    setSelectedThreadId(null)
  }, [])

  // On mobile: show either sidebar or main panel
  const showSidebar = !isMobile || !selectedThreadId
  const showMain = !isMobile || !!selectedThreadId

  return (
    <div className="flex h-full flex-col bg-[#0b141a] dark:bg-[#0b141a]">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#2a3942] bg-[#202c33] px-4">
        <div className="flex items-center gap-2">
          {isMobile && selectedThreadId && (
            <button
              onClick={handleBack}
              className="mr-1 rounded p-1 text-[#aebac1] hover:bg-[#2a3942]"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <h1 className="text-base font-semibold text-[#e9edef]">
            {isMobile && selectedThreadId ? selectedThreadName : 'LaterBox Web'}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-[#00a884]">
            <Wifi size={14} />
            <span className="hidden sm:inline">Connected</span>
          </div>
          <button
            onClick={toggleDarkMode}
            className="rounded p-1.5 text-[#aebac1] hover:bg-[#2a3942] transition-colors"
            title={isDark ? 'Light mode' : 'Dark mode'}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={() => disconnect('manual')}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-gray-400 hover:bg-[#2a3942] hover:text-gray-200 transition-colors"
            title="Disconnect"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Disconnect</span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {showSidebar && (
          <Sidebar
            selectedThreadId={selectedThreadId}
            onSelectThread={(id, name) => {
              setSelectedThreadId(id)
              setSelectedThreadName(name)
            }}
            searchInputRef={searchInputRef}
            className={isMobile ? 'w-full' : 'w-[350px]'}
          />
        )}
        {showMain && (
          <MainPanel
            threadId={selectedThreadId}
            threadName={selectedThreadName}
          />
        )}
      </div>
      {/* Reconnecting toast */}
      {reconnecting && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg bg-yellow-600 px-4 py-2 text-sm text-white shadow-lg">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
          Reconnecting to phone...
        </div>
      )}
    </div>
  )
}
