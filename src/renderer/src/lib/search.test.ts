import { describe, expect, it } from 'vitest'
import { activeFilterCount, CLEARED_FILTERS, mediaSearchInput, tagMode, withoutTag, withTag } from './search'

describe('tag search state', () => {
  it('REQ-007-05, REQ-008-06: adds, moves and removes tags case-insensitively', () => {
    const included = withTag({}, 'Berlin', 'include')
    expect(included).toEqual({ tags: ['Berlin'], exclude: undefined })

    const moved = withTag(included, 'berlin', 'exclude')
    expect(moved).toEqual({ tags: undefined, exclude: ['berlin'] })
    expect(tagMode(moved, 'BERLIN')).toBe('exclude')

    expect(withoutTag({ ...moved, tags: ['Paris'] }, 'Berlin')).toEqual({ tags: ['Paris'], exclude: undefined })
  })
})

describe('mediaSearchInput', () => {
  it('REQ-007-08: turns inclusive local days into a half-open range', () => {
    const input = mediaSearchInput({ from: '2024-03-30', to: '2024-03-31' })

    expect(input.from).toBe(new Date(2024, 2, 30).getTime())
    expect(input.to).toBe(new Date(2024, 3, 1).getTime())
  })

  it('REQ-007-06: passes the file name filter through', () => {
    expect(mediaSearchInput({ name: 'beach' }).name).toBe('beach')
    expect(mediaSearchInput({}).name).toBeUndefined()
  })

  it('REQ-007-10: drops the folder without a root', () => {
    expect(mediaSearchInput({ folder: 'a' }).folder).toBeUndefined()
    expect(mediaSearchInput({ root: 1, folder: 'a' }).folder).toBe('a')
  })
})

describe('REQ-013-08: filters grouped under Filters', () => {
  it('counts media kind, date range and rating as one filter each', () => {
    expect(activeFilterCount({})).toBe(0)
    expect(activeFilterCount({ kind: 'video' })).toBe(1)
    expect(activeFilterCount({ from: '2024-01-01', to: '2024-12-31' })).toBe(1)
    expect(activeFilterCount({ to: '2024-12-31', rating: [3, 5], kind: 'image' })).toBe(3)
  })

  it('ignores tags, file name, library, folder and sorting', () => {
    expect(activeFilterCount({ tags: ['Beach'], name: 'IMG', root: 1, folder: 'a', sortBy: 'name', dir: 'asc' })).toBe(
      0,
    )
  })

  it('clears only those filters', () => {
    const search = { kind: 'video' as const, from: '2024-01-01', rating: [5], tags: ['Beach'], root: 1 }
    expect({ ...search, ...CLEARED_FILTERS }).toEqual({
      kind: undefined,
      from: undefined,
      to: undefined,
      rating: undefined,
      tags: ['Beach'],
      root: 1,
    })
  })
})
