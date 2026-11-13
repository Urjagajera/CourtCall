export class ApiError extends Error {
  status: number
  details?: Record<string, string[] | undefined>
  /** Full JSON error body (e.g. the latest session state on a 409 conflict). */
  body: Record<string, unknown>

  constructor(status: number, message: string, details?: Record<string, string[] | undefined>, body: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.details = details
    this.body = body
  }
}

export async function api<T = unknown>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: options.method ?? (options.body ? 'POST' : 'GET'),
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: 'include',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Something went wrong', data.details, data)
  return data as T
}

// ---- shared types (mirror server responses) ----

export type Role = 'lawyer' | 'junior' | 'admin' | 'staff'
export type Verification = 'pending' | 'verified' | 'rejected'

export interface User {
  id: string
  role: Role
  name: string
  email: string
  phone: string | null
  verificationStatus: Verification
  officeId: string | null
  isFirmAdmin: boolean
  tourCompletedAt: string | null
  createdAt: string
}

export interface Office {
  id: string
  name: string
  inviteCode?: string
  /** The signed-in user founded this firm. */
  isFounder?: boolean
  ownerId?: string
}

export interface Client {
  id: string
  name: string
  phone: string | null
  language: 'en' | 'hi' | 'gu'
}

export interface Case {
  id: string
  clientId: string
  clientName: string
  title: string
  caseNo: string | null
  courtroomId: string
  courtComplex: string
  roomNo: string
  hearingDate: string
  /** Null until the cause list for that date is out. */
  itemNo: number | null
  status: 'active' | 'closed'
  /** Case team: main lawyer (senior or junior), helping junior (senior-led only), one staff helper. */
  mainLawyerId: string | null
  assignedJuniorId: string | null
  helperStaffId: string | null
  /** Hearing-day briefing: who appears for the client, and a note read to them. */
  appearingLawyerId?: string | null
  rememberNote?: string | null
  /** What the signed-in person may do (from the server). */
  canEdit?: boolean
  canManageTeam?: boolean
  canChangeMainLawyer?: boolean
}

export interface Hearing {
  id: string
  caseId: string
  date: string
  itemNo: number | null
  outcome: 'next_date' | 'closed'
  nextDate: string | null
  summary: string | null
  shareWithClient: boolean
  prepNotes: string | null
  courtComplex: string
  roomNo: string
  recordedByName: string | null
  createdAt: string
}
