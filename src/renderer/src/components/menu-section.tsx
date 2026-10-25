import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

/** A labelled group inside a toolbar menu, with its current value and an optional button that clears it. */
export function MenuSection({
  label,
  value,
  onClear,
  clearLabel,
  children,
}: {
  label: string
  value?: string
  onClear?: () => void
  /** Accessible name of the clear button, e.g. "Clear rating". */
  clearLabel?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2" aria-label={label}>
      <div className="flex min-h-6 items-center gap-2">
        <h3 className="font-semibold">{label}</h3>
        {value && <span className="truncate text-muted-foreground">{value}</span>}
        {onClear && (
          <Button variant="ghost" size="xs" className="ml-auto" onClick={onClear} aria-label={clearLabel}>
            Clear
          </Button>
        )}
      </div>
      {children}
    </section>
  )
}
