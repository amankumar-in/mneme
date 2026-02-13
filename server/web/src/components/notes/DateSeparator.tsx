import { formatDate } from '../../utils/formatters'

interface DateSeparatorProps {
  date: Date
}

export function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <div className="my-4 flex items-center justify-center">
      <span className="rounded-full bg-[var(--input-bg)] px-4 py-1 text-[11px] font-medium text-[var(--text-subtle)]">
        {formatDate(date)}
      </span>
    </div>
  )
}
