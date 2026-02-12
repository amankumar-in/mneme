import { useEffect } from 'react'
import { X } from 'lucide-react'

interface ImageViewerProps {
  src: string
  onClose: () => void
}

export function ImageViewer({ src, onClose }: ImageViewerProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-[#ffffff20] p-2 text-white hover:bg-[#ffffff40] transition-colors"
      >
        <X size={24} />
      </button>
      <img
        src={src}
        alt=""
        className="max-h-[90vh] max-w-[90vw] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}
