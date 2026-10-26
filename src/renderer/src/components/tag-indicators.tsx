import { type LucideIcon, MapPinIcon, StarIcon, TagIcon, UserIcon } from 'lucide-react'
import type { TagIndicator, TagIndicatorKind } from '@/lib/tag-indicators'
import { cn } from '@/lib/utils'

const TAG_INDICATOR_ICONS: Record<TagIndicatorKind, LucideIcon> = {
  rating: StarIcon,
  places: MapPinIcon,
  people: UserIcon,
  tags: TagIcon,
}

const STARS = [1, 2, 3, 4, 5]

/** Solid badge in a tile's bottom-left corner with the media item's rating stars and tag icons (REQ-017-01). */
export function TagIndicators({ indicators, className }: { indicators: TagIndicator[]; className?: string }) {
  if (indicators.length === 0) return null
  return (
    <span
      className={cn('flex items-center gap-1.5 rounded bg-black/60 px-1.5 py-1 text-white', className)}
      data-tag-indicators
    >
      {indicators.map(({ kind, label, stars }) => {
        const Icon = TAG_INDICATOR_ICONS[kind]
        return stars ? (
          <span key={kind} className="flex text-star" role="img" aria-label={label} title={label}>
            {STARS.slice(0, stars).map((star) => (
              <StarIcon key={star} className="size-3 fill-current" />
            ))}
          </span>
        ) : (
          <Icon key={kind} className="size-3" role="img" aria-label={label}>
            <title>{label}</title>
          </Icon>
        )
      })}
    </span>
  )
}
