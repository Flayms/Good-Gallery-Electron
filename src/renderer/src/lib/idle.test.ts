import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { controlsHidden, IdleTimer } from './idle'

describe('REQ-013-10: IdleTimer', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('turns idle after the delay without activity, and active again on the next activity', () => {
    const changes: boolean[] = []
    const timer = new IdleTimer(2500, (idle) => changes.push(idle))
    timer.poke()
    vi.advanceTimersByTime(2499)
    expect(changes).toEqual([])
    vi.advanceTimersByTime(1)
    expect(changes).toEqual([true])
    timer.poke()
    expect(changes).toEqual([true, false])
  })

  it('starts the delay over on every activity', () => {
    const changes: boolean[] = []
    const timer = new IdleTimer(2500, (idle) => changes.push(idle))
    timer.poke()
    vi.advanceTimersByTime(2000)
    timer.poke()
    vi.advanceTimersByTime(2000)
    expect(changes).toEqual([])
    timer.stop()
    vi.advanceTimersByTime(5000)
    expect(changes).toEqual([])
  })
})

describe('REQ-013-10: controlsHidden', () => {
  const idle = { idle: true, hovering: false, infoOpen: false, videoPaused: false }

  it('hides the controls only while idle', () => {
    expect(controlsHidden(idle)).toBe(true)
    expect(controlsHidden({ ...idle, idle: false })).toBe(false)
  })

  it('keeps them while hovered, with the info panel open or a paused video', () => {
    expect(controlsHidden({ ...idle, hovering: true })).toBe(false)
    expect(controlsHidden({ ...idle, infoOpen: true })).toBe(false)
    expect(controlsHidden({ ...idle, videoPaused: true })).toBe(false)
  })
})
