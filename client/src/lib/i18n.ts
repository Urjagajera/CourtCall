// App language for lawyers and staff (English, Hindi, Gujarati). Instead of rewriting every screen, the fixed
// English texts on screen are swapped for their translation from lib/uiDict.ts as the page renders, and put
// back when the language returns to English. Anything inside [data-no-translate] (chat messages, names people
// type) is left alone. Client pages have their own wording (lib/clientI18n.ts) and are skipped here.
import { useSyncExternalStore } from 'react'
import { UI, UI_PATTERNS, UI_WORDS } from './uiDict'

export type AppLang = 'en' | 'hi' | 'gu'
export const APP_LANGS: { code: AppLang; label: string; sample: string }[] = [
  { code: 'en', label: 'English', sample: 'Today · Cases · Chat' },
  { code: 'hi', label: 'हिंदी', sample: 'आज · केस · चैट' },
  { code: 'gu', label: 'ગુજરાતી', sample: 'આજે · કેસ · ચેટ' },
]
const KEY = 'cc-app-lang'

let lang: AppLang = (() => {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'hi' || v === 'gu' ? v : 'en'
  } catch {
    return 'en'
  }
})()
const subs = new Set<() => void>()

export function getAppLang() {
  return lang
}
export function useAppLang() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => lang,
  )
}

/** Translate one fixed text (exact match, then the patterns). Unknown texts come back unchanged. */
export function tr(text: string, to: AppLang = lang): string {
  if (to === 'en') return text
  const i = to === 'hi' ? 0 : 1
  const key = text.replace(/\s+/g, ' ').trim()
  const hit = UI[key]
  if (hit) return text.replace(key, hit[i])
  for (const [re, hi, gu] of UI_PATTERNS) {
    const m = key.match(re)
    if (m) return text.replace(key, key.replace(re, i === 0 ? hi : gu))
  }
  // Dates like "Sat, 21 Nov" or "November 2026": only weekday/month words and numbers.
  if (/^[A-Za-z]{3,9},? ?(\d{1,2} )?[A-Za-z]{3,9}( \d{4})?$|^[A-Za-z]{3,9} \d{1,4}$|^[A-Za-z]{3}$/.test(key) && key.split(/[ ,]+/).every((w) => !w || /^\d+$/.test(w) || UI_WORDS[w])) {
    return text.replace(key, key.replace(/[A-Za-z]+/g, (w) => UI_WORDS[w]?.[i] ?? w))
  }
  return text
}

// ---- the on-screen swap ----
const original = new WeakMap<Node, string>() // text node -> its English text
const shown = new WeakMap<Node, string>() // text node -> what we last wrote (to ignore our own writes)
const ATTRS = ['placeholder', 'aria-label', 'title'] as const

// The client's own pages (/case, /case/…, /c/<token>) have their own wording. /cases is the staff Cases page.
const skipPage = () => /^\/(case(\/|$)|c\/)/.test(location.pathname)
function skippable(el: Element | null) {
  for (let e = el; e; e = e.parentElement) {
    if (e.hasAttribute?.('data-no-translate')) return true
    const t = e.tagName
    if (t === 'SCRIPT' || t === 'STYLE' || t === 'TEXTAREA' || t === 'CODE') return true
  }
  return false
}

function doText(node: Text) {
  const cur = node.data
  if (shown.get(node) === cur) return // our own write
  // React wrote new English text: remember it as the original.
  original.set(node, cur)
  const next = tr(cur)
  if (next !== cur) {
    shown.set(node, next)
    node.data = next
  } else shown.delete(node)
}
function doAttrs(el: Element) {
  for (const a of ATTRS) {
    const v = el.getAttribute(a)
    if (!v) continue
    const o = `data-en-${a}`
    const stored = el.getAttribute(o)
    // A new English value from React replaces the stored one.
    const english = stored && tr(stored) === v ? stored : v
    el.setAttribute(o, english)
    const next = tr(english)
    if (next !== v) el.setAttribute(a, next)
  }
}
function walk(root: Node) {
  if (skipPage()) return
  if (root.nodeType === Node.TEXT_NODE) {
    if (!skippable((root as Text).parentElement)) doText(root as Text)
    return
  }
  if (!(root instanceof Element) || skippable(root)) return
  doAttrs(root)
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      if (/[A-Za-z]/.test((n as Text).data) && !skippable((n as Text).parentElement)) doText(n as Text)
    } else if (!skippable(n as Element)) doAttrs(n as Element)
  }
}
/** Put every swapped text back to English (switching to English). */
function restore() {
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      const o = original.get(n)
      if (o !== undefined && shown.get(n) === (n as Text).data) (n as Text).data = o
      shown.delete(n)
    } else {
      for (const a of ATTRS) {
        const o = (n as Element).getAttribute(`data-en-${a}`)
        if (o) (n as Element).setAttribute(a, o)
      }
    }
  }
}

let observer: MutationObserver | null = null
function ensureObserver() {
  if (observer || typeof MutationObserver === 'undefined') return
  observer = new MutationObserver((muts) => {
    if (lang === 'en') return
    for (const m of muts) {
      if (m.type === 'characterData') walk(m.target)
      else if (m.type === 'attributes') {
        if (!m.attributeName?.startsWith('data-en-')) walk(m.target)
      } else m.addedNodes.forEach((n) => walk(n))
    }
  })
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] })
}

/** Switch the app language (saved on this device; the caller saves it to the profile). */
export function setAppLang(next: AppLang) {
  const prev = lang
  lang = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    /* ignore */
  }
  document.documentElement.lang = next === 'en' ? 'en' : next
  ensureObserver()
  if (next === 'en') {
    if (prev !== 'en') restore()
  } else walk(document.body)
  subs.forEach((f) => f())
}

/** Start the swap at app start with the language saved on this device. */
export function startI18n() {
  ensureObserver()
  if (lang !== 'en') setTimeout(() => walk(document.body), 0)
}
