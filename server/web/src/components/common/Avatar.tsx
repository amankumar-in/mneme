interface AvatarProps {
  name: string
  icon?: string | null
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-20 w-20 text-3xl',
}

const COLORS = [
  'bg-[#5B9A8B]',
  'bg-[#7FBBAB]',
  'bg-[#839E9D]',
  'bg-[#6BA3BE]',
  'bg-[#A78BBA]',
  'bg-[#D4856A]',
  'bg-[#C4916E]',
  'bg-[#7B9EBF]',
]

function getColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COLORS[Math.abs(hash) % COLORS.length]
}

export function Avatar({ name, icon, size = 'md' }: AvatarProps) {
  const isEmoji = icon && /\p{Emoji}/u.test(icon)

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full ${SIZES[size]} ${
        isEmoji ? 'bg-[var(--bg-tinted)]' : getColor(name)
      }`}
    >
      {isEmoji ? (
        <span>{icon}</span>
      ) : (
        <span className="font-semibold text-white">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  )
}
