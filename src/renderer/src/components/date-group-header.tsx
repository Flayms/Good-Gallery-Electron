import type { DateGroup } from '@/lib/date-groups'
import { formatDay, formatGroupCount } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Height of a group header in the gallery, including the space above it. */
export const DATE_GROUP_HEADER_HEIGHT = 40

/** The day and the number of media items above a date group (REQ-016-02). */
export function DateGroupHeader({ group, className }: { group: DateGroup; className?: string }) {
  return (
    <h2 className={cn('flex h-full items-end gap-2 pb-2 text-sm', className)}>
      <span className="truncate font-semibold">{formatDay(group.day)}</span>
      <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
        {formatGroupCount(group.photos, group.videos)}
      </span>
    </h2>
  )
}
