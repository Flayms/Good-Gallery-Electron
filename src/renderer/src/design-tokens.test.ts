import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ambientTint, tintGlass } from '@/lib/ambient'
import { composite, contrastRatio, parseColor, type Rgba } from '@/lib/color'

// The tokens in styles.css are the only source of the design values (docs/design.md); this reads them from there.
const css = readFileSync(join(import.meta.dirname, 'styles.css'), 'utf8')
const rootBlock = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
const declarations = new Map(
  [...rootBlock.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value]),
)

function token(name: string): Rgba {
  let value = declarations.get(name)
  for (let depth = 0; value?.startsWith('var(') && depth < 5; depth++) {
    value = declarations.get(value.slice(4, -1).trim())
  }
  if (value === undefined) throw new Error(`Missing token ${name}`)
  return parseColor(value)
}

const WHITE = parseColor('#fff')
const BLACK = parseColor('#000')
/** Photo backgrounds from pure black to pure white, plus saturated colors. */
const BACKDROPS = [
  ...Array.from({ length: 52 }, (_, step) => ({ r: step * 5, g: step * 5, b: step * 5, a: 1 })),
  ...['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff', '#f5c451'].map(parseColor),
]

describe('REQ-013-04: text is legible on every surface', () => {
  const text = ['--foreground', '--muted-foreground']

  it.each(['--background', '--sidebar', '--raised'])('on the solid surface %s', (surface) => {
    for (const name of text) expect(contrastRatio(token(name), token(surface)), name).toBeGreaterThanOrEqual(4.5)
  })

  it.each([WHITE, BLACK])('on the glass panel over any photo', (photo) => {
    const panel = composite(token('--glass-panel'), photo)
    for (const name of text) expect(contrastRatio(token(name), panel), name).toBeGreaterThanOrEqual(4.5)
  })

  it.each([WHITE, BLACK])('on the glass bar, secondary text on a field', (photo) => {
    const bar = composite(token('--glass-bar'), photo)
    const field = composite(token('--field'), bar)
    expect(contrastRatio(token('--foreground'), bar)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(token('--foreground'), field)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(token('--muted-foreground'), field)).toBeGreaterThanOrEqual(4.5)
  })

  it('on primary buttons and for errors', () => {
    expect(contrastRatio(token('--primary-foreground'), token('--primary'))).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(token('--destructive'), token('--background'))).toBeGreaterThanOrEqual(4.5)
  })
})

describe('REQ-013-04, REQ-013-11: text stays legible on glass tinted by any photo', () => {
  it.each(BACKDROPS.map((color) => [color]))('tinted by %o', (photo) => {
    const tint = ambientTint(photo)
    for (const backdrop of [WHITE, BLACK]) {
      const bar = composite(tintGlass(token('--glass-bar'), tint), backdrop)
      const panel = composite(tintGlass(token('--glass-panel'), tint), backdrop)
      expect(contrastRatio(token('--foreground'), bar)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(token('--muted-foreground'), composite(token('--field'), bar))).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(token('--foreground'), panel)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(token('--muted-foreground'), panel)).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('REQ-013-05: the focus ring shows over any background', () => {
  it('reaches 3:1 with its inner or outer ring', () => {
    const inner = token('--ring')
    const outer = token('--ring-outer')
    for (const backdrop of BACKDROPS) {
      const best = Math.max(contrastRatio(inner, backdrop), contrastRatio(composite(outer, backdrop), backdrop))
      expect(best, JSON.stringify(backdrop)).toBeGreaterThanOrEqual(3)
    }
  })
})
