import { Mic, MicOff, Phone, PhoneOff, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { acceptCall, endCall, toggleMute, useCall } from '../lib/calls'
import { useClientText } from '../lib/clientI18n'
import { cx } from './ui'

/**
 * Full-screen in-app voice call (Nexconn Call SDK), on every page for lawyers, staff and clients.
 * Words follow the client's language on the client page, English elsewhere.
 */
export function CallOverlay() {
  const call = useCall()
  const t = useClientText()
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (call.phase !== 'connected') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [call.phase])

  if (call.phase === 'idle') return null
  const name = call.peerName ?? 'CourtCall'

  if (call.phase === 'ended') {
    return (
      <div role="status" className="cc-pop fixed inset-x-0 top-4 z-[90] mx-auto w-fit rounded-full bg-ink px-4 py-2 text-label font-semibold text-surface shadow-sheet">
        {call.endNote === 'failed' ? t.callFailed : call.endNote === 'no_answer' ? t.noAnswer : t.callEnded}
      </div>
    )
  }

  const secs = call.connectedAt ? Math.max(0, Math.floor((now - call.connectedAt) / 1000)) : 0
  const timer = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
  const status =
    call.phase === 'incoming' ? t.incomingCall(name) : call.phase === 'outgoing' ? t.calling(name) : call.phase === 'connecting' ? '…' : `${t.inCall} · ${timer}`

  return (
    <div role="dialog" aria-modal="true" aria-label={status} className="fixed inset-0 z-[90] flex flex-col items-center justify-between bg-accent px-6 pb-12 pt-20 text-accent-ink">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className={cx('flex size-24 items-center justify-center rounded-full bg-surface/15', call.phase !== 'connected' && 'animate-pulse')}>
          <UserRound className="size-12" strokeWidth={1.5} />
        </span>
        <p className="text-h1">{name}</p>
        <p className="text-body opacity-90" aria-live="polite">
          {status}
        </p>
        <p className="text-caption opacity-75">CourtCall · Nexconn voice call</p>
      </div>

      {call.phase === 'incoming' ? (
        <div className="flex w-full max-w-xs justify-between">
          <RoundButton label={t.decline} onClick={endCall} tone="red" icon={<PhoneOff className="size-7" strokeWidth={1.75} />} />
          <RoundButton label={t.accept} onClick={acceptCall} tone="green" icon={<Phone className="size-7" strokeWidth={1.75} />} />
        </div>
      ) : (
        <div className="flex w-full max-w-xs justify-center gap-10">
          {call.phase === 'connected' && (
            <RoundButton
              label={call.muted ? t.unmute : t.mute}
              onClick={toggleMute}
              tone="plain"
              icon={call.muted ? <MicOff className="size-7" strokeWidth={1.75} /> : <Mic className="size-7" strokeWidth={1.75} />}
            />
          )}
          <RoundButton label={t.hangUp} onClick={endCall} tone="red" icon={<PhoneOff className="size-7" strokeWidth={1.75} />} />
        </div>
      )}
    </div>
  )
}

function RoundButton({ label, onClick, tone, icon }: { label: string; onClick: () => void; tone: 'red' | 'green' | 'plain'; icon: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 text-label font-semibold">
      <span
        className={cx(
          'flex size-16 items-center justify-center rounded-full shadow-sheet',
          tone === 'red' ? 'bg-stopped-fg text-white' : tone === 'green' ? 'bg-hearing-fg text-white' : 'bg-surface/20',
        )}
      >
        {icon}
      </span>
      {label}
    </button>
  )
}
