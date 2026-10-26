import { pickThumbWidth, thumbUrl } from '@shared/media-urls'
import { Link } from '@tanstack/react-router'
import { ImageOffIcon, PlayIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { MediaContextMenu } from '@/components/media-context-menu'
import { TagIndicators } from '@/components/tag-indicators'
import { formatDuration } from '@/lib/format'
import { indicatorsOf, type TagIndicatorChoice } from '@/lib/tag-indicators'
import { thumbhashDataUrl } from '@/lib/thumbhash'
import type { RouterOutputs } from '@/lib/trpc'
import { cn } from '@/lib/utils'
import { markTransitionSource } from '@/lib/view-transition'

export type MediaItem = RouterOutputs['media']['byIds'][number]

/** Cropped thumbnail filling its parent, over the ThumbHash placeholder while it loads. */
export function MediaThumbnail({
  item,
  width,
  badge = true,
  dense = false,
}: {
  item: MediaItem
  width: number
  /** Whether videos show a play badge with their duration (too big for small thumbnails). */
  badge?: boolean
  /** Small tiles at high zoom levels get smaller corners. */
  dense?: boolean
}) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading')
  const placeholder = useMemo(() => (item.thumbhash ? thumbhashDataUrl(item.thumbhash) : undefined), [item.thumbhash])
  const failed = state === 'failed' || item.thumbStatus === 'error'

  return (
    <div
      className={cn(
        'relative size-full overflow-hidden bg-muted bg-cover bg-center',
        dense ? 'rounded-xs' : 'rounded-sm',
      )}
      style={placeholder ? { backgroundImage: `url("${placeholder}")` } : undefined}
    >
      {failed ? (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <ImageOffIcon className="size-6" />
        </div>
      ) : (
        <img
          src={thumbUrl(item.id, pickThumbWidth(width, window.devicePixelRatio))}
          alt={item.fileName}
          decoding="async"
          draggable={false}
          onLoad={() => setState('loaded')}
          onError={() => setState('failed')}
          className={cn(
            'size-full object-cover transition-opacity duration-(--duration-base)',
            state === 'loaded' ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
      {badge && item.kind === 'video' && (
        <span className="absolute right-1.5 bottom-1.5 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-white text-xs tabular-nums">
          <PlayIcon className="size-3 fill-current" />
          {item.duration ? formatDuration(item.duration) : null}
        </span>
      )}
    </div>
  )
}

export function MediaTile({
  item,
  width,
  dense,
  tagIndicators,
}: {
  item: MediaItem
  width: number
  dense?: boolean
  tagIndicators: TagIndicatorChoice
}) {
  const indicators = indicatorsOf(item, tagIndicators)
  return (
    <MediaContextMenu id={item.id}>
      <Link
        to="/media/$id"
        params={{ id: item.id }}
        search={(prev) => prev}
        title={item.fileName}
        draggable={false}
        data-media-id={item.id}
        viewTransition
        onClick={() => markTransitionSource(item.id)}
        className={cn('relative block size-full', dense ? 'rounded-xs' : 'rounded-sm')}
      >
        <MediaThumbnail item={item} width={width} dense={dense} />
        {/* Videos leave room for their badge in the opposite corner. */}
        <TagIndicators
          indicators={indicators}
          className={cn(
            'absolute bottom-1.5 left-1.5 overflow-hidden',
            item.kind === 'video' ? 'max-w-[calc(100%-5.5rem)]' : 'max-w-[calc(100%-0.75rem)]',
          )}
        />
      </Link>
    </MediaContextMenu>
  )
}
