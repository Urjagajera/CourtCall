import { useEffect, useState } from 'react'

// "Install app" support. Android Chrome fires beforeinstallprompt; we keep it so a button can show the
// real install dialog. iPhone has no prompt: users add it from Safari's Share menu.

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
const subs = new Set<() => void>()
const notify = () => subs.forEach((f) => f())

/** Called once from main.tsx, before React renders, so the early event is never missed. */
export function setupInstall() {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallPromptEvent
    notify()
  })
  addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
  }
}

export const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

export type InstallMode = 'installed' | 'prompt' | 'ios' | 'manual'

export function useInstall() {
  const [, force] = useState(0)
  useEffect(() => {
    const f = () => force((n) => n + 1)
    subs.add(f)
    return () => {
      subs.delete(f)
    }
  }, [])
  const mode: InstallMode = isStandalone() ? 'installed' : deferred ? 'prompt' : isIos() ? 'ios' : 'manual'
  return {
    mode,
    install: async () => {
      if (!deferred) return false
      await deferred.prompt()
      const { outcome } = await deferred.userChoice
      deferred = null
      notify()
      return outcome === 'accepted'
    },
  }
}
