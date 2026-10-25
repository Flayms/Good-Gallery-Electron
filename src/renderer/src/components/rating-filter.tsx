import { StarOffIcon } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { GallerySearch } from '@/lib/search'

const RATINGS = [0, 1, 2, 3, 4, 5] as const

/** "Any rating", "Unrated" or the selected stars, e.g. "3★, 5★". */
export function ratingLabel(ratings: number[]): string {
  if (ratings.length === 0) return 'Any rating'
  if (ratings.length === 1 && ratings[0] === 0) return 'Unrated'
  return ratings
    .filter((rating) => rating > 0)
    .sort((a, b) => a - b)
    .map((rating) => `${rating}★`)
    .join(', ')
}

/** Toggles for _Unrated_ and 1–5 stars; any combination can be selected. */
export function RatingFields({
  search,
  onSearchChange,
}: {
  search: GallerySearch
  onSearchChange: (patch: Partial<GallerySearch>) => void
}) {
  return (
    <ToggleGroup
      type="multiple"
      size="sm"
      variant="outline"
      spacing={0}
      value={(search.rating ?? []).map(String)}
      onValueChange={(value) => onSearchChange({ rating: value.length > 0 ? value.map(Number) : undefined })}
      aria-label="Ratings"
      className="w-full *:flex-1"
    >
      {RATINGS.map((rating) => (
        <ToggleGroupItem key={rating} value={String(rating)} aria-label={rating === 0 ? 'Unrated' : `${rating} stars`}>
          {rating === 0 ? <StarOffIcon /> : rating}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
