import { describe, expect, it } from 'vitest'
import {
  firstItemFrom,
  headersInView,
  itemsInView,
  listEntryAt,
  listIndexOfItem,
  type TileLayoutOptions,
  tileLayout,
} from './gallery-layout'

const base: TileLayoutOptions = {
  view: 'masonry',
  count: 0,
  aspectAt: () => 1,
  groups: [],
  width: 316,
  columns: 3,
  gap: 8,
  headerHeight: 40,
}

/** Boxes of the items as `[left, top, width, height]`. */
function boxes(layout: ReturnType<typeof tileLayout>) {
  return Array.from(layout.top, (top, i) => [layout.left[i], top, layout.width[i], layout.height[i]])
}

describe('tileLayout', () => {
  it('REQ-006-02: places each masonry tile into the shortest column', () => {
    const aspects = [1, 0.5, 2, 1, 1]
    const layout = tileLayout({ ...base, count: 5, aspectAt: (i) => aspects[i] ?? 1 })

    // Columns are 100 px wide: heights 100, 50, 200; then the 50 px column, then the 100 px one.
    expect(boxes(layout)).toEqual([
      [0, 0, 100, 100],
      [108, 0, 100, 50],
      [216, 0, 100, 200],
      [108, 58, 100, 100],
      [0, 108, 100, 100],
    ])
    expect(layout.totalHeight).toBe(208)
    expect(layout.headers).toEqual([])
  })

  it('REQ-016-05: starts the columns of each group level below its header', () => {
    const aspects = [1, 2, 0.5]
    const layout = tileLayout({
      ...base,
      count: 3,
      aspectAt: (i) => aspects[i] ?? 1,
      groups: [{ start: 0 }, { start: 2 }],
    })

    expect(layout.headers).toEqual([
      { group: 0, top: 0 },
      // Below the tallest column of the first group (40 + 200) and a gap.
      { group: 1, top: 248 },
    ])
    expect(boxes(layout)).toEqual([
      [0, 40, 100, 100],
      [108, 40, 100, 200],
      [0, 288, 100, 50],
    ])
    expect(layout.totalHeight).toBe(338)
  })

  it('REQ-006-04, REQ-016-05: lays out the grid as squares, each group starting a new row', () => {
    const layout = tileLayout({
      ...base,
      view: 'grid',
      count: 4,
      aspectAt: () => 3,
      groups: [{ start: 0 }, { start: 1 }],
    })

    expect(boxes(layout)).toEqual([
      [0, 40, 100, 100],
      [0, 188, 100, 100],
      [108, 188, 100, 100],
      [216, 188, 100, 100],
    ])
  })

  it('REQ-006-03, REQ-016-05: fills justified rows per group and keeps the last row of each group unstretched', () => {
    // Target row height: 75 (3/4 of a 100 px column).
    const layout = tileLayout({
      ...base,
      view: 'justified',
      count: 5,
      aspectAt: () => 1,
      groups: [{ start: 0 }, { start: 1 }],
    })

    // First group: one item that doesn't fill the row, at the target height.
    expect(boxes(layout)[0]).toEqual([0, 40, 75, 75])
    // Second group: four squares fill a row (4 × 75 + 3 × 8 > 316), scaled down to fit, flush with the right edge.
    const row = boxes(layout).slice(1)
    expect(row.map(([, top]) => top)).toEqual([163, 163, 163, 163])
    expect(row.map(([, , , height]) => height)).toEqual([73, 73, 73, 73])
    const last = row[3] ?? []
    expect((last[0] ?? 0) + (last[2] ?? 0)).toBe(316)
  })

  it.each(['masonry', 'justified', 'grid'] as const)('REQ-016-06: keeps item tops in order in the %s view', (view) => {
    let seed = 7
    const random = () => {
      seed = (seed * 16_807) % 2_147_483_647
      return seed / 2_147_483_647
    }
    const aspects = Array.from({ length: 500 }, () => 0.3 + random() * 2.7)
    const groups = [0, 3, 4, 50, 51, 200, 499].map((start) => ({ start }))
    const layout = tileLayout({ ...base, view, count: 500, aspectAt: (i) => aspects[i] ?? 1, groups, columns: 5 })

    for (let i = 1; i < 500; i++) expect(layout.top[i]).toBeGreaterThanOrEqual(layout.top[i - 1] ?? 0)
  })
})

describe('REQ-016-06: windowing', () => {
  const aspects = [1, 0.5, 2, 1, 1]
  const layout = tileLayout({
    ...base,
    count: 5,
    aspectAt: (i) => aspects[i] ?? 1,
    groups: [{ start: 0 }, { start: 3 }],
  })
  // Tops: 40, 40, 40 | header 248 | 288, 288.

  it('finds the items intersecting a range, including tall ones that start above it', () => {
    const [start, end] = itemsInView(layout, 200, 260)
    expect(start).toBeLessThanOrEqual(2)
    expect(end).toBe(3)
    expect(itemsInView(layout, 300, 400)).toEqual([3, 5])
  })

  it('finds the headers in a range', () => {
    expect(headersInView(layout, 0, 100)).toEqual([0, 1])
    expect(headersInView(layout, 100, 300)).toEqual([1, 2])
  })

  it('finds the first item starting at or below a position', () => {
    expect(firstItemFrom(layout, 0)).toBe(0)
    expect(firstItemFrom(layout, 41)).toBe(3)
    expect(firstItemFrom(layout, 1000)).toBe(4)
  })
})

describe('REQ-016-05: list entries', () => {
  const groups = [{ start: 0 }, { start: 2 }, { start: 3 }]
  // Entries: header 0, item 0, item 1, header 1, item 2, header 2, item 3, item 4.

  it('interleaves group headers with the items', () => {
    expect(Array.from({ length: 8 }, (_, i) => listEntryAt(groups, i))).toEqual([
      { group: 0 },
      { item: 0 },
      { item: 1 },
      { group: 1 },
      { item: 2 },
      { group: 2 },
      { item: 3 },
      { item: 4 },
    ])
    expect([0, 1, 2, 3, 4].map((item) => listIndexOfItem(groups, item))).toEqual([1, 2, 4, 6, 7])
  })

  it('is the plain item list without groups', () => {
    expect(listEntryAt([], 3)).toEqual({ item: 3 })
    expect(listIndexOfItem([], 3)).toBe(3)
  })
})
