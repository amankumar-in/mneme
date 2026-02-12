import { formatDate } from '../../utils/formatters'

interface DateSeparatorProps {
  date: Date
}

export function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <div className="my-4 flex items-center justify-center">
      <span className="rounded-lg bg-[#182229] px-3 py-1 text-xs font-medium text-[#8696a0] shadow-sm">
        {formatDate(date)}
      </span>
    </div>
  )
}
