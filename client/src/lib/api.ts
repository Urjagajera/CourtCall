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

export type Role = 'lawyer' | 'junior' | 'admin'
export type Verification = 'pending' | 'verified' | 'rejected'

export interface User {
  id: string
  role: Role
  name: string
  email: string
  phone: string | null
  barCouncilNo: string | null
  verificationStatus: Verification
  officeId: string | null
  createdAt: string
}

export interface Office {
  id: string
  name: string
  inviteCode?: string
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
  itemNo: number
  assignedJuniorId: string | null
}
