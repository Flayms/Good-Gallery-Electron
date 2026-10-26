import { type Dispatch, type SetStateAction, useEffect, useState } from 'react'
import { GROUP_BY_DAY_STORAGE_KEY, isGroupedByDay } from '@/lib/date-groups'

/** Whether the gallery is grouped by day, persisted across sessions (REQ-016-03). */
export function useGroupByDay(): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [grouped, setGrouped] = useState(() => isGroupedByDay(localStorage.getItem(GROUP_BY_DAY_STORAGE_KEY)))
  useEffect(() => localStorage.setItem(GROUP_BY_DAY_STORAGE_KEY, grouped ? 'on' : 'off'), [grouped])
  return [grouped, setGrouped]
}
