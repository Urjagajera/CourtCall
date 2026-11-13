// Free translation of the lawyer's "Remember" note into the client's language (Urja: free APIs only).
// Uses the MyMemory public API (no key; free daily limit, raised by setting MYMEMORY_EMAIL).
// Any failure, timeout or used-up limit falls back to the note exactly as typed.
import type { Lang } from './alertText.js'

/** Which language a text is written in, from its script (Hindi uses Devanagari, Gujarati its own script). */
export function scriptLang(text: string): Lang {
  if (/[઀-૿]/.test(text)) return 'gu'
  if (/[ऀ-ॿ]/.test(text)) return 'hi'
  return 'en'
}

export async function translateNote(text: string, to: Lang): Promise<{ text: string; translated: boolean }> {
  const from = scriptLang(text)
  if (!text.trim() || from === to) return { text, translated: false }
  try {
    const url = new URL('https://api.mymemory.translated.net/get')
    url.searchParams.set('q', text.slice(0, 450)) // the free API takes up to 500 bytes per request
    url.searchParams.set('langpair', `${from}|${to}`)
    if (process.env.MYMEMORY_EMAIL) url.searchParams.set('de', process.env.MYMEMORY_EMAIL)
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    const body = (await res.json()) as { responseStatus?: number | string; responseData?: { translatedText?: string } }
    const out = body.responseData?.translatedText?.trim()
    // MyMemory reports a used-up limit as a 200 with a warning sentence; keep the original then.
    if (Number(body.responseStatus) !== 200 || !out || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(out)) return { text, translated: false }
    return { text: out, translated: true }
  } catch {
    return { text, translated: false }
  }
}
