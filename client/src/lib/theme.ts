import { useEffect, useState } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'
// v2: light became the default (v1 stored "system" for every visitor).
const KEY = 'cc-theme-v2'

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'system' || v === 'dark' ? v : 'light'
  } catch {
    return 'light'
  }
}

function apply(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#2A2220' : '#F4EEEA')
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(readPref)

  useEffect(() => {
    apply(pref)
    try {
      localStorage.setItem(KEY, pref)
    } catch {
      /* storage unavailable: theme still applies for this visit */
    }
    if (pref !== 'system') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    // Re-read storage: another component may have switched to a fixed theme since.
    const onChange = () => apply(readPref())
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [pref])

  return { pref, setPref }
}
