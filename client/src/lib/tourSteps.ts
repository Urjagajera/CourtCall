import type { Role } from './api'

/**
 * One stop of the guided tour.
 * - target: value of a `data-tour="..."` attribute to spotlight. Omit for a centered card.
 * - route: page to open first. A function resolves it from the current page (e.g. "the first courtroom").
 * - optional: if the target isn't on screen (e.g. no courtroom today), the step is skipped.
 */
export interface TourStep {
  id: string
  title: string
  body: string
  target?: string
  route?: string | (() => string | null)
  optional?: boolean
}

/** The first courtroom card on Today links to its room. */
const firstRoom = () => document.querySelector('[data-tour="room-card"]')?.getAttribute('href') ?? null

const welcome = (name: string): TourStep => ({
  id: 'welcome',
  title: `Welcome to CourtCall, ${name}`,
  body: 'Take a quick tour of where everything is. Use Next and Back to move, or End tour at any time. You can restart it later from Settings.',
})

const finish: TourStep = {
  id: 'finish',
  title: "You're all set",
  body: 'That is everything you need for a court day. Restart this tour any time from Settings → Take the tour again.',
}

const shared = {
  today: {
    id: 'nav-today',
    target: 'nav-today',
    route: '/',
    title: 'Today',
    body: 'Your court day at a glance: every courtroom where your office has a case today, with live progress.',
  },
  roomCard: {
    id: 'room-card',
    target: 'room-card',
    route: '/',
    optional: true,
    title: 'Live courtroom card',
    body: 'The big number is the latest reported item in this courtroom. Below it are your office’s cases there and how far away each one is (for example "3 away"). Stale or break status shows on the badge.',
  },
  join: {
    id: 'join',
    target: 'join-courtroom',
    route: '/',
    title: 'Join any courtroom',
    body: 'Covering a different courtroom today? Join it here. Courtroom progress is shared with verified lawyers and juniors from every office in that room.',
  },
  chat: {
    id: 'nav-chat',
    target: 'nav-chat',
    route: '/chats',
    title: 'Chat',
    body: 'Private conversations powered by Nexconn: your office team room, and for senior lawyers, a private chat with every client.',
  },
  live: {
    id: 'live-dot',
    target: 'live-dot',
    title: 'Live connection',
    body: 'Green means you are connected and updates arrive instantly. Amber means reconnecting; red means chat is offline (courtroom updates still work).',
  },
  settings: {
    id: 'settings',
    target: 'nav-settings',
    title: 'Settings',
    body: 'Switch between light and dark mode, restart this tour, or sign out.',
  },
} satisfies Record<string, TourStep>

