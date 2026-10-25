import { thumbHashToAverageRGBA } from 'thumbhash'
import { parseColor, type Rgba } from '@/lib/color'

/** Upper bounds of the viewer tint in OKLCH, so text on the tinted glass keeps its contrast (REQ-013-04). */
export const AMBIENT_MAX_LIGHTNESS = 0.28
export const AMBIENT_MAX_CHROMA = 0.06
/** Share of the tint in the glass color. */
export const AMBIENT_AMOUNT = 0.3

interface Oklch {
  l: number
  c: number
  /** Hue in degrees. */
  h: number
}

const toLinear = (channel: number) => {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const fromLinear = (c: number) => {
  const clamped = Math.min(1, Math.max(0, c))
  return 255 * (clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055)
}

/** sRGB → OKLCH (Björn Ottosson's OKLab). */
export function oklch({ r, g, b }: Rgba): Oklch {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)]
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 }
}

/** OKLCH → opaque sRGB, clipped to the gamut. */
function srgb({ l: L, c, h }: Oklch): Rgba {
  const A = c * Math.cos((h * Math.PI) / 180)
  const B = c * Math.sin((h * Math.PI) / 180)
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  return {
    r: fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    a: 1,
  }
}

/** A dark, muted version of a photo's color with the same hue. */
export function ambientTint(color: Rgba): Rgba {
  const { l, c, h } = oklch(color)
  return srgb({ l: Math.min(l, AMBIENT_MAX_LIGHTNESS), c: Math.min(c, AMBIENT_MAX_CHROMA), h })
}

/** `glass` with `amount` of `tint` mixed into its color; the opacity stays. Channels are rounded. */
export function tintGlass(glass: Rgba, tint: Rgba, amount = AMBIENT_AMOUNT): Rgba {
  const mix = (base: number, add: number) => Math.round(base * (1 - amount) + add * amount)
  return { r: mix(glass.r, tint.r), g: mix(glass.g, tint.g), b: mix(glass.b, tint.b), a: glass.a }
}

/** Average color of a base64 ThumbHash (as stored in the DB). */
export function thumbhashAverage(base64: string): Rgba {
  const { r, g, b } = thumbHashToAverageRGBA(Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)))
  return { r: r * 255, g: g * 255, b: b * 255, a: 1 }
}

export function cssColor({ r, g, b, a }: Rgba): string {
  return `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)} / ${a})`
}

/**
 * CSS variables that tint both glass levels with a media item's colors (read by `glass-bar` / `glass-panel`). The
 * glass colors come from the tokens in styles.css.
 */
export function ambientGlassStyle(thumbhash: string): Record<`--${string}`, string> {
  const tokens = getComputedStyle(document.documentElement)
  const tint = ambientTint(thumbhashAverage(thumbhash))
  const tinted = (token: string) => cssColor(tintGlass(parseColor(tokens.getPropertyValue(token)), tint))
  return { '--glass-bar-tinted': tinted('--glass-bar'), '--glass-panel-tinted': tinted('--glass-panel') }
}
