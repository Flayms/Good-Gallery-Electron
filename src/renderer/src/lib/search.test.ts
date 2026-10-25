import { describe, expect, it } from 'vitest'
import { mediaSearchInput, tagMode, withoutTag, withTag } from './search'

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
