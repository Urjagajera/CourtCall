import { Check, Copy, Link2, MessageCircle, Plus, RefreshCw, Smartphone, Users, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { Case } from '../lib/api'
import { api } from '../lib/api'
import { formatDate } from '../lib/dates'
import { Sheet } from './Sheet'
import { Badge, Banner, Button, cx } from './ui'

interface LinkRow {
  id: string
  kind: 'client' | 'family'
  label: string | null
  activatedAt: string | null
  revokedAt: string | null
  createdAt: string
  createdByName: string | null
}

/** wa.me needs digits with country code. Indian 10-digit numbers get +91. */
function whatsappUrl(phone: string | null, text: string) {
  const digits = (phone ?? '').replace(/\D/g, '')
  const to = digits.length === 10 ? `91${digits}` : digits
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`
}

/** Create, share (WhatsApp), turn off and reissue the private links for one case. */
export function LinkSheet({ c, clientPhone, onClose }: { c: Case; clientPhone: string | null; onClose: () => void }) {
  const [links, setLinks] = useState<LinkRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  // The raw token exists only right after creating a link; it's never stored or shown again.
  const [fresh, setFresh] = useState<{ kind: 'client' | 'family'; url: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    try {
      setLinks((await api<{ links: LinkRow[] }>(`/cases/${c.id}/links`)).links)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load links')
    }
  }, [c.id])
  useEffect(() => {
    load()
  }, [load])

  async function run(key: string, fn: () => Promise<{ token?: string; link: LinkRow }>) {
    setBusy(key)
    setError(null)
    try {
      const r = await fn()
      if (r.token) setFresh({ kind: r.link.kind, url: `${location.origin}/c/${r.token}` })
      setCopied(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the link')
    } finally {
      setBusy(null)
    }
  }
  const create = (kind: 'client' | 'family') => run(`new-${kind}`, () => api(`/cases/${c.id}/links`, { body: { kind } }))
  const revoke = (l: LinkRow) => run(`off-${l.id}`, () => api(`/links/${l.id}/revoke`, { method: 'POST' }))
  const reissue = (l: LinkRow) => run(`re-${l.id}`, () => api(`/links/${l.id}/reissue`, { method: 'POST' }))

  const message = fresh
    ? fresh.kind === 'client'
      ? `Namaste ${c.clientName}, follow your case "${c.title}" live on CourtCall: ${fresh.url}\nOpen it on your own phone. It works only on the first phone that opens it. No app needed.`
      : `Follow the case "${c.title}" live on CourtCall (updates only): ${fresh.url}\nIt works only on the first phone that opens it.`
    : ''

  return (
    <Sheet open title="Client links" onClose={onClose}>
      <p className="text-label text-ink-muted">
        {c.title} · {c.clientName}
      </p>
      {error && (
        <div className="mt-3">
          <Banner tone="stopped">{error}</Banner>
        </div>
      )}

      {fresh && (
        <div className="cc-pop mt-4 rounded-lg border-2 border-accent bg-surface-raised p-4">
          <p className="flex items-center gap-2 text-label font-semibold">
            <Link2 className="size-4" strokeWidth={1.75} /> New {fresh.kind === 'client' ? 'client' : 'family'} link ready
          </p>
          <p className="mt-2 break-all rounded-md border border-line bg-surface p-2 text-caption">{fresh.url}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a
              href={whatsappUrl(clientPhone, message)}
              target="_blank"
              rel="noreferrer"
              className="flex h-11 items-center justify-center gap-2 rounded-md bg-accent text-label font-semibold text-accent-ink hover:bg-accent-strong"
            >
              <MessageCircle className="size-4" strokeWidth={1.75} /> Share on WhatsApp
            </a>
            <Button
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(fresh.url)
                setCopied(true)
              }}
              icon={copied ? <Check className="size-4" strokeWidth={1.75} /> : <Copy className="size-4" strokeWidth={1.75} />}
            >
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
          <p className="mt-2 text-caption text-ink-muted">
            This link is shown only now. Don't open it yourself: it locks to the first phone that opens it.
          </p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button loading={busy === 'new-client'} onClick={() => create('client')} icon={<Plus className="size-4" strokeWidth={1.75} />}>
          Client link
        </Button>
        <Button
          variant="secondary"
          loading={busy === 'new-family'}
          onClick={() => create('family')}
          icon={<Users className="size-4" strokeWidth={1.75} />}
        >
          Family link
        </Button>
      </div>
      <p className="mt-2 text-caption text-ink-muted">Client links include chat with your firm. Family links show progress only.</p>

      <ul className="mt-4 divide-y divide-line border-t border-line">
        {links === null && <li className="py-3 text-label text-ink-muted">Loading…</li>}
        {links?.length === 0 && <li className="py-3 text-label text-ink-muted">No links yet for this case.</li>}
        {links?.map((l) => {
          const off = !!l.revokedAt
          return (
            <li key={l.id} className={cx('flex flex-wrap items-center gap-3 py-3', off && 'opacity-60')}>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-label font-semibold">
                  {l.kind === 'client' ? 'Client link' : 'Family link'}
                  {off ? (
                    <Badge tone="stopped">Turned off</Badge>
                  ) : l.activatedAt ? (
                    <Badge tone="hearing" icon={<Smartphone className="size-3.5" strokeWidth={1.75} />}>
                      On a phone
                    </Badge>
                  ) : (
                    <Badge tone="waiting">Not opened yet</Badge>
                  )}
                </p>
                <p className="text-caption text-ink-muted">
                  {l.label ? `${l.label} · ` : ''}Created {formatDate(l.createdAt.slice(0, 10))}
                  {l.createdByName && ` by ${l.createdByName}`}
                  {l.activatedAt && ` · opened ${formatDate(l.activatedAt.slice(0, 10))}`}
                </p>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="secondary" loading={busy === `re-${l.id}`} onClick={() => reissue(l)} icon={<RefreshCw className="size-4" strokeWidth={1.75} />}>
                  New link
                </Button>
                {!off && (
                  <Button size="sm" variant="ghost" loading={busy === `off-${l.id}`} onClick={() => revoke(l)} icon={<XCircle className="size-4" strokeWidth={1.75} />}>
                    Turn off
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
