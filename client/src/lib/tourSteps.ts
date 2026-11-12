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

/** First case / client link on the current page (Cases or Clients). */
const firstCase = () => document.querySelector('main a[href^="/cases/"]')?.getAttribute('href') ?? null
const firstClient = () => document.querySelector('main a[href^="/clients/"]')?.getAttribute('href') ?? null

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
  hearings: {
    id: 'hearings-to-update',
    target: 'hearings-to-update',
    route: '/',
    optional: true,
    title: 'Hearings to update',
    body: 'After a hearing is over, it waits here for you. Tap Update: choose the next date (or that the case ended), write what happened, and note what to prepare. The client sees the next date and, if you allow it, what happened.',
  },
  caseDetails: {
    id: 'case-details',
    target: 'case-details',
    route: firstCase,
    optional: true,
    title: 'Everything about a case',
    body: 'Tap any case to open it: case number, court, next date and item, the junior in court, the client link and who looks after the client.',
  },
  caseHearings: {
    id: 'case-hearings',
    target: 'case-hearings',
    optional: true,
    title: 'Hearing history',
    body: 'Every hearing with what happened (marked if the client can see it) and the firm-only notes on what to prepare. Edit notes with the pencil.',
  },
  calendar: {
    id: 'calendar',
    target: 'calendar-grid',
    route: '/calendar',
    title: 'Calendar',
    body: 'Every hearing in one month view. Maroon dots are upcoming, taupe are held, amber still need an update. Tap a day to list its hearings, tap a hearing to open the case.',
  },
  settings: {
    id: 'settings',
    target: 'nav-settings',
    title: 'Settings',
    body: 'Switch between light and dark mode, restart this tour, or sign out.',
  },
} satisfies Record<string, TourStep>

