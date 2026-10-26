import { type Dispatch, type SetStateAction, useEffect, useState } from 'react'
import {
  parseTagIndicators,
  serializeTagIndicators,
  TAG_INDICATORS_STORAGE_KEY,
  type TagIndicatorChoice,
} from '@/lib/tag-indicators'

/** Which tag indicators the tiles show, persisted across sessions (REQ-017-03). */
export function useTagIndicators(): [TagIndicatorChoice, Dispatch<SetStateAction<TagIndicatorChoice>>] {
  const [choice, setChoice] = useState(() => parseTagIndicators(localStorage.getItem(TAG_INDICATORS_STORAGE_KEY)))
  useEffect(() => localStorage.setItem(TAG_INDICATORS_STORAGE_KEY, serializeTagIndicators(choice)), [choice])
  return [choice, setChoice]
}
