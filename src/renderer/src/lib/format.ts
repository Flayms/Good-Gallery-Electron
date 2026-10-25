/** `m:ss`, or `h:mm:ss` from one hour on. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = String(total % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${minutes}:${secs}`
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

/** Binary units with one decimal from KB on, e.g. `1.5 MB`. */
export function formatBytes(bytes: number): string {
  let value = Math.max(0, bytes)
  let unit = 0
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024
    unit++
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${BYTE_UNITS[unit]}`
}

const dateTimeFormats = new Map<string | undefined, Intl.DateTimeFormat>()

/** Medium date and short time in the user's locale, without seconds, e.g. `2 Jul 2025, 07:12`. */
export function formatDateTime(epochMs: number, locale?: string): string {
  let format = dateTimeFormats.get(locale)
  if (!format) {
    format = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })
    dateTimeFormats.set(locale, format)
  }
  return format.format(epochMs)
}
