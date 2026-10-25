import { useEffect, useState } from 'react'
import { IdleTimer } from '@/lib/idle'

const ACTIVITY = ['pointermove', 'pointerdown', 'wheel', 'keydown'] as const

/** True once the user hasn't moved the pointer or pressed a key for `delayMs`. */
export function useIdle(delayMs: number): boolean {
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    const timer = new IdleTimer(delayMs, setIdle)
    const poke = () => timer.poke()
    poke()
    for (const type of ACTIVITY) window.addEventListener(type, poke, { passive: true })
    return () => {
      timer.stop()
      for (const type of ACTIVITY) window.removeEventListener(type, poke)
    }
  }, [delayMs])
  return idle
}
