import { ArrowLeft, Lock, UserRound, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '../components/AppLayout'
import { ChatPanel } from '../components/ChatPanel'
import { Banner, cx } from '../components/ui'
import type { Client } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useChat, useUnreadCounts } from '../lib/nexconn'
import { useApi } from '../lib/useApi'

type Conv = { key: string; kind: 'group' | 'direct'; id: string; title: string; sub: string; icon: typeof Users }

/** Office team room (lawyer + juniors) and, for lawyers, private chats with each client. */
export default function Chats() {
  const { user } = useAuth()
  const chat = useChat()
  const isLawyer = user!.role === 'lawyer' || user!.role === 'staff' // can chat with clients
  const clients = useApi<{ clients: (Client & { ncId: string })[] }>(isLawyer ? '/clients' : null)
  const [selected, setSelected] = useState<string | null>(null)
  const unread = useUnreadCounts(selected)

  const convs: Conv[] = useMemo(() => {
    const list: Conv[] = []
    if (chat.team) list.push({ key: 'team', kind: 'group', id: chat.team.groupId, title: `${chat.team.name} · Team`, sub: 'Private office room', icon: Users })
    for (const c of clients.data?.clients ?? []) {
      list.push({ key: c.id, kind: 'direct', id: c.ncId, title: c.name, sub: 'Private client chat', icon: UserRound })
    }
    return list
  }, [chat.team, clients.data])

  const names = useMemo(() => {
    const n: Record<string, string> = {}
    for (const m of chat.team?.members ?? []) n[m.ncId] = m.name
    for (const c of clients.data?.clients ?? []) n[c.ncId] = c.name
    return n
  }, [chat.team, clients.data])

  const active = convs.find((c) => c.key === selected) ?? null

  return (
    <>
      <PageHeader title="Chat" subtitle="Private to your office. Powered by Nexconn." />
      {chat.status === 'error' && <Banner tone="stopped">{chat.error}</Banner>}
      <div className="grid gap-4 lg:h-[calc(100vh-12rem)] lg:grid-cols-[20rem_1fr]">
        <ul data-tour="chat-list" className={cx('flex flex-col gap-1 overflow-y-auto rounded-lg border border-line bg-surface p-2', active && 'hidden lg:flex')}>
          {convs.length === 0 && <li className="p-3 text-label text-ink-muted">{chat.status === 'ready' ? 'No conversations yet.' : 'Connecting…'}</li>}
          {convs.map((c) => (
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
                  <span className="block truncate text-label font-semibold">{c.title}</span>
                  <span className="flex items-center gap-1 text-caption opacity-80">
                    <Lock className="size-3" strokeWidth={1.75} /> {c.sub}
                  </span>
                </span>
                {unread[c.id] > 0 && selected !== c.key && (
                  <span className="tabular flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-caption font-bold text-accent-ink">
                    {unread[c.id]}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>

        {active ? (
          <div className="flex min-h-[70vh] flex-col gap-2 lg:min-h-0">
            <div className="flex items-center gap-2">
              <button onClick={() => setSelected(null)} aria-label="Back to conversations" className="flex size-10 items-center justify-center rounded-md hover:bg-surface lg:hidden">
                <ArrowLeft className="size-5" strokeWidth={1.75} />
              </button>
              <p className="text-h2">{active.title}</p>
            </div>
            <ChatPanel
              key={active.key}
              kind={active.kind}
              channelId={active.id}
              names={names}
              className="flex-1"
              placeholder={active.kind === 'direct' ? `Message ${active.title}` : 'Message your team'}
              emptyText={active.kind === 'direct' ? 'Messages appear here once the client opens their CourtCall link.' : 'Say hello to your team.'}
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
