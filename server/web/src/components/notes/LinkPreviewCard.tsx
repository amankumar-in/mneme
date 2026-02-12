interface LinkPreviewCardProps {
  preview: {
    url: string
    title?: string
    description?: string
    image?: string
  }
}

export function LinkPreviewCard({ preview }: LinkPreviewCardProps) {
  const domain = (() => {
    try {
      return new URL(preview.url).hostname.replace('www.', '')
    } catch {
      return preview.url
    }
  })()

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block overflow-hidden rounded-lg border border-[#ffffff15] bg-[#00493e] transition-colors hover:bg-[#005a4c]"
    >
      {preview.image && (
        <img
          src={preview.image}
          alt=""
          className="h-[140px] w-full object-cover"
          loading="lazy"
        />
      )}
      <div className="p-3">
        {preview.title && (
          <p className="text-sm font-medium text-[#e9edef] line-clamp-2">{preview.title}</p>
        )}
        {preview.description && (
          <p className="mt-1 text-xs text-[#8696a0] line-clamp-2">{preview.description}</p>
        )}
        <p className="mt-1 text-xs text-[#53bdeb]">{domain}</p>
      </div>
    </a>
  )
}
