import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ---------- enums ----------

// admin = CourtCall platform team (verifies firm founders). staff = office clerks / employees of a firm.
export const userRole = pgEnum('user_role', ['lawyer', 'junior', 'admin', 'staff'])
export const verificationStatus = pgEnum('verification_status', ['pending', 'verified', 'rejected'])
export const sessionStatus = pgEnum('session_status', ['not_started', 'hearing', 'break', 'risen', 'not_sitting'])
export const eventType = pgEnum('event_type', [
  'now_hearing',
  'passed_over',
  'recalled',
  'adjourned',
  'break_start',
  'break_end',
  'court_not_sitting',
  'court_risen',
  'correction',
])
export const linkKind = pgEnum('link_kind', ['client', 'family'])

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

// ---------- people & offices ----------

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  role: userRole('role').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  passwordHash: text('password_hash').notNull(),
  verificationStatus: verificationStatus('verification_status').notNull().default('pending'),
  officeId: uuid('office_id').references((): AnyPgColumn => offices.id, { onDelete: 'set null' }),
  // Firm admin: manages people in the firm (approve, roles, deactivate). The founder starts as one.
  isFirmAdmin: boolean('is_firm_admin').notNull().default(false),
  // Set when the user finishes or ends the first-login guided tour.
  tourCompletedAt: timestamp('tour_completed_at', { withTimezone: true }),
  createdAt: createdAt(),
})

export const offices = pgTable('offices', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ownerId: uuid('owner_id')
    .notNull()
    .references((): AnyPgColumn => users.id),
  // Lawyers, juniors and staff join a firm with this code; a firm admin then approves them.
  inviteCode: text('invite_code').notNull().unique(),
  nexconnTeamGroupId: text('nexconn_team_group_id'),
  createdAt: createdAt(),
})

// ---------- courtrooms (shared across offices) ----------

export const courtrooms = pgTable(
  'courtrooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courtComplex: text('court_complex').notNull(),
    roomNo: text('room_no').notNull(),
    createdAt: createdAt(),
  },
  // Case-insensitive: "Gujarat High Court" and "gujarat high court" must be the same shared room.
  (t) => [uniqueIndex('courtroom_complex_room_ci').on(sql`lower(${t.courtComplex})`, t.roomNo)],
)

// One row per courtroom per day: the live, shared progress state.
export const courtSessions = pgTable(
  'court_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courtroomId: uuid('courtroom_id')
      .notNull()
      .references(() => courtrooms.id),
    date: date('date').notNull(),
    // Progress pointer through the cause list (only moves via "now hearing").
    currentItem: integer('current_item'),
    // Item actually before the judge right now; differs from currentItem when a passed-over item is recalled.
    hearingItem: integer('hearing_item'),
    status: sessionStatus('status').notNull().default('not_started'),
    // Incremented on every accepted event; reporters send the version they last saw.
    version: integer('version').notNull().default(0),
    lastEventAt: timestamp('last_event_at', { withTimezone: true }),
    nexconnGroupId: text('nexconn_group_id'),
    createdAt: createdAt(),
  },
  (t) => [unique('session_courtroom_date').on(t.courtroomId, t.date)],
)

export const courtSessionMembers = pgTable(
  'court_session_members',
  {
    sessionId: uuid('session_id')
      .notNull()
      .references(() => courtSessions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    joinedAt: createdAt(),
    lastReportedAt: timestamp('last_reported_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.userId] })],
)

// Append-only history. Corrections are new rows pointing at the event they correct.
export const courtEvents = pgTable(
  'court_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => courtSessions.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    type: eventType('type').notNull(),
    item: integer('item'),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id),
    officeId: uuid('office_id').references(() => offices.id),
    singleReporter: boolean('single_reporter').notNull().default(false),
    confirmed: boolean('confirmed').notNull().default(false),
    correctsEventId: uuid('corrects_event_id').references((): AnyPgColumn => courtEvents.id),
    note: text('note'),
    // Session state just before this event, so an undo can restore it exactly.
    prevCurrentItem: integer('prev_current_item'),
    prevHearingItem: integer('prev_hearing_item'),
    prevStatus: sessionStatus('prev_status').notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique('event_session_version').on(t.sessionId, t.version)],
)

// ---------- office-private data ----------

export const clients = pgTable(
  'clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    officeId: uuid('office_id')
      .notNull()
      .references(() => offices.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    phone: text('phone'),
    language: text('language').notNull().default('en'),
    createdAt: createdAt(),
  },
  (t) => [index('clients_office_idx').on(t.officeId)],
)

// Who looks after a client. Firm admins see every client; other lawyers and staff only see clients
// assigned to them (set when a client link is shared, or by a firm admin on the Clients page).
export const clientAssignments = pgTable(
  'client_assignments',
  {
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.clientId, t.userId] })],
)

