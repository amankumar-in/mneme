import { useThreads } from '../../hooks/useThreads'
import { ThreadListItem } from './ThreadListItem'
import { Spinner } from '../common/Spinner'

interface ThreadListProps {
  search: string
  selectedThreadId: string | null
  onSelectThread: (id: string, name: string, isSystemThread: boolean) => void
}

export function ThreadList({ search, selectedThreadId, onSelectThread }: ThreadListProps) {
  const { data: threads, isLoading, error } = useThreads(search || undefined)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="md" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-8 text-center text-sm text-[var(--text-subtle)]">
        Failed to load threads
      </div>
    )
  }

  if (!threads?.length) {
    return (
      <div className="px-4 py-8 text-center text-sm text-[var(--text-subtle)]">
        {search ? 'No threads found' : 'No threads yet'}
      </div>
    )
  }

  const pinned = threads.filter((t) => t.isPinned)
  const unpinned = threads.filter((t) => !t.isPinned)

  return (
    <div>
      {pinned.length > 0 && (
        <>
          {pinned.map((thread) => (
            <ThreadListItem
              key={thread.id}
              thread={thread}
              isSelected={thread.id === selectedThreadId}
              onSelect={() => onSelectThread(thread.id, thread.name, thread.isSystemThread)}
            />
          ))}
          {unpinned.length > 0 && (
            <div className="mx-4 border-t border-[var(--border)]" />
          )}
        </>
      )}
      {unpinned.map((thread) => (
        <ThreadListItem
          key={thread.id}
          thread={thread}
          isSelected={thread.id === selectedThreadId}
          onSelect={() => onSelectThread(thread.id, thread.name, thread.isSystemThread)}
        />
      ))}
    </div>
  )
}
