import { useCallback, useEffect, useRef, useState } from 'react'
import { useConnectionStore } from '../../store/connectionStore'
import { useWebSocket } from '../../hooks/useWebSocket'
import { Sidebar } from './Sidebar'
import { MainPanel } from './MainPanel'

export function AppLayout() {
  const disconnect = useConnectionStore((s) => s.disconnect)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [selectedThreadName, setSelectedThreadName] = useState<string>('')
  const [selectedThreadIsSystem, setSelectedThreadIsSystem] = useState(false)
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const { reconnecting } = useWebSocket()

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isMobile && selectedThreadId) {
          setSelectedThreadId(null)
          return
        }
      }
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

  const showSidebar = !isMobile || !selectedThreadId
  const showMain = !isMobile || !!selectedThreadId

  return (
    <div className="flex h-full bg-[var(--bg)]">
      {showSidebar && (
        <Sidebar
          selectedThreadId={selectedThreadId}
          onSelectThread={(id, name, isSystem) => {
            setSelectedThreadId(id)
            setSelectedThreadName(name)
            setSelectedThreadIsSystem(isSystem)
          }}
          searchInputRef={searchInputRef}
          className={isMobile ? 'w-full' : 'w-[380px]'}
        />
      )}
      {showMain && (
        <MainPanel
          threadId={selectedThreadId}
          threadName={selectedThreadName}
          isSystemThread={selectedThreadIsSystem}
          isDark={isDark}
          onToggleDark={toggleDarkMode}
          onDisconnect={() => disconnect('manual')}
          onBack={isMobile ? handleBack : undefined}
        />
      )}

      {reconnecting && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl bg-[var(--header-bg)] px-5 py-2.5 text-sm font-medium text-white shadow-lg">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
          Reconnecting to phone...
        </div>
      )}
    </div>
  )
}
