import { formatDate } from '../../utils/formatters'

interface DateSeparatorProps {
  date: Date
}

export function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <div className="my-4 flex items-center justify-center">
      <span className="rounded-xl bg-[var(--bg-secondary)] px-3 py-1 text-xs font-medium text-[var(--text-subtle)] shadow-sm">
        {formatDate(date)}
      </span>
    </div>
  )
}
