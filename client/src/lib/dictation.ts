import { useCallback, useEffect, useRef, useState } from 'react'

// Voice-to-text with the browser's built-in speech recognition (Chrome, Edge, Safari; not Firefox).
// Text is only put in the message box: the person reads it and taps Send themselves.

interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type RecognitionCtor = new () => Recognition

function ctor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}
export const dictationSupported = () => typeof window !== 'undefined' && ctor() !== null

const ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone is blocked. Allow it for this site in your browser settings.',
  'service-not-allowed': 'Microphone is blocked. Allow it for this site in your browser settings.',
  'no-speech': "Didn't hear anything. Tap the mic and speak again.",
  network: 'Voice typing needs internet.',
  'language-not-supported': "This browser can't type this language by voice. Try English.",
}

/**
 * `base` is the text already in the box when listening starts; spoken words are appended to it.
 * Returns listening state, start/stop, and the last error (plain sentence).
 */
export function useDictation(lang: string, onText: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<Recognition | null>(null)

  const stop = useCallback(() => rec.current?.stop(), [])
  useEffect(() => () => rec.current?.stop(), [])

  const start = useCallback(
    (base: string) => {
      const C = ctor()
      if (!C) return
      setError(null)
      const r = new C()
      r.lang = lang
      r.continuous = false
      r.interimResults = true
      const prefix = base.trim() ? base.trim() + ' ' : ''
      r.onresult = (e) => {
        let said = ''
        for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript
        onText(prefix + said.trim())
      }
      r.onerror = (e) => {
        if (e.error !== 'aborted') setError(ERRORS[e.error] ?? 'Voice typing stopped. Try again.')
      }
      r.onend = () => {
        setListening(false)
        rec.current = null
      }
      rec.current = r
      try {
        r.start()
        setListening(true)
      } catch {
        setError('Voice typing could not start. Try again.')
      }
    },
    [lang, onText],
  )

  return { listening, error, start, stop, supported: dictationSupported() }
}
