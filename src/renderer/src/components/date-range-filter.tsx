import { useId } from 'react'
import { Input } from '@/components/ui/input'
import type { GallerySearch } from '@/lib/search'

const dayFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

function formatDay(day: string): string {
  return dayFormat.format(new Date(`${day}T00:00`))
}

/** "Any date", one day, a span, or an open start or end. */
export function dateRangeLabel({ from, to }: GallerySearch): string {
  if (from && to) return from === to ? formatDay(from) : `${formatDay(from)} – ${formatDay(to)}`
  if (from) return `From ${formatDay(from)}`
  if (to) return `Until ${formatDay(to)}`
  return 'Any date'
}

/** Start and end day inputs of the date filter; the end can't be before the start. */
export function DateRangeFields({
  search,
  onSearchChange,
}: {
  search: GallerySearch
  onSearchChange: (patch: Partial<GallerySearch>) => void
}) {
  const fromId = useId()
  const toId = useId()
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-2">
      <label htmlFor={fromId} className="text-muted-foreground">
        From
      </label>
      <Input
        id={fromId}
        type="date"
        value={search.from ?? ''}
        max={search.to}
        onChange={(event) => onSearchChange({ from: event.target.value || undefined })}
      />
      <label htmlFor={toId} className="text-muted-foreground">
        To
      </label>
      <Input
        id={toId}
        type="date"
        value={search.to ?? ''}
        min={search.from}
        onChange={(event) => onSearchChange({ to: event.target.value || undefined })}
      />
    </div>
  )
}
