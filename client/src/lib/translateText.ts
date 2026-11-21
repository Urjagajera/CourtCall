// Translate text people typed (chat messages, hearing summaries) into the reader's language, through the
// server's free translator (/api/translate for staff, /api/c/translate for client links). Cached per tab.
import { useEffect, useState } from 'react'
import { api } from './api'
import type { AppLang } from './i18n'

/** Which language a text is written in, from its script (same rule as the server). */
export function textLang(text: string): AppLang {
  if (/[઀-૿]/.test(text)) return 'gu'
  if (/[ऀ-ॿ]/.test(text)) return 'hi'
  return 'en'
}

const cache = new Map<string, string>()
const inflight = new Map<string, Promise<string>>()

export function translateText(text: string, to: AppLang, path = '/translate'): Promise<string> {
  if (!text.trim() || textLang(text) === to) return Promise.resolve(text)
  const key = `${to}|${text}`
  const hit = cache.get(key)
  if (hit) return Promise.resolve(hit)
  const running = inflight.get(key)
  if (running) return running
  const p = api<{ texts: string[] }>(path, { body: { texts: [text], to } })
    .then((r) => {
      const out = r.texts[0] ?? text
      cache.set(key, out)
      return out
    })
    .catch(() => text)
    .finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

/** The text in the reader's language when `auto`; otherwise only after `show()` is called. */
export function useTranslated(text: string | null | undefined, to: AppLang, opts: { auto?: boolean; path?: string } = {}) {
  const needs = !!text && textLang(text) !== to
  const [on, setOn] = useState(!!opts.auto)
  const [out, setOut] = useState<string | null>(null)
  useEffect(() => {
    if (!needs || !on || !text) return
    let live = true
    translateText(text, to, opts.path).then((t) => live && setOut(t))
    return () => {
      live = false
    }
  }, [needs, on, text, to, opts.path])
  return {
    needs,
    showing: needs && on && out !== null && out !== text,
    loading: needs && on && out === null,
    text: needs && on && out ? out : (text ?? ''),
    show: () => setOn(true),
    hide: () => setOn(false),
  }
}

export const SHOW_IN: Record<AppLang, string> = { en: 'Show in English', hi: 'हिंदी में दिखाएँ', gu: 'ગુજરાતીમાં બતાવો' }
export const SHOW_ORIGINAL: Record<AppLang, string> = { en: 'Show original', hi: 'मूल दिखाएँ', gu: 'મૂળ બતાવો' }
export const TRANSLATED: Record<AppLang, string> = { en: 'Translated', hi: 'अनुवादित', gu: 'અનુવાદિત' }
