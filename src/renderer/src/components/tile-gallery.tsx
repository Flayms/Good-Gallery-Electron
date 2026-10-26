import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useContentWidth } from '@/hooks/use-content-width'
import {
  firstItemFrom,
  groupOfItem,
  headersInView,
  itemsInView,
  type LayoutGroup,
  type TileLayout,
  type TileView,
  tileLayout,
} from '@/lib/gallery-layout'
import { cn } from '@/lib/utils'

/** Extra content rendered above and below the viewport, in pixels. */
const OVERSCAN = 600
/** Padding of the scroll element (`p-3`); the layout starts inside it. */
const PADDING = 12

interface TileGalleryProps {
  view: TileView
  count: number
  /** Stable key of the item at `index`. */
  getKey: (index: number) => number
  /** Height / width of the item at `index`; known for every item up front so the scroll length is exact. */
  aspectAt: (index: number) => number
  /** Groups shown under a header each (sorted by start); empty for one group without a header. */
  groups: readonly LayoutGroup[]
  columns: number
  gap?: number
  headerHeight?: number
  /** Called with the first and last rendered index whenever the visible range changes. */
  onRangeChange?: (start: number, end: number) => void
  /** Scrolls this item into view whenever it changes (no-op if it's visible or negative). */
  scrollToIndex?: number
  /** Height of the toolbar floating over the top: content starts below it and scrolls underneath. */
  insetTop?: number
  renderItem: (index: number, size: { width: number; height: number }) => ReactNode
  renderHeader: (group: number) => ReactNode
  className?: string
}

/** Top of item `index` when scrolled to the start, with its group's header if it is the group's first item. */
function startOf(layout: TileLayout, groups: readonly LayoutGroup[], index: number): number {
  const top = layout.top[index] ?? 0
  return groups[groupOfItem(groups, index)]?.start === index ? top - layout.headerHeight : top
}

/**
 * Masonry, Justified and Grid views: all tiles and group headers are positioned up front (`tileLayout`), and only
 * those near the viewport are rendered.
 */
export function TileGallery({
  view,
  count,
  getKey,
  aspectAt,
  groups,
  columns,
  gap = 8,
  headerHeight = 0,
  onRangeChange,
  scrollToIndex,
  insetTop = 0,
  renderItem,
  renderHeader,
  className,
}: TileGalleryProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const width = Math.floor(useContentWidth(scrollRef))
  const layout = useMemo(
    () => tileLayout({ view, count, aspectAt, groups, width, columns, gap, headerHeight }),
    [view, count, aspectAt, groups, width, columns, gap, headerHeight],
  )

  const [viewport, setViewport] = useState({ top: 0, height: 0 })
  // The first item below the toolbar, kept in view when the layout changes (zoom, resize, grouping, new items).
  const anchorItem = useRef(0)
  const layoutRef = useRef(layout)

  useLayoutEffect(() => {
    const element = scrollRef.current
    if (!element) return
    let frame = 0
    const update = () => {
      frame = 0
      setViewport((current) =>
        current.top === element.scrollTop && current.height === element.clientHeight
          ? current
          : { top: element.scrollTop, height: element.clientHeight },
      )
      anchorItem.current = Math.max(0, firstItemFrom(layoutRef.current, element.scrollTop - PADDING))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    const observer = new ResizeObserver(onScroll)
    observer.observe(element)
    element.addEventListener('scroll', onScroll, { passive: true })
    update()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      element.removeEventListener('scroll', onScroll)
    }
  }, [])

  useLayoutEffect(() => {
    const previous = layoutRef.current
    layoutRef.current = layout
    const element = scrollRef.current
    if (previous === layout || !element || layout.top.length === 0) return
    element.scrollTop = startOf(layout, groups, Math.min(anchorItem.current, layout.top.length - 1))
  }, [layout, groups])

  useEffect(() => {
    const element = scrollRef.current
    if (!element || scrollToIndex === undefined || scrollToIndex < 0 || scrollToIndex >= layout.top.length) return
    const top = startOf(layout, groups, scrollToIndex)
    const bottom = (layout.top[scrollToIndex] ?? 0) + (layout.height[scrollToIndex] ?? 0)
    if (top < element.scrollTop - PADDING) element.scrollTop = top
    else if (bottom > element.scrollTop + element.clientHeight - insetTop - 2 * PADDING) {
      element.scrollTop = bottom + insetTop + 2 * PADDING - element.clientHeight
    }
  }, [scrollToIndex, layout, groups, insetTop])

  // In layout coordinates: the scroll position minus the padding and the toolbar inset above the content.
  const viewTop = viewport.top - PADDING - insetTop - OVERSCAN
  const viewBottom = viewport.top + viewport.height - PADDING - insetTop + OVERSCAN
  const [itemStart, itemEnd] = itemsInView(layout, viewTop, viewBottom)
  const [headerStart, headerEnd] = headersInView(layout, viewTop, viewBottom)

  useEffect(() => {
    if (itemEnd > itemStart) onRangeChange?.(itemStart, itemEnd - 1)
  }, [itemStart, itemEnd, onRangeChange])

  const headers = layout.headers.slice(headerStart, headerEnd)
  const items: ReactNode[] = []
  for (let index = itemStart; index < itemEnd; index++) {
    const top = layout.top[index] ?? 0
    const height = layout.height[index] ?? 0
    if (top + height < viewTop) continue
    const itemWidth = layout.width[index] ?? 0
    items.push(
      <div
        key={getKey(index)}
        className="absolute top-0 left-0"
        style={{
          width: itemWidth,
          height,
          transform: `translate(${layout.left[index] ?? 0}px, ${insetTop + top}px)`,
        }}
      >
        {renderItem(index, { width: itemWidth, height })}
      </div>,
    )
  }

  return (
    <div ref={scrollRef} className={cn('h-full overflow-y-auto p-3', className)}>
      <div className="relative w-full" style={{ height: insetTop + layout.totalHeight }}>
        {headers.map((header) => (
          <div
            key={`group-${groups[header.group]?.start ?? header.group}`}
            className="absolute top-0 left-0 w-full"
            style={{ height: layout.headerHeight, transform: `translateY(${insetTop + header.top}px)` }}
          >
            {renderHeader(header.group)}
          </div>
        ))}
        {items}
      </div>
    </div>
  )
}