export function tourStepsFor(role: Role, firstName: string, isFirmAdmin = false): TourStep[] {
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
      shared.calendar,
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
          body: 'Change anyone’s role, make another senior lawyer a firm admin, or deactivate someone who has left the firm.',
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

  const clientDetail: TourStep = {
    id: 'client-detail',
    target: 'client-detail-cases',
    route: firstClient,
    optional: true,
    title: 'One client, all their cases',
    body: 'Tap a client to see their phone, alert language, who looks after them, and every case (active and closed) with its latest note.',
  }

  if (role === 'staff') {
    return [
      welcome(firstName),
      {
        ...shared.today,
        body: 'Every courtroom where your firm has a case today, with live progress. You watch courtrooms read-only; juniors report from inside.',
      },
      { ...shared.roomCard, body: 'The latest reported item in this courtroom, and how far away each of the firm’s cases is.' },
      shared.hearings,
      {
        id: 'cases',
        target: 'add-case',
        route: '/cases',
        title: 'Keep the cause list updated',
        body: 'Add each case: client, case number, court complex, court number and next hearing date. Add the item number when the cause list is out, and assign the junior who will be in court.',
      },
      {
        id: 'client-link',
        target: 'client-link',
        route: '/cases',
        optional: true,
        title: 'Share the case with your client',
        body: 'This button makes a private link for the client (the case needs its case number first). Choose who looks after the client, then share it on WhatsApp: they see live progress, the next date and can chat with you. No app, no password. It locks to the first phone that opens it.',
      },
      shared.caseDetails,
      shared.caseHearings,
      {
        id: 'clients',
        target: 'add-client',
        route: '/clients',
        title: 'Clients',
        body: 'Add clients with their WhatsApp number and alert language. You see the clients assigned to you (firm admins see all).',
      },
      clientDetail,
      shared.calendar,
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
    shared.hearings,
    shared.join,
    {
      id: 'cases',
      target: 'add-case',
      route: '/cases',
      title: 'Cases',
      body: 'Add each case: client, case number, court complex, court number and next hearing date. Add the item number when the cause list is out, and assign the junior who will be in court.',
    },
    {
      id: 'client-link',
      target: 'client-link',
      route: '/cases',
      optional: true,
      title: 'Share the case with your client',
      body: 'This button makes a private link for the client (the case needs its case number first). Choose who looks after the client, then share it on WhatsApp: they see live progress, the next date and can chat with you. No app, no password. It locks to the first phone that opens it.',
    },
    shared.caseDetails,
    shared.caseHearings,
    {
      id: 'clients',
      target: 'add-client',
      route: '/clients',
      title: 'Clients',
      body: 'Add clients with their WhatsApp number and alert language. You see the clients assigned to you (firm admins see all).',
    },
    clientDetail,
    shared.calendar,
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


type ClientLang = 'en' | 'hi' | 'gu'
type T2 = [title: string, body: string]
type TourText = { welcome: (n: string) => T2 } & Record<'progress' | 'updates' | 'alerts' | 'chat' | 'cases' | 'history' | 'menu' | 'finish', T2>
const CLIENT_TOUR: Record<ClientLang, TourText> = {
  en: {
    welcome: (n) => [`Namaste ${n}, welcome to CourtCall`, 'This page shows how far the court has reached with your case, live. Here is a quick look around. Tap End tour anytime.'],
    progress: ['Your case, live', '"Now" is the item the court is hearing. "Your item" is your number on today\'s list. It shows how many cases are before yours and when it was last reported. CourtCall never guesses a time.'],
    updates: ['Latest updates', 'Everything reported in your courtroom today, and every alert you were sent.'],
    alerts: ['Alerts on this phone', 'Tap Turn on to get a notification when the court is 10, 5 and 2 cases away, and when your case is heard, passed over or adjourned.'],
    chat: ['Chat with your lawyer', 'Message your firm privately. Type, or tap the microphone and speak. Your lawyer sees it in CourtCall straight away.'],
    cases: ['All your cases', 'Your other cases with this firm, upcoming and past. Tap one to see its progress and history.'],
    history: ['History', 'What happened on earlier court days for this case: when it was heard, adjourned or passed over.'],
    menu: ['Settings', 'Switch between English, Hindi and Gujarati (your alerts change too), choose light or dark, replay this tour, or sign out of this phone. On a phone, Settings is the gear at the top.'],
    finish: ["You're all set", 'Keep this page open on court days, or turn on alerts and put your phone away. We will let you know.'],
  },
  hi: {
    welcome: (n) => [`नमस्ते ${n}, CourtCall में आपका स्वागत है`, 'यह पेज लाइव दिखाता है कि कोर्ट आपके केस तक कितना पहुँची। चलिए जल्दी से देखते हैं। कभी भी टूर बंद कर सकते हैं।'],
    progress: ['आपका केस, लाइव', '"अभी" वह आइटम है जिसकी सुनवाई चल रही है। "आपका आइटम" आज की सूची में आपका नंबर है। आपसे पहले कितने केस हैं और आखिरी अपडेट कब आया, यह भी दिखता है। CourtCall कभी समय का अंदाज़ा नहीं लगाता।'],
    updates: ['ताज़ा अपडेट', 'आज आपके कोर्टरूम में जो भी बताया गया, और आपको भेजे गए सभी अलर्ट।'],
    alerts: ['इस फ़ोन पर अलर्ट', '"चालू करें" दबाएँ: जब आपका केस 10, 5 और 2 केस दूर हो, और जब सुनवाई हो, पास ओवर हो या स्थगित हो, तब सूचना मिलेगी।'],
    chat: ['अपने वकील से चैट', 'अपनी फ़र्म को निजी संदेश भेजें। लिखें, या माइक दबाकर बोलें। वकील इसे तुरंत CourtCall में देखते हैं।'],
    cases: ['आपके सभी केस', 'इस फ़र्म के साथ आपके दूसरे केस, आगामी और पिछले। प्रगति और इतिहास देखने के लिए किसी पर टैप करें।'],
    history: ['इतिहास', 'इस केस की पिछली तारीखों पर क्या हुआ: कब सुनवाई हुई, स्थगित हुआ या पास ओवर हुआ।'],
    menu: ['सेटिंग', 'English, हिन्दी और ગુજરાતી में बदलें (आपके अलर्ट की भाषा भी बदलेगी), लाइट या डार्क चुनें, टूर दोबारा देखें, या इस फ़ोन से साइन आउट करें। फ़ोन पर सेटिंग ऊपर गियर में है।'],
    finish: ['सब तैयार है', 'सुनवाई के दिन यह पेज खुला रखें, या अलर्ट चालू करके फ़ोन रख दें। हम आपको बता देंगे।'],
  },
  gu: {
    welcome: (n) => [`નમસ્તે ${n}, CourtCallમાં તમારું સ્વાગત છે`, 'આ પેજ લાઇવ બતાવે છે કે કોર્ટ તમારા કેસ સુધી કેટલી પહોંચી. ચાલો ઝડપથી જોઈએ. ગમે ત્યારે ટૂર બંધ કરી શકો છો.'],
    progress: ['તમારો કેસ, લાઇવ', '"હમણાં" એ આઇટમ છે જેની સુનાવણી ચાલે છે. "તમારી આઇટમ" આજની યાદીમાં તમારો નંબર છે. તમારા પહેલાં કેટલા કેસ છે અને છેલ્લો અપડેટ ક્યારે આવ્યો તે પણ દેખાય છે. CourtCall ક્યારેય સમયનો અંદાજ લગાવતું નથી.'],
    updates: ['તાજા અપડેટ', 'આજે તમારા કોર્ટરૂમમાં જે જણાવાયું તે બધું, અને તમને મોકલેલા બધા અલર્ટ.'],
    alerts: ['આ ફોન પર અલર્ટ', '"ચાલુ કરો" દબાવો: જ્યારે તમારો કેસ 10, 5 અને 2 કેસ દૂર હોય, અને જ્યારે સુનાવણી થાય, પાસ ઓવર થાય કે મુલતવી રહે ત્યારે સૂચના મળશે.'],
    chat: ['તમારા વકીલ સાથે ચેટ', 'તમારી ફર્મને ખાનગી સંદેશ મોકલો. લખો, અથવા માઇક દબાવીને બોલો. વકીલ તેને તરત CourtCallમાં જુએ છે.'],
    cases: ['તમારા બધા કેસ', 'આ ફર્મ સાથેના તમારા બીજા કેસ, આગામી અને પાછલા. પ્રગતિ અને ઇતિહાસ જોવા કોઈ પર ટેપ કરો.'],
    history: ['ઇતિહાસ', 'આ કેસની પાછલી તારીખોએ શું થયું: ક્યારે સુનાવણી થઈ, મુલતવી રહ્યો કે પાસ ઓવર થયો.'],
    menu: ['સેટિંગ', 'English, हिन्दी અને ગુજરાતીમાં બદલો (તમારા અલર્ટની ભાષા પણ બદલાશે), લાઇટ કે ડાર્ક પસંદ કરો, ટૂર ફરી જુઓ, અથવા આ ફોનમાંથી સાઇન આઉટ કરો. ફોન પર સેટિંગ ઉપર ગિયરમાં છે.'],
    finish: ['બધું તૈયાર છે', 'સુનાવણીના દિવસે આ પેજ ખુલ્લું રાખો, અથવા અલર્ટ ચાલુ કરીને ફોન મૂકી દો. અમે તમને જણાવીશું.'],
  },
}

/** Tour for a client opening their case page (no account; opened from a WhatsApp link). */
export function clientTourSteps(firstName: string, kind: 'client', lang: ClientLang = 'en'): TourStep[] {
  const T = CLIENT_TOUR[lang]
  // Each section is its own tab (/case, /case/cases, /case/history, /case/chat, /case/settings).
  const step = (id: string, [title, body]: T2, target?: string, route?: string, optional?: boolean): TourStep => ({ id: `client-${id}`, title, body, target, route, optional })
  const steps: TourStep[] = [
    step('welcome', T.welcome(firstName), undefined, '/case'),
    step('progress', T.progress, 'client-progress', '/case'),
    step('updates', T.updates, 'client-updates', '/case', true),
  ]
  if (kind === 'client') steps.push(step('cases', T.cases, 'client-cases', '/case/cases', true))
  steps.push(step('history', T.history, 'client-history', '/case/history', true))
  if (kind === 'client') steps.push(step('chat', T.chat, 'client-chat', '/case/chat', true))
  steps.push(
    step('alerts', T.alerts, 'client-alerts', '/case/settings', true),
    step('menu', T.menu, 'client-language', '/case/settings'),
    step('finish', T.finish, undefined, '/case'),
  )
  return steps
}
