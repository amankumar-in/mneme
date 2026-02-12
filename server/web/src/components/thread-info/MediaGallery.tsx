import { useState } from 'react'
import { Play } from 'lucide-react'
import type { NoteWithDetails } from '../../api/types'
import { ImageViewer } from '../notes/ImageViewer'

interface MediaGalleryProps {
  notes: NoteWithDetails[]
}

export function MediaGallery({ notes }: MediaGalleryProps) {
  const [viewImage, setViewImage] = useState<string | null>(null)

  return (
    <>
      <div className="grid grid-cols-3 gap-1">
        {notes.map((note) => (
          <div
            key={note.id}
            className="relative aspect-square cursor-pointer overflow-hidden rounded bg-[#202c33]"
            onClick={() => {
              if (note.type === 'image' && note.attachment?.url) {
                setViewImage(note.attachment.url)
              }
            }}
          >
            <img
              src={note.attachment?.thumbnail || note.attachment?.url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
            {note.type === 'video' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Play size={24} className="text-white" />
              </div>
            )}
          </div>
        ))}
      </div>

      {viewImage && (
        <ImageViewer src={viewImage} onClose={() => setViewImage(null)} />
      )}
    </>
  )
}
