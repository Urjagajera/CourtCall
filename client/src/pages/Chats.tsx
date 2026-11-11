import { ArrowLeft, Briefcase, ClipboardList, Crown, Lock, Search, UserRound, Users, type LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '../components/AppLayout'
import { ChatPanel } from '../components/ChatPanel'
import { Banner, cx } from '../components/ui'
import type { Client } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useChat, useUnreadCounts } from '../lib/nexconn'
import { useApi } from '../lib/useApi'

type Filter = 'lawyers' | 'staff' | 'clients'
interface Conv {
  key: string
  kind: 'group' | 'direct'
  id: string
  title: string
  sub: string
  icon: LucideIcon
  group: 'team' | Filter
  admin?: boolean
}

const ROLE_LABEL: Record<string, string> = { lawyer: 'Senior lawyer', junior: 'Junior lawyer', staff: 'Office staff' }

/**
 * Firm chat (Nexconn): the whole-firm team room, one-to-one chats with every colleague, and (for
 * lawyers and staff) private chats with clients. Filters: Lawyers (senior first, then juniors), Staff, Clients.
 */
export default function Chats() {
  const { user } = useAuth()
  const chat = useChat()
  const canChatClients = user!.role === 'lawyer' || user!.role === 'staff'
  const clients = useApi<{ clients: (Client & { ncId: string })[] }>(canChatClients ? '/clients' : null)
  const [selected, setSelected] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('lawyers')
  const [query, setQuery] = useState('')
  const unread = useUnreadCounts(selected)

  const convs: Conv[] = useMemo(() => {
    const list: Conv[] = []
    if (chat.team) {
      list.push({ key: 'team', kind: 'group', id: chat.team.groupId, title: `${chat.team.name} · Team`, sub: 'Everyone in the firm', icon: Users, group: 'team' })
      // Colleagues: senior lawyers first, then juniors, then staff; alphabetical inside each. Never yourself.
      const order: Record<string, number> = { lawyer: 0, junior: 1, staff: 2 }
      const colleagues = chat.team.members
        .filter((m) => m.ncId !== chat.myId && m.role in order)
        .sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name))
      for (const m of colleagues) {
        list.push({
          key: m.ncId,
          kind: 'direct',
          id: m.ncId,
          title: m.name,
          sub: ROLE_LABEL[m.role],
          icon: m.role === 'staff' ? ClipboardList : m.role === 'junior' ? Users : Briefcase,
          group: m.role === 'staff' ? 'staff' : 'lawyers',
          admin: m.isFirmAdmin,
        })
      }
    }
    for (const c of clients.data?.clients ?? []) {
      list.push({ key: c.id, kind: 'direct', id: c.ncId, title: c.name, sub: 'Client · private chat', icon: UserRound, group: 'clients' })
    }
    return list
  }, [chat.team, chat.myId, clients.data])

  const names = useMemo(() => {
    const n: Record<string, string> = {}
    for (const m of chat.team?.members ?? []) n[m.ncId] = m.name
    for (const c of clients.data?.clients ?? []) n[c.ncId] = c.name
    return n
  }, [chat.team, clients.data])

  const filters: { key: Filter; label: string }[] = [
    { key: 'lawyers', label: 'Lawyers' },
    { key: 'staff', label: 'Staff' },
    ...(canChatClients ? [{ key: 'clients' as const, label: 'Clients' }] : []),
  ]
  const count = (f: Filter) => convs.filter((c) => c.group === f).length
  const unreadIn = (f: Filter) => convs.filter((c) => c.group === f).reduce((n, c) => n + (unread[c.id] ?? 0), 0)

  const q = query.trim().toLowerCase()
  const team = convs.find((c) => c.group === 'team')
  const shown = convs.filter((c) => c.group === filter && (!q || c.title.toLowerCase().includes(q)))
  // Inside Lawyers: a small heading before seniors and before juniors.
  const seniors = shown.filter((c) => c.sub === ROLE_LABEL.lawyer)
  const juniors = shown.filter((c) => c.sub === ROLE_LABEL.junior)

  const active = convs.find((c) => c.key === selected) ?? null

  const row = (c: Conv) => (
    <li key={c.key}>
      <button
        onClick={() => setSelected(c.key)}
        className={cx(
          'flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors',
          selected === c.key ? 'bg-accent text-accent-ink' : 'hover:bg-surface-raised',
        )}
      >
        <span className={cx('flex size-10 shrink-0 items-center justify-center rounded-full', selected === c.key ? 'bg-surface/60' : 'bg-base')}>
          <c.icon className="size-5" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 truncate text-label font-semibold">
            {c.title}
            {c.admin && <Crown className="size-3.5 shrink-0" strokeWidth={2} aria-label="Firm admin" />}
          </span>
          <span className="flex items-center gap-1 text-caption opacity-80">
            <Lock className="size-3" strokeWidth={1.75} /> {c.sub}
            {c.admin && ' · Firm admin'}
          </span>
        </span>
        {unread[c.id] > 0 && selected !== c.key && (
          <span className="tabular flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-caption font-bold text-accent-ink">
            {unread[c.id]}
          </span>
        )}
      </button>
    </li>
  )

  return (
    <>
      <PageHeader title="Chat" subtitle="Private to your firm. Powered by Nexconn." />
      {chat.status === 'error' && <Banner tone="stopped">{chat.error}</Banner>}
      <div className="grid gap-4 lg:h-[calc(100vh-12rem)] lg:grid-cols-[22rem_1fr]">
        <div
          data-tour="chat-list"
          className={cx('flex min-h-0 flex-col gap-2 rounded-lg border border-line bg-surface p-2', active && 'hidden lg:flex')}
        >
          {/* Whole-firm room stays on top */}
          {team && <ul>{row(team)}</ul>}

          <div role="tablist" aria-label="Filter conversations" className="grid gap-1 rounded-md border border-line bg-surface-raised p-1" style={{ gridTemplateColumns: `repeat(${filters.length}, minmax(0, 1fr))` }}>
            {filters.map((f) => (
              <button
                key={f.key}
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={cx(
                  'relative flex h-10 items-center justify-center gap-1 rounded-sm text-label font-semibold transition-colors',
                  filter === f.key ? 'bg-accent text-accent-ink' : 'text-ink-muted hover:text-ink',
                )}
              >
                {f.label}
                <span className="tabular text-caption opacity-80">{count(f.key)}</span>
                {unreadIn(f.key) > 0 && filter !== f.key && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent" aria-label="Unread" />}
              </button>
            ))}
          </div>

          <label className="relative block">
            <span className="sr-only">Search {filter}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" strokeWidth={1.75} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${filter}`}
              className="h-10 w-full rounded-md border border-line bg-surface-raised pl-9 pr-3 text-label outline-none focus:border-accent focus:ring-2 focus:ring-accent/40"
            />
          </label>

          <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {chat.status !== 'ready' && convs.length === 0 && <li className="p-3 text-label text-ink-muted">Connecting…</li>}
            {chat.status === 'ready' && shown.length === 0 && (
              <li className="p-3 text-label text-ink-muted">
                {q ? 'No matches.' : filter === 'clients' ? 'Add clients on the Clients page.' : filter === 'staff' ? 'No office staff yet.' : 'No other lawyers yet.'}
              </li>
            )}
            {filter === 'lawyers' ? (
              <>
                {seniors.length > 0 && <li className="px-2 pt-1 text-caption font-semibold uppercase tracking-wider text-ink-muted">Senior lawyers</li>}
                {seniors.map(row)}
                {juniors.length > 0 && <li className="px-2 pt-2 text-caption font-semibold uppercase tracking-wider text-ink-muted">Junior lawyers</li>}
                {juniors.map(row)}
              </>
            ) : (
              shown.map(row)
            )}
          </ul>
        </div>

        {active ? (
          <div className="flex min-h-[70vh] flex-col gap-2 lg:min-h-0">
            <div className="flex items-center gap-2">
              <button onClick={() => setSelected(null)} aria-label="Back to conversations" className="flex size-10 items-center justify-center rounded-md hover:bg-surface lg:hidden">
                <ArrowLeft className="size-5" strokeWidth={1.75} />
              </button>
              <div className="min-w-0">
                <p className="truncate text-h2">{active.title}</p>
                <p className="text-caption text-ink-muted">
                  {active.sub}
                  {active.admin && ' · Firm admin'}
                </p>
              </div>
            </div>
            <ChatPanel
              key={active.key}
              kind={active.kind}
              channelId={active.id}
              names={names}
              className="flex-1"
              placeholder={active.kind === 'group' ? 'Message your firm' : `Message ${active.title}`}
              emptyText={
                active.group === 'clients'
                  ? 'Messages appear here once the client opens their CourtCall link.'
                  : active.kind === 'group'
                    ? 'Say hello to your team.'
                    : `Start a private conversation with ${active.title}.`
              }
            />
          </div>
        ) : (
          <div className="hidden items-center justify-center rounded-lg border border-dashed border-line text-label text-ink-muted lg:flex">
            Choose a conversation
          </div>
        )}
      </div>
    </>
  )
}
