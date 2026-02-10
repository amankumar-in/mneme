import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, AppState } from 'react-native'
import { Audio } from 'expo-av'
import * as Haptics from 'expo-haptics'
import { saveAttachment } from '../services/fileStorage'
import type { AttachmentResult } from './useAttachmentHandler'

const startBeep = require('../assets/sounds/record_start.mp3')
const stopBeep = require('../assets/sounds/record_stop.mp3')

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
}

// Recording UI shows last N bars (rolling window)
const RECORDING_UI_BARS = 40

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function playFeedback(source: number): Promise<void> {
  try {
    const { sound } = await Audio.Sound.createAsync(source)
    await sound.playAsync()
    // Unload after playback finishes
    sound.setOnPlaybackStatusUpdate((status) => {
      if ('didJustFinish' in status && status.didJustFinish) {
        sound.unloadAsync()
      }
    })
  } catch {
    // Audio feedback is non-critical — silently ignore
  }
}

async function activateAudioSession(retries = 2): Promise<void> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })
      return
    } catch (error) {
      if (attempt < retries) {
        await delay(300)
      } else {
        throw error
      }
    }
  }
}

export function useVoiceRecorder() {
  const recordingRef = useRef<Audio.Recording | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  // Full waveform data (all samples, uncapped) — saved with the note
  const allLevelsRef = useRef<number[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  // Rolling window for the recording UI animation
  const [meteringLevels, setMeteringLevels] = useState<number[]>([])

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startRecording = useCallback(async () => {
    try {
      // Ensure app is in foreground before activating audio session
      if (AppState.currentState !== 'active') {
        await new Promise<void>(resolve => {
          const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') { sub.remove(); resolve() }
          })
          setTimeout(() => { sub.remove(); resolve() }, 2000)
        })
      }

      const { granted } = await Audio.requestPermissionsAsync()
      if (!granted) {
        Alert.alert('Permission Required', 'Microphone access is needed to record voice notes.')
        return false
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      await playFeedback(startBeep)
      await activateAudioSession()

      setDuration(0)
      setMeteringLevels([])
      allLevelsRef.current = []

      const { recording } = await Audio.Recording.createAsync(
        RECORDING_OPTIONS,
        (status) => {
          if (status.isRecording && status.metering !== undefined) {
            // Normalize dB (-160 to 0) to 0-1 range, clamping around -60 to 0 for useful range
            const normalized = Math.min(1, Math.max(0, (status.metering + 60) / 60))

            // Store every sample for the saved waveform
            allLevelsRef.current.push(normalized)

            // Rolling window for recording UI
            setMeteringLevels(prev => {
              const next = [...prev, normalized]
              return next.length > RECORDING_UI_BARS ? next.slice(-RECORDING_UI_BARS) : next
            })
          }
        },
        100 // Update every 100ms = 10 samples/sec
      )

      recordingRef.current = recording

      // Track duration with our own timer — status.durationMillis
      // can report 0 on iOS simulator
      startTimeRef.current = Date.now()
      clearTimer()
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 200)

      setIsRecording(true)
      return true
    } catch (error) {
      console.warn('[VoiceRecorder] Failed to start:', error)
      return false
    }
  }, [clearTimer])

  const stopRecording = useCallback(async (): Promise<AttachmentResult | null> => {
    const recording = recordingRef.current
    if (!recording) return null

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      clearTimer()
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)

      // Capture waveform before cleanup
      const waveform = allLevelsRef.current.map(v => Math.round(v * 100))
      allLevelsRef.current = []

      await recording.stopAndUnloadAsync()
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false })
      playFeedback(stopBeep)

      const uri = recording.getURI()
      recordingRef.current = null
      setIsRecording(false)

      if (!uri) return null

      // Skip very short recordings (< 1 second)
      if (elapsed < 1) return null

      const filename = `voice_${Date.now()}.m4a`
      const saved = await saveAttachment(uri, 'audio', filename)

      return {
        type: 'voice',
        localUri: saved.localUri,
        filename: saved.filename,
        mimeType: 'audio/mp4',
        duration: elapsed,
        waveform,
      }
    } catch (error) {
      console.warn('[VoiceRecorder] Failed to stop:', error)
      recordingRef.current = null
      setIsRecording(false)
      allLevelsRef.current = []
      return null
    }
  }, [clearTimer])

  const cancelRecording = useCallback(async () => {
    const recording = recordingRef.current
    if (!recording) return

    clearTimer()
    allLevelsRef.current = []
    try {
      await recording.stopAndUnloadAsync()
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false })
    } catch {
      // Ignore cleanup errors
    }
    recordingRef.current = null
    setIsRecording(false)
    setDuration(0)
    setMeteringLevels([])
  }, [clearTimer])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer()
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {})
      }
    }
  }, [clearTimer])

  return {
    isRecording,
    duration,
    meteringLevels,
    startRecording,
    stopRecording,
    cancelRecording,
  }
}
