import { useVirtualizer } from '@tanstack/react-virtual'
import { PlayIcon } from 'lucide-react'
import { type HTMLAttributes, useEffect, useRef } from 'react'
import { type MediaItem, MediaThumbnail } from '@/components/media-tile'
import { sidewaysDelta } from '@/lib/filmstrip'
import { cn } from '@/lib/utils'

const THUMB_SIZE = 56
const GAP = 4
const PADDING = 6
/** Height of the filmstrip; the viewer keeps this much room below the media (REQ-015-01). */
export const FILMSTRIP_HEIGHT = THUMB_SIZE + 2 * PADDING

export interface FilmstripProps extends Omit<HTMLAttributes<HTMLElement>, 'onSelect'> {
  /** The gallery's ordered ids. */
  ids: readonly number[]
  /** Position of the shown item in `ids`, or -1 if it isn't part of the gallery. */
  current: number
  /** Item data, once its chunk is loaded. */
  getItem: (index: number) => MediaItem | undefined
  /** Called with the first and last rendered index whenever they change. */
  onRangeChange: (start: number, end: number) => void
  onSelect: (id: number) => void
}

/** One virtualized row of thumbnails of the whole gallery; the shown item is highlighted and kept centered. */
export function Filmstrip({ ids, current, getItem, onRangeChange, onSelect, className, ...props }: FilmstripProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    horizontal: true,
    count: ids.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => THUMB_SIZE,
    getItemKey: (index) => ids[index] ?? index,
    gap: GAP,
    paddingStart: PADDING,
    paddingEnd: PADDING,
    overscan: 10,
  })
  const virtualItems = virtualizer.getVirtualItems()
  const rangeStart = virtualItems[0]?.index ?? 0
  const rangeEnd = virtualItems.at(-1)?.index ?? -1

  useEffect(() => {
    if (rangeEnd >= 0) onRangeChange(rangeStart, rangeEnd)
  }, [rangeStart, rangeEnd, onRangeChange])

  // Jumps into place when it opens, then follows the shown item smoothly unless motion is reduced (REQ-015-03).
  const placed = useRef(false)
  useEffect(() => {
    if (current < 0) return
    const smooth = placed.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    virtualizer.scrollToIndex(current, { align: 'center', behavior: smooth ? 'smooth' : 'auto' })
    placed.current = true
  }, [current, virtualizer])

  // The mouse wheel scrolls sideways (REQ-015-05). Not passive, so the page doesn't also handle it.
  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return
      event.preventDefault()
      element.scrollLeft += sidewaysDelta(event)
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <nav aria-label="Filmstrip" className={cn('glass-bar overflow-hidden rounded-xl', className)} {...props}>
      <div ref={scrollRef} className="overflow-x-auto [scrollbar-width:none]" style={{ height: FILMSTRIP_HEIGHT }}>
        <div className="relative mx-auto h-full" style={{ width: virtualizer.getTotalSize() }}>
          {virtualItems.map((virtual) => {
            const item = getItem(virtual.index)
            const isCurrent = virtual.index === current
            return (
              <button
                key={virtual.key}
                type="button"
                title={item?.fileName}
                aria-current={isCurrent ? 'true' : undefined}
                onClick={() => onSelect(ids[virtual.index] ?? 0)}
                className={cn(
                  'absolute rounded-sm transition-opacity duration-(--duration-fast)',
                  isCurrent ? 'opacity-100' : 'opacity-60 hover:opacity-100',
                )}
                style={{ left: virtual.start, top: PADDING, width: THUMB_SIZE, height: THUMB_SIZE }}
              >
                {item ? (
                  <MediaThumbnail item={item} width={THUMB_SIZE} badge={false} dense />
                ) : (
                  <div className="size-full rounded-xs bg-muted" />
                )}
                {/* The tile's duration badge doesn't fit; a play symbol still marks videos (REQ-015-07). */}
                {item?.kind === 'video' && (
                  <span
                    aria-hidden
                    data-video-indicator
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                  >
                    <span className="flex size-6 items-center justify-center rounded-full bg-black/60 text-white">
                      <PlayIcon className="size-3 translate-x-px fill-current" />
                    </span>
                  </span>
                )}
                {isCurrent && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-xs ring-2 ring-foreground ring-inset"
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
