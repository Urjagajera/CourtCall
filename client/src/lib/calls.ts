// In-app voice calls over the Nexconn Call SDK (@nexconn/call): client ↔ lawyer, lawyer → client.
// One call at a time. The engine is installed before the Chat SDK starts (Nexconn requires that order) and
// started once chat is connected; calls use the same Nexconn user IDs as chat (u…, c…).
import { NCCallEngine, NCCallLogLevel, NCCallMediaType, NCCallType, type NCCallSession } from '@nexconn/call'
import { useSyncExternalStore } from 'react'

export type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'connected' | 'ended'
export interface CallState {
  phase: CallPhase
  callId: string | null
  peerId: string | null
  peerName: string | null
  /** When the call connected (ms), for the timer and the call log. */
  connectedAt: number | null
  muted: boolean
  /** Why the last call ended (shown briefly): 'ended' | 'no_answer' | 'failed'. */
  endNote: 'ended' | 'no_answer' | 'failed' | null
  /** Did this browser start the call (only the caller writes the call log into the chat). */
  outgoing: boolean
}

const initial: CallState = { phase: 'idle', callId: null, peerId: null, peerName: null, connectedAt: null, muted: false, endNote: null, outgoing: false }
let state: CallState = initial
const subs = new Set<() => void>()
const set = (s: Partial<CallState>) => {
  state = { ...state, ...s }
  subs.forEach((f) => f())
}

export const useCall = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => state,
  )

/** Who a Nexconn user ID is, for the incoming-call screen (set by the pages that know names). */
let nameOf: (id: string) => string | undefined = () => undefined
export function setCallNames(fn: (id: string) => string | undefined) {
  nameOf = fn
}

/** Called after a call ends with a log line for the chat (e.g. "Voice call · 2 min 31 s"). */
let onLog: ((peerId: string, text: string) => void) | null = null
export function setCallLogWriter(fn: (peerId: string, text: string) => void) {
  onLog = fn
}

// ---------- engine lifecycle ----------

let installed = false
/** Must run once, before NCEngine.initialize(). */
export function installCallEngine() {
  if (installed) return
  try {
    NCCallEngine.install()
    installed = true
  } catch (e) {
    console.warn('[call] install failed', e)
  }
}

let engine: NCCallEngine | null = null
/** Starts the call engine once chat is connected. Safe to call more than once. */
export function startCallEngine() {
  if (!installed || engine) return
  try {
    engine = NCCallEngine.initialize({ logOutputLevel: NCCallLogLevel.ERROR })
    engine.setCallEventHandler({
      onCallReceived({ session }) {
        // Busy: one call at a time.
        if (state.phase !== 'idle' && state.phase !== 'ended') {
          engine?.endCall({ callId: session.getCallId() }).catch(() => {})
          return
        }
        const from = session.getCallerUserId()
        set({ ...initial, phase: 'incoming', callId: session.getCallId(), peerId: from, peerName: nameOf(from) ?? null, outgoing: false })
        ring(true)
      },
      onCallConnected({ session }) {
        ring(false)
        set({ phase: 'connected', callId: session.getCallId(), connectedAt: Date.now() })
      },
      onCallEnded({ session }) {
        finish(session)
      },
    })
  } catch (e) {
    console.warn('[call] engine failed to start', e)
    engine = null
  }
}

export const callsAvailable = () => !!engine

function finish(session?: NCCallSession) {
  if (session && state.callId && session.getCallId() !== state.callId) return
  ring(false)
  const { connectedAt, outgoing, peerId } = state
  const secs = connectedAt ? Math.round((Date.now() - connectedAt) / 1000) : 0
  const note: CallState['endNote'] = connectedAt ? 'ended' : 'no_answer'
  if (outgoing && peerId && onLog) onLog(peerId, connectedAt ? `📞 Voice call · ${fmt(secs)}` : '📞 Missed voice call')
  set({ ...initial, phase: 'ended', endNote: note, peerName: state.peerName })
  setTimeout(() => state.phase === 'ended' && set(initial), 2500)
}

const fmt = (s: number) => (s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`)

// ---------- actions ----------

export async function startVoiceCall(peerId: string, peerName: string) {
  if (!engine) return set({ ...initial, phase: 'ended', endNote: 'failed', peerName })
  set({ ...initial, phase: 'outgoing', peerId, peerName, outgoing: true })
  try {
    const r = await engine.startCall({ calleeIds: [peerId], callType: NCCallType.SINGLE, mediaType: NCCallMediaType.AUDIO })
    if (r.code !== 0 || !r.callId) throw new Error(`code ${r.code}`)
    if (state.phase === 'outgoing') set({ callId: r.callId })
  } catch (e) {
    console.warn('[call] start failed', e)
    set({ ...initial, phase: 'ended', endNote: 'failed', peerName })
    setTimeout(() => state.phase === 'ended' && set(initial), 3000)
  }
}

export async function acceptCall() {
  if (!engine || !state.callId) return
  ring(false)
  set({ phase: 'connecting' })
  const r = await engine.acceptCall({ callId: state.callId }).catch(() => null)
  if (!r || r.code !== 0) {
    set({ ...initial, phase: 'ended', endNote: 'failed', peerName: state.peerName })
    setTimeout(() => state.phase === 'ended' && set(initial), 3000)
  }
}

export async function endCall() {
  ring(false)
  if (engine) await engine.endCall(state.callId ? { callId: state.callId } : undefined).catch(() => {})
  finish()
}

export async function toggleMute() {
  if (!engine) return
  const muted = !state.muted
  const r = await engine.enableMicrophone(!muted).catch(() => null)
  if (r && r.code === 0) set({ muted })
}

// ---------- ringtone (Web Audio, no file needed) ----------

let ringTimer: ReturnType<typeof setInterval> | null = null
let audio: AudioContext | null = null
function ring(on: boolean) {
  if (!on) {
    if (ringTimer) clearInterval(ringTimer)
    ringTimer = null
    return
  }
  if (ringTimer) return
  const beep = () => {
    try {
      audio ??= new AudioContext()
      for (const at of [0, 0.4]) {
        const o = audio.createOscillator()
        const g = audio.createGain()
        o.frequency.value = 480
        g.gain.value = 0.08
        o.connect(g).connect(audio.destination)
        o.start(audio.currentTime + at)
        o.stop(audio.currentTime + at + 0.3)
      }
    } catch {
      /* audio blocked until the user taps the page */
    }
  }
  beep()
  ringTimer = setInterval(beep, 2500)
}
