import { ImageIcon, SlidersHorizontalIcon, VideoIcon } from 'lucide-react'
import { DateRangeFields, dateRangeLabel } from '@/components/date-range-filter'
import { MenuSection } from '@/components/menu-section'
import { RatingFields, ratingLabel } from '@/components/rating-filter'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { activeFilterCount, CLEARED_FILTERS, type GallerySearch, isMediaKind } from '@/lib/search'

/** Media kind, date range and rating; the trigger shows how many of them are active. */
export function FiltersMenu({
  search,
  onSearchChange,
}: {
  search: GallerySearch
  onSearchChange: (patch: Partial<GallerySearch>) => void
}) {
  const count = activeFilterCount(search)
  const ratings = search.rating ?? []
  const hasDate = search.from !== undefined || search.to !== undefined
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={count > 0 ? 'secondary' : 'ghost'}
          size="sm"
          className="no-drag"
          aria-label={count > 0 ? `Filters, ${count} active` : 'Filters'}
        >
          <SlidersHorizontalIcon />
          <span className="hidden @2xl:inline">Filters</span>
          {count > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs tabular-nums">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-4 p-4">
        <MenuSection label="Media type">
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            spacing={0}
            value={search.kind ?? 'all'}
            onValueChange={(value) => onSearchChange({ kind: isMediaKind(value) ? value : undefined })}
            aria-label="Media type"
            className="w-full *:flex-1"
          >
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="image">
              <ImageIcon /> Photos
            </ToggleGroupItem>
            <ToggleGroupItem value="video">
              <VideoIcon /> Videos
            </ToggleGroupItem>
          </ToggleGroup>
        </MenuSection>
        <MenuSection
          label="Date"
          value={dateRangeLabel(search)}
          onClear={hasDate ? () => onSearchChange({ from: undefined, to: undefined }) : undefined}
          clearLabel="Clear date range"
        >
          <DateRangeFields search={search} onSearchChange={onSearchChange} />
        </MenuSection>
        <MenuSection
          label="Rating"
          value={ratingLabel(ratings)}
          onClear={ratings.length > 0 ? () => onSearchChange({ rating: undefined }) : undefined}
          clearLabel="Clear rating"
        >
          <RatingFields search={search} onSearchChange={onSearchChange} />
        </MenuSection>
        <Separator />
        <Button variant="ghost" size="sm" disabled={count === 0} onClick={() => onSearchChange(CLEARED_FILTERS)}>
          Clear filters
        </Button>
      </PopoverContent>
    </Popover>
  )
}
