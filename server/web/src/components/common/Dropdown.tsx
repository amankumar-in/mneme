import { useEffect, useRef, type ReactNode } from 'react'

interface DropdownItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  danger?: boolean
}

interface DropdownProps {
  items: DropdownItem[]
  onClose: () => void
  anchorRef?: React.RefObject<HTMLElement | null>
}

export function Dropdown({ items, onClose, anchorRef }: DropdownProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        anchorRef?.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose, anchorRef])

  const style: React.CSSProperties = {}
  if (anchorRef?.current) {
    const rect = anchorRef.current.getBoundingClientRect()
    style.position = 'fixed'
    style.top = rect.bottom + 4
    style.right = window.innerWidth - rect.right
    style.zIndex = 50
  }

  return (
    <div
      ref={menuRef}
      style={style}
      className="min-w-[160px] rounded-lg border border-[#2a3942] bg-[#233138] py-1 shadow-xl"
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={(e) => {
            e.stopPropagation()
            item.onClick()
            onClose()
          }}
          className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
            item.danger
              ? 'text-red-400 hover:bg-[#2a3942]'
              : 'text-[#e9edef] hover:bg-[#2a3942]'
          }`}
        >
          {item.icon && <span className="shrink-0">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  )
}
