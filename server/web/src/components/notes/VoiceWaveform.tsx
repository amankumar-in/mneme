import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause } from 'lucide-react'

interface VoiceWaveformProps {
  src: string
  duration: number
  waveform?: number[] | null
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const DEFAULT_BARS = 40

export function VoiceWaveform({ src, duration, waveform }: VoiceWaveformProps) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const animRef = useRef<number>(0)

  const rawBars = waveform && waveform.length > 0
    ? waveform
    : Array.from({ length: DEFAULT_BARS }, () => 0.2 + Math.random() * 0.8)
  // Normalize: phone stores 0-100 integers, we need 0-1 floats
  const maxVal = Math.max(...rawBars, 1)
  const bars = maxVal > 1 ? rawBars.map(v => v / maxVal) : rawBars

  const updateProgress = useCallback(() => {
    const audio = audioRef.current
    if (audio && playing) {
      setProgress(audio.currentTime / (audio.duration || duration || 1))
      setCurrentTime(audio.currentTime)
      animRef.current = requestAnimationFrame(updateProgress)
    }
  }, [playing, duration])

  useEffect(() => {
    if (playing) {
      animRef.current = requestAnimationFrame(updateProgress)
    }
    return () => cancelAnimationFrame(animRef.current)
  }, [playing, updateProgress])

  const togglePlay = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(src)
      audioRef.current.onended = () => {
        setPlaying(false)
        setProgress(0)
        setCurrentTime(0)
      }
    }
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play()
      setPlaying(true)
    }
  }

  const handleBarClick = (index: number) => {
    const pct = index / bars.length
    if (audioRef.current) {
      audioRef.current.currentTime = pct * (audioRef.current.duration || duration)
      setProgress(pct)
    }
  }

  return (
    <div className="flex min-w-[240px] items-center gap-3 py-1">
      <button
        onClick={togglePlay}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-brand)] text-[var(--accent)] hover:bg-[var(--bg-brand-hover)] transition-colors"
      >
        {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex h-8 items-end gap-[2px]">
          {bars.map((amplitude, i) => {
            const isPast = i / bars.length < progress
            return (
              <div
                key={i}
                onClick={() => handleBarClick(i)}
                className="w-[3px] cursor-pointer rounded-full transition-colors"
                style={{
                  height: `${Math.max(amplitude * 100, 10)}%`,
                  backgroundColor: isPast ? 'var(--accent)' : 'var(--border)',
                }}
              />
            )
          })}
        </div>
        <span className="text-[11px] text-[var(--text-subtle)]">
          {playing ? formatDuration(currentTime) : formatDuration(duration)}
        </span>
      </div>
    </div>
  )
}
