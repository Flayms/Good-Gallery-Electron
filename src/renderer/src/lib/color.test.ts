import { describe, expect, it } from 'vitest'
import { composite, contrastRatio, parseColor } from './color'

describe('parseColor', () => {
  it('reads hex and rgb notations', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(parseColor('#1F1F1F')).toEqual({ r: 31, g: 31, b: 31, a: 1 })
    expect(parseColor('#00000080').a).toBeCloseTo(0.5, 2)
    expect(parseColor('rgb(28 28 28 / 0.72)')).toEqual({ r: 28, g: 28, b: 28, a: 0.72 })
    expect(parseColor('rgba(0, 0, 0, 0.35)')).toEqual({ r: 0, g: 0, b: 0, a: 0.35 })
    expect(parseColor('rgb(255 255 255 / 10%)').a).toBeCloseTo(0.1)
  })

  it('rejects other notations', () => {
    expect(() => parseColor('oklch(0.5 0 0)')).toThrow()
  })
})

describe('composite and contrastRatio', () => {
  it('blends translucent colors over opaque ones', () => {
    expect(composite(parseColor('rgb(0 0 0 / 0.5)'), parseColor('#fff'))).toEqual({
      r: 127.5,
      g: 127.5,
      b: 127.5,
      a: 1,
    })
  })

  it('matches the WCAG reference values', () => {
    expect(contrastRatio(parseColor('#000'), parseColor('#fff'))).toBeCloseTo(21)
    expect(contrastRatio(parseColor('#777'), parseColor('#fff'))).toBeCloseTo(4.48, 2)
  })
})
