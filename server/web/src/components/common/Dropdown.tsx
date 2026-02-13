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
    const menuWidth = 160
    const menuHeight = 250 // estimated max height
    style.position = 'fixed'
    style.zIndex = 50

    // Vertical: prefer below, flip above if not enough space
    if (rect.bottom + 4 + menuHeight > window.innerHeight) {
      style.bottom = window.innerHeight - rect.top + 4
    } else {
      style.top = rect.bottom + 4
    }

    // Horizontal: prefer right-aligned, flip to left-aligned if off-screen
    const rightOffset = window.innerWidth - rect.right
    if (rightOffset + menuWidth > window.innerWidth) {
      style.left = Math.max(4, rect.left)
    } else {
      style.right = Math.max(4, rightOffset)
    }
  }

  return (
    <div
      ref={menuRef}
      style={style}
      className="min-w-[160px] rounded-xl border border-[var(--border)] bg-[var(--bg)] py-1 shadow-xl"
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
              ? 'text-[var(--error)] hover:bg-[var(--bg-tertiary)]'
              : 'text-[var(--text)] hover:bg-[var(--bg-tertiary)]'
          }`}
        >
          {item.icon && <span className="shrink-0">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  )
}
