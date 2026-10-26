import { describe, expect, it } from 'vitest'
import { isFilmstripShown, sidewaysDelta } from './filmstrip'

describe('REQ-015-02: isFilmstripShown', () => {
  it('is shown only once the user has shown it', () => {
    expect(isFilmstripShown('shown')).toBe(true)
    expect(isFilmstripShown('hidden')).toBe(false)
    expect(isFilmstripShown(null)).toBe(false)
  })
})

describe('REQ-015-05: sidewaysDelta', () => {
  it('turns the vertical wheel into sideways scrolling', () => {
    expect(sidewaysDelta({ deltaX: 0, deltaY: 120 })).toBe(120)
    expect(sidewaysDelta({ deltaX: 0, deltaY: -120 })).toBe(-120)
  })

  it('keeps sideways scrolling from a touchpad', () => {
    expect(sidewaysDelta({ deltaX: -40, deltaY: 3 })).toBe(-40)
  })
})
