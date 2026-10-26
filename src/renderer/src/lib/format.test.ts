import { describe, expect, it } from 'vitest'
import { formatBytes, formatDateTime, formatDay, formatDuration, formatGroupCount } from './format'

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

describe('REQ-016-02: formatDay', () => {
  it.each([
    ['en-US', 'Monday, October 26, 2026'],
    ['de-DE', 'Montag, 26. Oktober 2026'],
  ])('uses the weekday and full date of %s', (locale, expected) => {
    expect(formatDay('2026-10-26', locale)).toBe(expected)
  })
})

describe('REQ-016-02: formatGroupCount', () => {
  it.each([
    [42, 0, '42 photos'],
    [1, 0, '1 photo'],
    [0, 1, '1 video'],
    [42, 3, '42 photos · 3 videos'],
    [12_345, 0, '12,345 photos'],
  ])('%s photos, %s videos → %s', (photos, videos, expected) => {
    expect(formatGroupCount(photos, videos, 'en-US')).toBe(expected)
  })
})
