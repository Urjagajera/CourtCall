import { Check, Languages } from 'lucide-react'
import { useState } from 'react'
import { api, type User } from '../lib/api'
import { APP_LANGS, setAppLang, useAppLang, type AppLang } from '../lib/i18n'
import { cx } from './ui'

/** The three language buttons (first-login picker and Settings). Saves to the profile and switches the app. */
export function LanguageChoice({ onSaved }: { onSaved?: (u: User) => void }) {
  const current = useAppLang()
  const [busy, setBusy] = useState<AppLang | null>(null)
  async function choose(code: AppLang) {
    setBusy(code)
    setAppLang(code)
    try {
      const { user } = await api<{ user: User }>('/auth/language', { body: { language: code } })
      onSaved?.(user)
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {APP_LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => choose(l.code)}
          disabled={busy !== null}
          aria-pressed={current === l.code}
          className={cx(
            'flex items-center justify-between gap-2 rounded-md border p-3 text-left transition-colors',
            current === l.code ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface-raised hover:border-accent',
          )}
        >
          <span data-no-translate>
            <span className="block text-body font-semibold">{l.label}</span>
            <span className="block text-caption opacity-80">{l.sample}</span>
          </span>
          {current === l.code && <Check className="size-5 shrink-0" strokeWidth={2} />}
        </button>
      ))}
    </div>
  )
}

/** First login: pick the app language before anything else (then the guided tour starts in it). */
export function LanguagePicker({ onDone }: { onDone: (u: User) => void }) {
  const [saved, setSaved] = useState<User | null>(null)
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/50 p-4" role="dialog" aria-modal="true" aria-labelledby="lang-title">
      <div className="w-full max-w-xl rounded-lg border border-line bg-surface p-6 shadow-sheet">
        <p id="lang-title" className="flex items-center gap-2 text-h2">
          <Languages className="size-6" strokeWidth={1.75} /> Choose your language
        </p>
        <p className="mt-1 text-label text-ink-muted" data-no-translate>
          Choose your language · अपनी भाषा चुनें · તમારી ભાષા પસંદ કરો
        </p>
        <div className="mt-4">
          <LanguageChoice onSaved={setSaved} />
        </div>
        <p className="mt-3 text-caption text-ink-muted">CourtCall will show menus, buttons and messages in this language. You can change it any time in Settings.</p>
        <button
          type="button"
          disabled={!saved}
          onClick={() => saved && onDone(saved)}
          className="mt-5 flex h-12 w-full items-center justify-center rounded-md bg-accent text-label font-semibold text-accent-ink disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
