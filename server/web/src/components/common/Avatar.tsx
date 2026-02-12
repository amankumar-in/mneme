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
  'bg-[#00a884]',
  'bg-[#53bdeb]',
  'bg-[#ff6b6b]',
  'bg-[#ffa726]',
  'bg-[#ab47bc]',
  'bg-[#5c6bc0]',
  'bg-[#26a69a]',
  'bg-[#ec407a]',
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
        isEmoji ? 'bg-[#202c33]' : getColor(name)
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
