import { describe, expect, it } from 'vitest'
import { AMBIENT_MAX_CHROMA, AMBIENT_MAX_LIGHTNESS, ambientTint, oklch, tintGlass } from './ambient'
import { parseColor } from './color'

describe('REQ-013-11: ambientTint', () => {
  it.each([
    ['white', { r: 255, g: 255, b: 255, a: 1 }],
    ['yellow', { r: 255, g: 230, b: 0, a: 1 }],
    ['cyan', { r: 0, g: 255, b: 255, a: 1 }],
    ['red', { r: 255, g: 0, b: 0, a: 1 }],
  ])('darkens and desaturates %s', (_, color) => {
    const tint = oklch(ambientTint(color))
    expect(tint.l).toBeLessThanOrEqual(AMBIENT_MAX_LIGHTNESS + 0.01)
    expect(tint.c).toBeLessThanOrEqual(AMBIENT_MAX_CHROMA + 0.005)
  })

  it('keeps the hue of the photo', () => {
    const orange = parseColor('#f97316')
    expect(oklch(ambientTint(orange)).h).toBeCloseTo(oklch(orange).h, 0)
  })

  it('leaves dark muted colors as they are', () => {
    const dark = { r: 30, g: 32, b: 38, a: 1 }
    const tint = ambientTint(dark)
    expect(tint.r).toBeCloseTo(30, 0)
    expect(tint.g).toBeCloseTo(32, 0)
    expect(tint.b).toBeCloseTo(38, 0)
  })
})

describe('tintGlass', () => {
  it('mixes the tint into the glass color and keeps its opacity', () => {
    const glass = parseColor('rgb(28 28 28 / 0.72)')
    expect(tintGlass(glass, { r: 128, g: 28, b: 28, a: 1 }, 0.25)).toEqual({ r: 53, g: 28, b: 28, a: 0.72 })
  })
})
