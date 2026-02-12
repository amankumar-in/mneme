import {
  isToday,
  isYesterday,
  format,
  differenceInMinutes,
  differenceInHours,
} from 'date-fns'

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMin = differenceInMinutes(now, date)
  const diffHrs = differenceInHours(now, date)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHrs < 24 && isToday(date)) return `${diffHrs}h ago`
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'MM/dd/yy')
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function formatDate(date: Date): string {
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEE, MMM d')
}

export function formatTime(dateStr: string): string {
  return format(new Date(dateStr), 'h:mm a')
}

interface TextSegment {
  type: 'text' | 'url'
  text: string
}

const URL_REGEX = /https?:\/\/[^\s<>]+/g

export function linkify(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = URL_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', text: text.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'url', text: match[0] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', text: text.slice(lastIndex) })
  }

  if (segments.length === 0) {
    segments.push({ type: 'text', text })
  }

  return segments
}
