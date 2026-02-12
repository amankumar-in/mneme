interface VideoPlayerProps {
  src: string
  poster?: string
}

export function VideoPlayer({ src, poster }: VideoPlayerProps) {
  return (
    <div className="overflow-hidden rounded">
      <video
        src={src}
        poster={poster}
        controls
        preload="metadata"
        className="max-h-[300px] max-w-full rounded"
      />
    </div>
  )
}
