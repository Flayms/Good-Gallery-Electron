// Date groups (spec 016): the gallery split into days, each under a header with the date and the number of items.
import type { DateGroup } from '@shared/date-groups'
import { DEFAULT_SORT, type GallerySearch } from '@/lib/search'

export type { DateGroup }

/** localStorage key of the user's choice (REQ-016-03). */
export const GROUP_BY_DAY_STORAGE_KEY = 'gallery.groupByDay'

const NO_GROUPS: readonly DateGroup[] = []

/** Whether the stored choice groups the gallery; it's grouped until the user turns it off. */
export function isGroupedByDay(stored: string | null): boolean {
  return stored !== 'off'
}

/** Whether the sort order is by a date, so the gallery can be grouped by day (REQ-016-04). */
export function isDateSort(search: Pick<GallerySearch, 'sortBy'>): boolean {
  const sortBy = search.sortBy ?? DEFAULT_SORT
  return sortBy === 'taken' || sortBy === 'modified'
}

/** The groups the gallery shows: none while grouping is off or the sort order isn't by a date. */
export function groupsShown(
  groupByDay: boolean,
  search: Pick<GallerySearch, 'sortBy'>,
  groups: readonly DateGroup[],
): readonly DateGroup[] {
  return groupByDay && isDateSort(search) ? groups : NO_GROUPS
}