export const caseStatus = pgEnum('case_status', ['active', 'closed'])
export const hearingOutcome = pgEnum('hearing_outcome', ['next_date', 'closed'])

export const cases = pgTable(
  'cases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    officeId: uuid('office_id')
      .notNull()
      .references(() => offices.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    caseNo: text('case_no'),
    courtroomId: uuid('courtroom_id')
      .notNull()
      .references(() => courtrooms.id),
    /** The next (or latest) hearing. After a hearing the firm records the outcome and moves this on. */
    hearingDate: date('hearing_date').notNull(),
    /** Null until the cause list for that date is out. */
    itemNo: integer('item_no'),
    /** closed = disposed / finished: no more hearings, no reminders. */
    status: caseStatus('status').notNull().default('active'),
    assignedJuniorId: uuid('assigned_junior_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    index('cases_office_idx').on(t.officeId),
    index('cases_courtroom_date_idx').on(t.courtroomId, t.hearingDate),
  ],
)

// ---------- client access ----------

export const accessLinks = pgTable('access_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: uuid('case_id')
    .notNull()
    .references(() => cases.id, { onDelete: 'cascade' }),
  kind: linkKind('kind').notNull().default('client'),
  label: text('label'),
  // Only a SHA-256 hash of the token is stored; the raw token lives only in the shared URL.
  tokenHash: text('token_hash').notNull().unique(),
  deviceIdHash: text('device_id_hash'),
  activatedAt: timestamp('activated_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  // Lawyer or staff member who shared the link: the client's default chat contact.
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
})

export const alertLogs = pgTable(
  'alert_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => courtSessions.id, { onDelete: 'cascade' }),
    eventVersion: integer('event_version').notNull(),
    // e.g. "first", "within_10", "within_5", "within_2", "now_hearing", "passed_over:v12"
    alertKey: text('alert_key').notNull(),
    message: text('message').notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique('alert_once').on(t.caseId, t.sessionId, t.alertKey)],
)

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  accessLinkId: uuid('access_link_id').references(() => accessLinks.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  keys: jsonb('keys').$type<{ p256dh: string; auth: string }>().notNull(),
  createdAt: createdAt(),
})

export type User = typeof users.$inferSelect
export type CourtSession = typeof courtSessions.$inferSelect
export type CourtEvent = typeof courtEvents.$inferSelect
export type Office = typeof offices.$inferSelect

// One row per hearing that has happened, written when the firm records its outcome.
export const caseHearings = pgTable(
  'case_hearings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    courtroomId: uuid('courtroom_id')
      .notNull()
      .references(() => courtrooms.id),
    itemNo: integer('item_no'),
    outcome: hearingOutcome('outcome').notNull(),
    /** Set when outcome = next_date. */
    nextDate: date('next_date'),
    /** What happened in court. Shown to the client only when shareWithClient is true. */
    summary: text('summary'),
    shareWithClient: boolean('share_with_client').notNull().default(false),
    /** What to prepare / track for the next hearing. Firm only, never shown to the client. */
    prepNotes: text('prep_notes'),
    recordedBy: uuid('recorded_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('case_hearings_case_date_uq').on(t.caseId, t.date)],
)
