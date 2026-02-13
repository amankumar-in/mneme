import { useState, useRef, useCallback } from 'react'
import { Paperclip, Send } from 'lucide-react'
import { useCreateNote, useUploadFile } from '../../hooks/useNotes'
import type { NoteType } from '../../api/types'

interface NoteInputProps {
  threadId: string
  onSent: () => void
}

const MIME_TO_TYPE: Record<string, NoteType> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
}

function getTypeFromMime(mime: string): NoteType {
  const category = mime.split('/')[0]
  return MIME_TO_TYPE[category] || 'file'
}

export function NoteInput({ threadId, onSent }: NoteInputProps) {
  const [content, setContent] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const createNote = useCreateNote()
  const uploadFile = useUploadFile()

  const adjustHeight = () => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`
    }
  }

  const handleSend = useCallback(() => {
    const trimmed = content.trim()
    if (!trimmed) return

    createNote.mutate(
      { threadId, content: trimmed, type: 'text' },
      {
        onSuccess: () => {
          setContent('')
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
          }
          onSent()
        },
      },
    )
  }, [content, threadId, createNote, onSent])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileUpload = async (file: File) => {
    const noteType = getTypeFromMime(file.type)
    try {
      const result = await uploadFile.mutateAsync(file)
      console.log('[NoteInput] Upload result:', result)
      await createNote.mutateAsync(
        {
          threadId,
          type: noteType,
          content: noteType === 'file' ? file.name : undefined,
          attachment: {
            url: result.url,
            filename: result.filename || file.name,
            mimeType: result.mimeType || file.type,
            size: result.size || file.size,
          },
        },
      )
      onSent()
    } catch (err) {
      console.error('[NoteInput] File upload/create error:', err)
    }
  }

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files?.[0]) handleFileUpload(files[0])
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files?.[0]) handleFileUpload(files[0])
  }

  return (
    <div
      className={`border-t border-[var(--border)] bg-[var(--bg)] px-4 py-3 ${
        isDragging ? 'ring-2 ring-inset ring-[var(--accent)]' : ''
      }`}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="mb-2 rounded-xl bg-[var(--bg-brand)] p-2 text-center text-sm text-[var(--accent)]">
          Drop file to attach
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="mb-0.5 rounded-full p-2 text-[var(--icon)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text)] transition-colors"
        >
          <Paperclip size={20} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFilePick}
        />
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            adjustHeight()
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a note..."
          rows={1}
          className="max-h-[200px] min-h-[40px] flex-1 resize-none rounded-xl bg-[var(--bg-secondary)] px-4 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-placeholder)] outline-none"
        />
        <button
          onClick={handleSend}
          disabled={!content.trim() || createNote.isPending}
          className="mb-0.5 rounded-full p-2 text-[var(--icon)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent)] disabled:opacity-40 transition-colors"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  )
}
