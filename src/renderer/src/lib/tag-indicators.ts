// Tag indicators (spec 017): icons over tiles that show whether a media item is rated, placed or tagged.
import type { RouterOutputs } from '@/lib/trpc'

export const TAG_INDICATORS = ['rating', 'places', 'people', 'tags'] as const
export type TagIndicatorKind = (typeof TAG_INDICATORS)[number]

export const TAG_INDICATOR_LABELS: Record<TagIndicatorKind, string> = {
  rating: 'Rating',
  places: 'Places',
  people: 'People',
  tags: 'Tags',
}

/** localStorage key of the user's choice (REQ-017-03). */
export const TAG_INDICATORS_STORAGE_KEY = 'gallery.tagIndicators'

export interface TagIndicatorChoice {
  shown: boolean
  /** The indicators the user picked; kept while `shown` is off. */
  picked: TagIndicatorKind[]
}

export type TagIndicator = { kind: TagIndicatorKind; label: string; stars?: number }

type Indicated = Pick<RouterOutputs['media']['byIds'][number], 'rating' | 'tagged'>

function isTagIndicator(value: unknown): value is TagIndicatorKind {
  return TAG_INDICATORS.includes(value as TagIndicatorKind)
}

/** The stored choice; off with every indicator picked until the user changes it. */
export function parseTagIndicators(stored: string | null): TagIndicatorChoice {
  try {
    const value: unknown = JSON.parse(stored ?? '')
    if (typeof value === 'object' && value !== null && 'shown' in value && 'picked' in value) {
      const picked = Array.isArray(value.picked) ? value.picked.filter(isTagIndicator) : []
      return { shown: value.shown === true, picked }
    }
  } catch {
    // Missing or unreadable: fall back to the default.
  }
  return { shown: false, picked: [...TAG_INDICATORS] }
}

export function serializeTagIndicators(choice: TagIndicatorChoice): string {
  return JSON.stringify(choice)
}

/** The indicators a tile shows, in a fixed order, leaving out what the media item lacks (REQ-017-01, REQ-017-02). */
export function indicatorsOf(item: Indicated, choice: TagIndicatorChoice): TagIndicator[] {
  if (!choice.shown) return []
  const has: Record<TagIndicatorKind, boolean> = {
    rating: (item.rating ?? 0) > 0,
    places: item.tagged.places,
    people: item.tagged.people,
    tags: item.tagged.other,
  }
  return TAG_INDICATORS.filter((kind) => choice.picked.includes(kind) && has[kind]).map((kind) =>
    kind === 'rating'
      ? { kind, stars: item.rating ?? 0, label: `Rated ${item.rating} out of 5` }
      : { kind, label: `Has ${TAG_INDICATOR_LABELS[kind].toLowerCase()}` },
  )
}
