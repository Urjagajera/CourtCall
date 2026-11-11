import { Loader2, TriangleAlert } from 'lucide-react'
import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

// ---------- Button ----------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-strong font-semibold',
  secondary: 'bg-surface-raised text-ink border border-line hover:bg-surface',
  ghost: 'bg-transparent text-ink hover:bg-surface-raised',
  danger: 'bg-stopped-bg text-stopped-fg hover:brightness-95 font-medium',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'md' | 'lg' | 'sm'
  loading?: boolean
  icon?: ReactNode
}

export function Button({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
        size === 'lg' ? 'h-14 px-5 text-body' : size === 'sm' ? 'h-9 px-3 text-label' : 'h-12 px-4 text-body',
        variants[variant],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="size-5 animate-spin" strokeWidth={1.75} /> : icon}
      {children}
    </button>
  )
}

// ---------- Card ----------

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement> & { 'data-tour'?: string }) {
  return (
    <div className={cx('rounded-lg border border-line bg-surface p-4 shadow-card', className)} {...rest}>
      {children}
    </div>
  )
}

// ---------- Form fields ----------

interface FieldProps {
  label: string
  error?: string
  hint?: string
}

const fieldClass =
  'h-12 w-full rounded-sm border border-line bg-surface-raised px-3 text-body text-ink placeholder:text-ink-muted/70 outline-none focus:border-accent focus:ring-2 focus:ring-accent/40'

function FieldShell({ id, label, error, hint, children }: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-caption text-stopped-fg">
          <TriangleAlert className="size-3.5" strokeWidth={1.75} /> {error}
        </p>
      ) : hint ? (
        <p className="text-caption text-ink-muted">{hint}</p>
      ) : null}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, FieldProps & InputHTMLAttributes<HTMLInputElement>>(
  function Input({ label, error, hint, className, ...rest }, ref) {
    const id = useId()
    return (
      <FieldShell id={id} label={label} error={error} hint={hint}>
        <input ref={ref} id={id} className={cx(fieldClass, error && 'border-stopped-fg', className)} aria-invalid={!!error} {...rest} />
      </FieldShell>
    )
  },
)

export function Select({ label, error, hint, className, children, ...rest }: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <select id={id} className={cx(fieldClass, className)} {...rest}>
        {children}
      </select>
    </FieldShell>
  )
}

// ---------- Badges & banners ----------

export type Tone = 'hearing' | 'waiting' | 'stopped' | 'stale' | 'info'
const tones: Record<Tone, string> = {
  hearing: 'bg-hearing-bg text-hearing-fg',
  waiting: 'bg-waiting-bg text-waiting-fg',
  stopped: 'bg-stopped-bg text-stopped-fg',
  stale: 'bg-stale-bg text-stale-fg',
  info: 'bg-info-bg text-info-fg',
}
const toneBorder: Record<Tone, string> = {
  hearing: 'border-l-hearing-fg',
  waiting: 'border-l-waiting-fg',
  stopped: 'border-l-stopped-fg',
  stale: 'border-l-stale-fg',
  info: 'border-l-info-fg',
}

export function Badge({ tone, icon, children }: { tone: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-caption font-medium', tones[tone])}>
      {icon}
      {children}
    </span>
  )
}

export function Banner({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <div role="status" className={cx('rounded-lg border border-line border-l-4 bg-surface p-3 text-label', toneBorder[tone])}>
      {children}
    </div>
  )
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <div className="text-ink-muted">{icon}</div>
      <p className="text-h2 text-ink">{title}</p>
      {children && <div className="text-label text-ink-muted">{children}</div>}
    </div>
  )
}

export function PageSpinner() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-ink" strokeWidth={1.75} aria-label="Loading" />
    </div>
  )
}

export { cx }
