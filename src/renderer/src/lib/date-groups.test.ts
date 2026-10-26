import { describe, expect, it } from 'vitest'
import { groupsShown, isGroupedByDay } from './date-groups'

const groups = [{ day: '2026-10-26', start: 0, photos: 1, videos: 0 }]

describe('REQ-016-03: isGroupedByDay', () => {
  it('is on until the user turns it off', () => {
    expect(isGroupedByDay(null)).toBe(true)
    expect(isGroupedByDay('on')).toBe(true)
    expect(isGroupedByDay('off')).toBe(false)
  })
})

describe('REQ-016-03, REQ-016-04: groupsShown', () => {
  it('shows the groups of a date sort while grouping is on', () => {
    expect(groupsShown(true, {}, groups)).toBe(groups)
    expect(groupsShown(true, { sortBy: 'modified' }, groups)).toBe(groups)
    expect(groupsShown(false, {}, groups)).toEqual([])
  })

  it.each(['name', 'path', 'size'] as const)('shows no groups when sorted by %s', (sortBy) => {
    expect(groupsShown(true, { sortBy }, groups)).toEqual([])
  })
})
