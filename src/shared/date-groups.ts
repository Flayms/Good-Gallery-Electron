/** A run of consecutive gallery items whose sort date falls on the same local calendar day. */
export interface DateGroup {
  /** Local calendar day, `YYYY-MM-DD`. */
  day: string
  /** Gallery index of the group's first item. */
  start: number
  photos: number
  videos: number
}

function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * Groups items (in gallery order) by the local day of `dateAt`. The day is only worked out again when a date leaves
 * the current day's range, so the cost is about one `Date` per group.
 */
export function dateGroups(
  count: number,
  dateAt: (index: number) => number,
  isVideoAt: (index: number) => boolean,
): DateGroup[] {
  const groups: DateGroup[] = []
  let current: DateGroup | undefined
  let dayStart = 0
  let dayEnd = 0
  for (let index = 0; index < count; index++) {
    const date = dateAt(index)
    if (!current || date < dayStart || date >= dayEnd) {
      const start = new Date(date)
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(end.getDate() + 1)
      dayStart = start.getTime()
      dayEnd = end.getTime()
      const day = dayKey(start)
      if (current?.day !== day) {
        current = { day, start: index, photos: 0, videos: 0 }
        groups.push(current)
      }
    }
    if (isVideoAt(index)) current.videos++
    else current.photos++
  }
  return groups
}
