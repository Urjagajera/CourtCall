import type { ErrorRequestHandler } from 'express'
import { z } from 'zod'

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message)
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details)
export const unauthorized = (msg = 'Please sign in') => new HttpError(401, msg)
export const forbidden = (msg = 'You do not have access to this') => new HttpError(403, msg)
export const notFound = (msg = 'Not found') => new HttpError(404, msg)

/** Parse untrusted input with a Zod schema; throws a 400 with field errors on failure. */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw badRequest('Invalid input', z.flattenError(result.error).fieldErrors)
  }
  return result.data
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details })
    return
  }
  // Postgres unique violation
  if (err?.code === '23505') {
    res.status(409).json({ error: 'Already exists' })
    return
  }
  console.error(err)
  res.status(500).json({ error: 'Something went wrong' })
}
