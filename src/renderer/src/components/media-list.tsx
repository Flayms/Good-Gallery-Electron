import { Link } from '@tanstack/react-router'
import { useVirtualizer } from '@tanstack/react-virtual'
import { PlayIcon } from 'lucide-react'
import { type ReactNode, useCallback, useRef } from 'react'
import { scrollbarInset } from '@/components/app-header'
import { MediaContextMenu } from '@/components/media-context-menu'
import { Rating } from '@/components/media-info'
import { type MediaItem, MediaThumbnail } from '@/components/media-tile'
import { useVirtualAnchor } from '@/hooks/use-virtual-anchor'
import { formatBytes, formatDateTime, formatDuration } from '@/lib/format'
import { type LayoutGroup, listEntryAt, listIndexOfItem } from '@/lib/gallery-layout'
import { cn } from '@/lib/utils'

const ROW_HEIGHT = 52
const HEADER_HEIGHT = 36
/** Height of a date group's header row. */
const GROUP_ROW_HEIGHT = 40
const THUMB_SIZE = 40
const COLUMNS = 'grid grid-cols-[2.5rem_minmax(0,3fr)_minmax(0,2fr)_11rem_5.5rem_7.5rem_6rem] items-center gap-4 px-3'

interface MediaListProps {
  count: number
  /** Stable key of the item at `index`. */
  getKey: (index: number) => number
  /** Item data, once its chunk is loaded. */
  getItem: (index: number) => MediaItem | undefined
  /** Groups with a header row before their first item (sorted by start); empty for none. */
  groups: readonly LayoutGroup[]
  renderHeader: (group: number) => ReactNode
  /** Called with the first and last rendered index whenever the visible range changes. */
  onRangeChange?: (start: number, end: number) => void
  /** Scrolls this item into view whenever it changes (no-op if it's visible or negative). */
  scrollToIndex?: number
  /** Height of the toolbar floating over the top: content starts below it and scrolls underneath. */
  insetTop?: number
  className?: string
}

function folderOf(relPath: string): string {
  return relPath.slice(0, Math.max(0, relPath.lastIndexOf('/')))
}

function MediaListRow({ item }: { item: MediaItem }) {
  const date = item.takenAt ?? item.mtime
  return (
    <MediaContextMenu id={item.id}>
      <Link
        to="/media/$id"
        params={{ id: item.id }}
        search={(prev) => prev}
        title={item.fileName}
        draggable={false}
        className={cn(COLUMNS, 'h-full rounded-md text-sm hover:bg-muted')}
      >
        <div style={{ width: THUMB_SIZE, height: THUMB_SIZE }}>
          <MediaThumbnail item={item} width={THUMB_SIZE} badge={false} />
        </div>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-medium">{item.fileName}</span>
          {item.kind === 'video' && (
            <span className="flex shrink-0 items-center gap-1 text-muted-foreground text-xs tabular-nums">
              <PlayIcon className="size-3 fill-current" />
              {item.duration ? formatDuration(item.duration) : null}
            </span>
          )}
        </span>
        <span className="truncate text-muted-foreground" title={item.relPath}>
          {folderOf(item.relPath)}
        </span>
        <span
          className={cn('truncate tabular-nums', item.takenAt === null && 'text-muted-foreground')}
          title={item.takenAt === null ? 'Date modified (no capture date)' : undefined}
        >
          {formatDateTime(date)}
        </span>
        <span className="text-right tabular-nums">{formatBytes(item.size)}</span>
        <span className="text-muted-foreground tabular-nums">
          {item.width && item.height ? `${item.width} × ${item.height}` : null}
        </span>
        <span>{item.rating ? <Rating value={item.rating} /> : null}</span>
      </Link>
    </MediaContextMenu>
  )
}

/** Details list: one row per item with its thumbnail and file data, and a header row before each group. */
export function MediaList({
  count,
  getKey,
  getItem,
  groups,
  renderHeader,
  onRangeChange,
  scrollToIndex,
  insetTop = 0,
  className,
}: MediaListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // Virtual items are the rows: group headers and media items.
  const virtualizer = useVirtualizer({
    count: count + groups.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => ('group' in listEntryAt(groups, index) ? GROUP_ROW_HEIGHT : ROW_HEIGHT),
    getItemKey: (index) => {
      const entry = listEntryAt(groups, index)
      return 'group' in entry ? `group-${groups[entry.group]?.start}` : getKey(entry.item)
    },
    // The inset and the sticky header sit above the rows inside the scroll element.
    scrollMargin: insetTop + HEADER_HEIGHT,
    scrollPaddingStart: insetTop + HEADER_HEIGHT,
    overscan: 10,
  })

  const virtualItems = virtualizer.getVirtualItems()
  const toItem = useCallback(
    (index: number) => {
      const entry = listEntryAt(groups, index)
      return 'group' in entry ? (groups[entry.group]?.start ?? 0) : entry.item
    },
    [groups],
  )
  const toVirtual = useCallback((index: number) => listIndexOfItem(groups, index), [groups])
  const first = virtualItems[0]
  const last = virtualItems.at(-1)
  useVirtualAnchor({
    virtualizer,
    // Header rows move the items, so grouping re-measures.
    layoutKey: groups,
    itemRange: [first ? toItem(first.index) : 0, last ? toItem(last.index) : -1],
    toItem,
    toVirtual,
    scrollToIndex,
    onRangeChange,
  })

  return (
    // The scrollbar starts below the sticky column header too.
    <div
      ref={scrollRef}
      className={cn('h-full overflow-y-auto', className)}
      style={scrollbarInset(insetTop + HEADER_HEIGHT)}
    >
      <div style={{ height: insetTop }} />
      <div
        role="presentation"
        className={cn(COLUMNS, 'glass-bar sticky z-10 font-semibold text-muted-foreground text-xs')}
        style={{ height: HEADER_HEIGHT, top: insetTop }}
      >
        <span />
        <span>Name</span>
        <span>Folder</span>
        <span>Date</span>
        <span className="text-right">Size</span>
        <span>Dimensions</span>
        <span>Rating</span>
      </div>
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualItems.map((virtualItem) => {
          const entry = listEntryAt(groups, virtualItem.index)
          const item = 'item' in entry ? getItem(entry.item) : undefined
          return (
            <div
              key={virtualItem.key}
              className="absolute top-0 left-0 w-full"
              style={{
                height: virtualItem.size,
                transform: `translateY(${virtualItem.start - insetTop - HEADER_HEIGHT}px)`,
              }}
            >
              {'group' in entry ? (
                renderHeader(entry.group)
              ) : item ? (
                <MediaListRow item={item} />
              ) : (
                <div className="mx-3 my-1.5 h-10 rounded-md bg-muted" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
