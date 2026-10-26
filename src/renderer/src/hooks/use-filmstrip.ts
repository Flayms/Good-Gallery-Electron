import { type Dispatch, type SetStateAction, useEffect, useState } from 'react'
import { FILMSTRIP_STORAGE_KEY, isFilmstripShown } from '@/lib/filmstrip'

/** Whether the viewer shows the filmstrip, persisted across sessions (REQ-015-02). */
export function useFilmstrip(): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [shown, setShown] = useState(() => isFilmstripShown(localStorage.getItem(FILMSTRIP_STORAGE_KEY)))
  useEffect(() => localStorage.setItem(FILMSTRIP_STORAGE_KEY, shown ? 'shown' : 'hidden'), [shown])
  return [shown, setShown]
}
