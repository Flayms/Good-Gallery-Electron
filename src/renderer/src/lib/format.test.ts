import { describe, expect, it } from 'vitest'
import { formatBytes, formatDateTime, formatDuration } from './format'

describe('REQ-006-09: formatDuration', () => {
  it.each([
    [0, '0:00'],
    [9.6, '0:10'],
    [75, '1:15'],
    [3600, '1:00:00'],
    [3725, '1:02:05'],
  ])('%s s → %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected)
  })
})

describe('REQ-006-05: formatBytes', () => {
  it.each([
    [0, '0 B'],
    [1023, '1023 B'],
    [1536, '1.5 KB'],
    [5 * 1024 ** 3, '5.0 GB'],
    [3 * 1024 ** 5, '3072.0 TB'],
  ])('%s → %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected)
  })
})

describe('REQ-013-13: formatDateTime', () => {
  const date = new Date(2025, 6, 2, 7, 12, 45).getTime()

  it.each([
    ['en-GB', '2 Jul 2025, 07:12'],
    ['en-US', 'Jul 2, 2025, 7:12 AM'],
    ['de-DE', '02.07.2025, 07:12'],
  ])('uses the medium date and short time of %s', (locale, expected) => {
    // Some ICU versions put a narrow no-break space before AM / PM.
    expect(formatDateTime(date, locale).replace(/\s/g, ' ')).toBe(expected)
  })
})
