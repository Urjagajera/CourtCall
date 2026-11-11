import { useState, type ChangeEvent } from 'react'
import { ApiError } from './api'

/** Tiny form helper: values, per-field server errors, and a submit wrapper. */
export function useForm<T extends Record<string, string>>(initial: T) {
  const [values, setValues] = useState<T>(initial)
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const field = (name: keyof T) => ({
    name: String(name),
    value: values[name],
    error: errors[name],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValues((v) => ({ ...v, [name]: e.target.value })),
  })

  async function submit(fn: (values: T) => Promise<void>) {
    setSubmitting(true)
    setErrors({})
    setFormError(null)
    try {
      await fn(values)
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.details) {
          const fieldErrors: Partial<Record<keyof T, string>> = {}
          for (const [k, msgs] of Object.entries(e.details)) {
            if (msgs?.[0]) fieldErrors[k as keyof T] = msgs[0]
          }
          setErrors(fieldErrors)
        }
        setFormError(e.details ? 'Please fix the highlighted fields' : e.message)
      } else {
        setFormError('Could not reach the server. Check your connection.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return { values, setValues, field, submit, submitting, formError }
}
