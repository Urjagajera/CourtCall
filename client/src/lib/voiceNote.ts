import { useCallback, useEffect, useRef, useState } from 'react'

/** Nexconn HD voice messages are at most 60 seconds. */
export const MAX_VOICE_SECONDS = 60

// Android Chrome records webm/opus; iPhone Safari records mp4/aac. Pick the first the browser supports.
const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

export function voiceNotesSupported() {
  return typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia
}

/** Tap to record a voice note, then send or cancel. Stops by itself at 60 seconds. */
export function useVoiceRecorder(onDone: (file: File, seconds: number) => void) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const started = useRef(0)
  const keep = useRef(false)
  const timer = useRef<number | null>(null)
  const done = useRef(onDone)
  done.current = onDone

  const cleanup = useCallback(() => {
    if (timer.current) window.clearInterval(timer.current)
    timer.current = null
    rec.current?.stream.getTracks().forEach((t) => t.stop())
    rec.current = null
    setRecording(false)
    setSeconds(0)
  }, [])

  const stop = useCallback((send: boolean) => {
    keep.current = send
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop()
    else cleanup()
  }, [cleanup])

  const start = useCallback(async () => {
    setError(null)
    if (!voiceNotesSupported()) {
      setError('This browser cannot record voice notes.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t))
      const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunks.current = []
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
      r.onstop = () => {
        const secs = Math.min(MAX_VOICE_SECONDS, Math.max(1, Math.round((Date.now() - started.current) / 1000)))
        const type = r.mimeType || mimeType || 'audio/webm'
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
        const blob = new Blob(chunks.current, { type })
        cleanup()
        if (keep.current && blob.size > 0) done.current(new File([blob], `voice-note.${ext}`, { type }), secs)
      }
      rec.current = r
      started.current = Date.now()
      r.start()
      setRecording(true)
      timer.current = window.setInterval(() => {
        const s = Math.floor((Date.now() - started.current) / 1000)
        setSeconds(s)
        if (s >= MAX_VOICE_SECONDS) stop(true)
      }, 250)
    } catch {
      cleanup()
      setError('Microphone blocked. Allow the microphone for CourtCall and try again.')
    }
  }, [cleanup, stop])

  // Leaving the chat while recording throws the recording away.
  useEffect(() => () => {
    keep.current = false
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop()
  }, [])

  return { recording, seconds, error, start, send: () => stop(true), cancel: () => stop(false) }
}
