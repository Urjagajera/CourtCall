import { Phone, PhoneOff, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useClientLang, useClientText } from '../lib/clientI18n'
import { cx } from './ui'

/** Reads text aloud with the phone's own voice in the given language. Returns false when no voice can. */
export function speak(text: string, locale: string, onEnd?: () => void): boolean {
  if (!('speechSynthesis' in window)) return false
  const synth = window.speechSynthesis
  const voices = synth.getVoices()
  const short = locale.slice(0, 2)
  const voice = voices.find((v) => v.lang.replace('_', '-') === locale) ?? voices.find((v) => v.lang.toLowerCase().startsWith(short))
  // Some phones load voices late (empty list); try anyway with the language set, except where we know none fits.
  if (voices.length && !voice) return false
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = locale
  if (voice) u.voice = voice
  u.rate = 0.95
  u.onend = () => onEnd?.()
  u.onerror = () => onEnd?.()
  synth.speak(u)
  return true
}

/**
 * The client's hearing-day briefing as a phone-call style screen (CLAUDE.md "Hearing-day briefing"):
 * rings, "Answer" reads it aloud in the client's language, "Listen again", "Call my lawyer".
 */
export function BriefingCall({ text, firm, onClose, onCallLawyer }: { text: string; firm: string; onClose: () => void; onCallLawyer?: () => void }) {
  const t = useClientText()
  const lang = useClientLang()
  const [answered, setAnswered] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [noVoice, setNoVoice] = useState(false)
  const closed = useRef(false)

  // Gentle ring until answered (vibrate where supported).
  useEffect(() => {
    if (answered) return
    // Browsers only allow vibration after the person has touched the page.
    const buzz = () => (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive && navigator.vibrate?.([400, 200, 400])
    buzz()
    const id = setInterval(buzz, 2500)
    return () => clearInterval(id)
  }, [answered])
  useEffect(
    () => () => {
      closed.current = true
      window.speechSynthesis?.cancel()
    },
    [],
  )

  const play = () => {
    const ok = speak(text, lang.speech, () => !closed.current && setSpeaking(false))
    setNoVoice(!ok)
    setSpeaking(ok)
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={t.callingTitle} className="fixed inset-0 z-[95] flex flex-col bg-accent text-accent-ink">
      <div className="flex flex-1 flex-col items-center gap-3 overflow-y-auto px-6 pb-6 pt-16 text-center">
        <span className={cx('flex size-24 items-center justify-center rounded-full bg-surface/15', !answered && 'animate-pulse')}>
          <Volume2 className="size-12" strokeWidth={1.5} />
        </span>
        <p className="text-h1">{t.callingTitle}</p>
        <p className="text-body opacity-90">
          {firm} · {t.callingSub}
        </p>
        {answered && (
          <div className="mt-4 w-full max-w-md rounded-lg bg-surface p-4 text-left text-body text-ink">
            {noVoice && <p className="mb-2 text-label text-ink-muted">{t.noVoice}</p>}
            <p aria-live="polite">{text}</p>
            {speaking && <p className="mt-2 text-caption text-ink-muted">{t.speaking}</p>}
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-4 px-6 pb-10">
        {!answered ? (
          <div className="flex w-full max-w-xs justify-between">
            <button onClick={onClose} className="flex flex-col items-center gap-2 text-label font-semibold">
              <span className="flex size-16 items-center justify-center rounded-full bg-stopped-fg text-white shadow-sheet">
                <PhoneOff className="size-7" strokeWidth={1.75} />
              </span>
              {t.later}
            </button>
            <button
              onClick={() => {
                setAnswered(true)
                play()
              }}
              className="flex flex-col items-center gap-2 text-label font-semibold"
            >
              <span className="flex size-16 animate-bounce items-center justify-center rounded-full bg-hearing-fg text-white shadow-sheet">
                <Phone className="size-7" strokeWidth={1.75} />
              </span>
              {t.answer}
            </button>
          </div>
        ) : (
          <div className="flex w-full max-w-md flex-col gap-2">
            <button onClick={play} className="flex h-12 items-center justify-center gap-2 rounded-md bg-surface/20 text-body font-semibold">
              <Volume2 className="size-5" strokeWidth={1.75} /> {t.listenAgain}
            </button>
            {onCallLawyer && (
              <button
                onClick={() => {
                  window.speechSynthesis?.cancel()
                  onCallLawyer()
                }}
                className="flex h-12 items-center justify-center gap-2 rounded-md bg-hearing-fg text-body font-semibold text-white"
              >
                <Phone className="size-5" strokeWidth={1.75} /> {t.callLawyer}
              </button>
            )}
            <button onClick={onClose} className="h-11 text-label font-semibold underline underline-offset-4">
              {t.close}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
