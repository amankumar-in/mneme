import { XStack, Text } from 'tamagui'

interface DateSeparatorProps {
  date: Date
  label?: string
}

function formatDateSeparator(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const inputDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (inputDate.getTime() === today.getTime()) {
    return 'Today'
  }

  if (inputDate.getTime() === yesterday.getTime()) {
    return 'Yesterday'
  }

  const diffDays = Math.floor(
    (today.getTime() - inputDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (diffDays < 7) {
    return date.toLocaleDateString(undefined, { weekday: 'long' })
  }

  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
  }

  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function DateSeparator({ date, label }: DateSeparatorProps) {
  return (
    <XStack justifyContent="center" marginVertical="$3">
      <XStack
        backgroundColor="$gray4"
        paddingHorizontal="$3"
        paddingVertical="$1"
        borderRadius="$10"
      >
        <Text fontSize="$2" color="$gray11">
          {label || formatDateSeparator(date)}
        </Text>
      </XStack>
    </XStack>
  )
}
