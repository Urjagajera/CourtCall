import { Landmark } from 'lucide-react'

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={
          size === 'lg'
            ? 'flex size-11 items-center justify-center rounded-md bg-accent text-accent-ink'
            : 'flex size-9 items-center justify-center rounded-md bg-accent text-accent-ink'
        }
      >
        <Landmark className={size === 'lg' ? 'size-6' : 'size-5'} strokeWidth={1.75} />
      </span>
      <span className={size === 'lg' ? 'text-h1 text-ink' : 'text-h2 font-bold text-ink'}>CourtCall</span>
    </div>
  )
}
