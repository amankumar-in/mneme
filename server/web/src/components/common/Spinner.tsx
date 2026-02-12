interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: 'h-5 w-5 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-3',
}

export function Spinner({ size = 'md' }: SpinnerProps) {
  return (
    <div
      className={`animate-spin rounded-full border-[#2a3942] border-t-[#00a884] ${SIZES[size]}`}
    />
  )
}