export function tourStepsFor(role: Role, firstName: string, isFirmAdmin = false): TourStep[] {
  if (role === 'admin') {
    return [
      welcome(firstName),
      {
        id: 'verify-tabs',
        target: 'verify-tabs',
        route: '/admin',
        title: 'Verification queue',
        body: 'This page belongs to the CourtCall team, not a law firm. New senior lawyers wait here until their Bar Council number is checked. Switch between pending, verified and rejected.',
      },
      {
        id: 'verify-list',
        target: 'verify-list',
        route: '/admin',
        optional: true,
        title: 'Check and approve',
        body: 'Compare the Bar Council enrolment number before tapping Verify. Only verified lawyers can use courtrooms and add clients.',
      },
      shared.settings,
      finish,
    ]
  }

  if (role === 'junior') {
    return [
      welcome(firstName),
      shared.today,
      shared.roomCard,
      {
        id: 'room-progress',
        target: 'room-progress',
        route: firstRoom,
        optional: true,
        title: 'Inside a courtroom',
        body: 'This is the shared progress for the whole courtroom. "Updated 2 min ago" tells everyone how fresh it is; after 20 minutes without updates it is marked stale.',
      },
      {
        id: 'room-stepper',
        target: 'room-report',
        optional: true,
        title: 'Report in one tap',
        body: 'The button is already set to the next item. Use −1 / +1 or type a number, then tap Now hearing. Every update can be undone for 10 seconds.',
      },
      {
        id: 'room-events',
        target: 'room-events',
        optional: true,
        title: 'Other courtroom events',
        body: 'Passed over and Adjourned apply to the item being heard. Recalled lets you pick a passed-over item. Break, Not sitting and Court risen describe the whole courtroom.',
      },
      {
        id: 'room-chat',
        target: 'room-chat',
        optional: true,
        title: 'Room chat',
        body: 'Talk to everyone in this courtroom, from any office. Every accepted update also appears here automatically.',
      },
      {
        id: 'room-history',
        target: 'room-history',
        optional: true,
        title: 'Update history',
        body: 'Every report, correction and undo is kept with the reporter’s name and time. Nothing is silently overwritten.',
      },
      shared.join,
      shared.chat,
      shared.live,
      shared.settings,
      finish,
    ]
  }

  const team: TourStep[] = isFirmAdmin
    ? [
        {
          id: 'team',
          target: 'invite-code',
          route: '/team',
          title: 'You are a firm admin',
          body: 'Senior lawyers, juniors and office staff join with this invite code. Nobody gets in until a firm admin approves them.',
        },
        {
          id: 'team-members',
          target: 'team-members',
          route: '/team',
          title: 'Manage everyone',
          body: 'Change anyone’s role, make another lawyer or staff member a firm admin, or deactivate someone who has left the firm.',
        },
      ]
    : [
        {
          id: 'team',
          target: 'team-members',
          route: '/team',
          title: 'Your firm',
          body: 'Everyone at your firm and their role. Firm admins approve new people and manage roles.',
        },
      ]

  if (role === 'staff') {
    return [
      welcome(firstName),
      {
        ...shared.today,
        body: 'Every courtroom where your firm has a case today, with live progress. You watch courtrooms read-only; juniors report from inside.',
      },
      { ...shared.roomCard, body: 'The latest reported item in this courtroom, and how far away each of the firm’s cases is.' },
      {
        id: 'cases',
        target: 'add-case',
        route: '/cases',
        title: 'Keep the cause list updated',
        body: 'Add each hearing: client, court complex, court number, date and item number, and assign the junior who will be in court.',
      },
      {
        id: 'client-link',
        target: 'client-link',
        route: '/cases',
        optional: true,
        title: 'Share the case with your client',
        body: 'This button makes a private link for the client. Share it on WhatsApp: they see live progress for their own case and can chat with you. No app, no password. It locks to the first phone that opens it, and you can turn it off or make a new one anytime.',
      },
      {
        id: 'clients',
        target: 'add-client',
        route: '/clients',
        title: 'Clients',
        body: 'Add clients with their WhatsApp number and alert language. They are private to your firm.',
      },
      ...team,
      shared.chat,
      shared.settings,
      finish,
    ]
  }

  // Senior lawyer
  return [
    welcome(firstName),
    shared.today,
    shared.roomCard,
    shared.join,
    {
      id: 'cases',
      target: 'add-case',
      route: '/cases',
      title: 'Cases',
      body: 'Add each hearing from the cause list: client, court complex, court number, date and item number. You can also assign the junior who will be in court.',
    },
    {
      id: 'client-link',
      target: 'client-link',
      route: '/cases',
      optional: true,
      title: 'Share the case with your client',
      body: 'This button makes a private link for the client. Share it on WhatsApp: they see live progress for their own case and can chat with you. No app, no password. It locks to the first phone that opens it, and you can turn it off or make a new one anytime.',
    },
    {
      id: 'clients',
      target: 'add-client',
      route: '/clients',
      title: 'Clients',
      body: 'Your clients are private to your office. Add their WhatsApp number and alert language; their private case link is shared from here.',
    },
    ...team,
    {
      id: 'chat-list',
      target: 'chat-list',
      route: '/chats',
      title: 'Chats',
      body: 'Your office team room and a private chat with each client, powered by Nexconn. Client messages arrive here in real time.',
    },
    shared.live,
    shared.settings,
    finish,
  ]
}

/** Tour for a client opening their case page (no account; opened from a WhatsApp link). */
export function clientTourSteps(firstName: string, kind: 'client' | 'family'): TourStep[] {
  const steps: TourStep[] = [
    {
      id: 'client-welcome',
      title: `Namaste ${firstName}, welcome to CourtCall`,
      body: 'This page shows how far the court has reached with your case, live. Here is a quick look around. Tap End tour anytime.',
    },
    {
      id: 'client-progress',
      target: 'client-progress',
      title: 'Your case, live',
      body: '"Now" is the item the court is hearing. "Your item" is your number on today\'s list. It shows how many cases are before yours and when it was last reported. CourtCall never guesses a time.',
    },
    {
      id: 'client-updates',
      target: 'client-updates',
      optional: true,
      title: 'Latest updates',
      body: 'Everything reported in your courtroom today, and every alert you were sent.',
    },
    {
      id: 'client-alerts',
      target: 'client-alerts',
      optional: true,
      title: 'Alerts on this phone',
      body: 'Tap Turn on to get a notification when the court is 10, 5 and 2 cases away, and when your case is heard, passed over or adjourned.',
    },
  ]
  if (kind === 'client') {
    steps.push(
      {
        id: 'client-chat',
        target: 'client-chat',
        optional: true,
        title: 'Chat with your lawyer',
        body: 'Message your firm privately. Your lawyer sees it in CourtCall straight away.',
      },
      {
        id: 'client-cases',
        target: 'client-cases',
        optional: true,
        title: 'All your cases',
        body: 'Your other cases with this firm, upcoming and past. Tap one to see its progress and history.',
      },
      {
        id: 'client-history',
        target: 'client-history',
        optional: true,
        title: 'History',
        body: 'What happened on earlier court days for this case: when it was heard, adjourned or passed over.',
      },
    )
  }
  steps.push(
    {
      id: 'client-menu',
      target: 'client-menu',
      title: 'Tour and sign out',
      body: 'Replay this tour anytime, or sign out of this phone. To come back after signing out, open the link your lawyer sent on WhatsApp.',
    },
    {
      id: 'client-finish',
      title: "You're all set",
      body: 'Keep this page open on court days, or turn on alerts and put your phone away. We will let you know.',
    },
  )
  return steps
}
