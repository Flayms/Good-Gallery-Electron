import { justifiedRows, rowItemWidths } from '@/lib/justified'
import { columnWidth, tileHeight } from '@/lib/masonry'

/** Row height relative to the masonry column width at the same zoom, so landscape photos keep about that width. */
const ROW_HEIGHT_RATIO = 0.75

export type TileView = 'masonry' | 'justified' | 'grid'

/** A group of consecutive items, from its first item to the next group's start. */
export interface LayoutGroup {
  start: number
}

export interface TileLayoutOptions {
  view: TileView
  count: number
  /** Height / width of the item at `index`. */
  aspectAt: (index: number) => number
  /** Sorted by `start`, the first one at 0; each gets a header. Empty for one group without a header. */
  groups: readonly LayoutGroup[]
  width: number
  /** Zoom level: number of masonry and grid columns, and the justified row height derived from it. */
  columns: number
  gap: number
  headerHeight: number
}

/** Positions of all items and group headers, in pixels from the top of the content. */
export interface TileLayout {
  /** Never decreases with the index, so the items in view can be found by binary search. */
  top: Float64Array
  left: Float64Array
  width: Float64Array
  height: Float64Array
  /** Sorted by `top`. */
  headers: { group: number; top: number }[]
  headerHeight: number
  /** Height of the tallest item, to look back from a position for tiles that start above it. */
  maxHeight: number
  totalHeight: number
}

/**
 * Lays out the items of each group under its header: masonry places each tile into the currently shortest column,
 * grid does the same with squares, and justified fills rows of about equal height. Every group starts level below the
 * end of the previous one.
 */
export function tileLayout({
  view,
  count,
  aspectAt,
  groups,
  width,
  columns,
  gap,
  headerHeight,
}: TileLayoutOptions): TileLayout {
  const layout: TileLayout = {
    top: new Float64Array(count),
    left: new Float64Array(count),
    width: new Float64Array(count),
    height: new Float64Array(count),
    headers: [],
    headerHeight,
    maxHeight: 0,
    totalHeight: 0,
  }
  const colWidth = columnWidth(width, columns, gap)
  if (colWidth <= 0) return layout

  const ranges =
    groups.length === 0
      ? [{ start: 0, end: count }]
      : groups.map((group, i) => ({
          start: group.start,
          end: groups[i + 1]?.start ?? count,
        }))
  let y = 0
  ranges.forEach((range, group) => {
    if (groups.length > 0) {
      layout.headers.push({ group, top: y })
      y += headerHeight
    }
    const bottom =
      view === 'justified'
        ? placeRows(layout, range, aspectAt, width, Math.round(colWidth * ROW_HEIGHT_RATIO), gap, y)
        : placeColumns(layout, range, view === 'grid' ? () => 1 : aspectAt, columns, colWidth, gap, y)
    y = bottom + (group < ranges.length - 1 ? gap : 0)
  })
  layout.totalHeight = y
  for (const height of layout.height) layout.maxHeight = Math.max(layout.maxHeight, height)
  return layout
}

/** Masonry placement of the range from `y` on; returns the bottom of the tallest column. */
function placeColumns(
  layout: TileLayout,
  { start, end }: { start: number; end: number },
  aspectAt: (index: number) => number,
  columns: number,
  colWidth: number,
  gap: number,
  y: number,
): number {
  // Column ends including the gap after the last tile.
  const ends = new Array<number>(columns).fill(y)
  for (let index = start; index < end; index++) {
    let column = 0
    for (let c = 1; c < columns; c++) if ((ends[c] ?? 0) < (ends[column] ?? 0)) column = c
    const height = tileHeight(aspectAt(index), colWidth)
    const top = ends[column] ?? y
    layout.top[index] = top
    layout.left[index] = column * (colWidth + gap)
    layout.width[index] = colWidth
    layout.height[index] = height
    ends[column] = top + height + gap
  }
  return start < end ? Math.max(...ends) - gap : y
}

/** Justified rows of the range from `y` on; returns the bottom of the last row. */
function placeRows(
  layout: TileLayout,
  { start, end }: { start: number; end: number },
  aspectAt: (index: number) => number,
  width: number,
  targetHeight: number,
  gap: number,
  y: number,
): number {
  const groupAspectAt = (offset: number) => aspectAt(start + offset)
  let top = y
  for (const row of justifiedRows(end - start, groupAspectAt, width, targetHeight, gap)) {
    let left = 0
    rowItemWidths(row, groupAspectAt, width, gap).forEach((itemWidth, offset) => {
      const index = start + row.start + offset
      layout.top[index] = top
      layout.left[index] = left
      layout.width[index] = itemWidth
      layout.height[index] = row.height
      left += itemWidth + gap
    })
    top += row.height + gap
  }
  return top > y ? top - gap : y
}

/** First index in `[0, length)` for which `test` holds, or `length`; `test` must be monotonic. */
function lowerBound(length: number, test: (index: number) => boolean): number {
  let low = 0
  let high = length
  while (low < high) {
    const mid = (low + high) >>> 1
    if (test(mid)) high = mid
    else low = mid + 1
  }
  return low
}

/** Items `[start, end)` that may intersect the range `[top, bottom)`: all that do, and a few tiles above it. */
export function itemsInView(layout: TileLayout, top: number, bottom: number): [number, number] {
  const count = layout.top.length
  const start = lowerBound(count, (i) => (layout.top[i] ?? 0) >= top - layout.maxHeight)
  const end = lowerBound(count, (i) => (layout.top[i] ?? 0) >= bottom)
  return [Math.min(start, end), end]
}

/** Headers `[start, end)` that intersect the range `[top, bottom)`. */
export function headersInView(layout: TileLayout, top: number, bottom: number): [number, number] {
  const { headers, headerHeight } = layout
  const start = lowerBound(headers.length, (i) => (headers[i]?.top ?? 0) + headerHeight > top)
  const end = lowerBound(headers.length, (i) => (headers[i]?.top ?? 0) >= bottom)
  return [Math.min(start, end), end]
}

/** First item that starts at or below `y`, else the last item. */
export function firstItemFrom(layout: TileLayout, y: number): number {
  const count = layout.top.length
  return Math.min(
    count - 1,
    lowerBound(count, (i) => (layout.top[i] ?? 0) >= y),
  )
}

/** Index of the group containing item `index` (groups are sorted and contiguous), or -1 without groups. */
export function groupOfItem(groups: readonly LayoutGroup[], index: number): number {
  return lowerBound(groups.length, (g) => (groups[g]?.start ?? 0) > index) - 1
}

/** An entry of the list view: a group header or a media item. */
export type ListEntry = { group: number } | { item: number }

/** Entry at list position `index`, where each group's header comes before its first item. */
export function listEntryAt(groups: readonly LayoutGroup[], index: number): ListEntry {
  // Header `g` is at position `start + g`.
  const group = lowerBound(groups.length, (g) => (groups[g]?.start ?? 0) + g > index) - 1
  if (group < 0) return { item: index }
  const headerAt = (groups[group]?.start ?? 0) + group
  return index === headerAt ? { group } : { item: index - group - 1 }
}

/** List position of item `index`. */
export function listIndexOfItem(groups: readonly LayoutGroup[], index: number): number {
  return index + groupOfItem(groups, index) + 1
}
