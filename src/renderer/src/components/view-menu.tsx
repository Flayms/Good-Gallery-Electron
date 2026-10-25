import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  LayoutDashboardIcon,
  LayoutGridIcon,
  ListIcon,
  type LucideIcon,
  Rows3Icon,
  ZoomInIcon,
  ZoomOutIcon,
} from 'lucide-react'
import { MenuSection } from '@/components/menu-section'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { MAX_COLUMNS, MIN_COLUMNS } from '@/hooks/use-columns'
import { GALLERY_VIEWS, type GalleryView, isGalleryView, VIEW_LABELS } from '@/hooks/use-gallery-view'
import { DEFAULT_DIR, DEFAULT_SORT, type GallerySearch, isSortField, SORT_FIELDS, SORT_LABELS } from '@/lib/search'

const VIEW_ICONS: Record<GalleryView, LucideIcon> = {
  masonry: LayoutDashboardIcon,
  justified: Rows3Icon,
  grid: LayoutGridIcon,
  list: ListIcon,
}

interface ViewMenuProps {
  search: GallerySearch
  onSearchChange: (patch: Partial<GallerySearch>) => void
  view: GalleryView
  onViewChange: (view: GalleryView) => void
  columns: number
  onColumnsChange: (update: number | ((columns: number) => number)) => void
}

/** Gallery view, zoom and sort order; the trigger shows the current view. */
export function ViewMenu({ search, onSearchChange, view, onViewChange, columns, onColumnsChange }: ViewMenuProps) {
  const descending = (search.dir ?? DEFAULT_DIR) === 'desc'
  const zoomable = view !== 'list'
  const ViewIcon = VIEW_ICONS[view]
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="no-drag" aria-label="View options">
          <ViewIcon />
          <span className="hidden @2xl:inline">View</span>
          <ChevronDownIcon className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-4 p-4">
        <MenuSection label="Layout" value={VIEW_LABELS[view]}>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            spacing={0}
            value={view}
            // Clicking the active item deselects it (empty value); keep the current view then.
            onValueChange={(value) => {
              if (isGalleryView(value)) onViewChange(value)
            }}
            aria-label="View"
            className="w-full *:flex-1"
          >
            {GALLERY_VIEWS.map((option) => {
              const Icon = VIEW_ICONS[option]
              return (
                <ToggleGroupItem
                  key={option}
                  value={option}
                  aria-label={VIEW_LABELS[option]}
                  title={VIEW_LABELS[option]}
                >
                  <Icon />
                </ToggleGroupItem>
              )
            })}
          </ToggleGroup>
        </MenuSection>

        <MenuSection label="Zoom" value={zoomable ? `${columns} columns` : 'Not in the List view'}>
          <div className="flex items-center gap-2">
            {/* Zooming in means fewer, wider columns. */}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onColumnsChange((count) => count + 1)}
              disabled={!zoomable || columns >= MAX_COLUMNS}
              aria-label="Zoom out"
              title="Zoom out (Ctrl + wheel)"
            >
              <ZoomOutIcon />
            </Button>
            <Slider
              className="flex-1"
              min={MIN_COLUMNS}
              max={MAX_COLUMNS}
              step={1}
              disabled={!zoomable}
              value={[MIN_COLUMNS + MAX_COLUMNS - columns]}
              onValueChange={([zoom]) => {
                if (zoom !== undefined) onColumnsChange(MIN_COLUMNS + MAX_COLUMNS - zoom)
              }}
              aria-label="Zoom"
            />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onColumnsChange((count) => count - 1)}
              disabled={!zoomable || columns <= MIN_COLUMNS}
              aria-label="Zoom in"
              title="Zoom in (Ctrl + wheel)"
            >
              <ZoomInIcon />
            </Button>
          </div>
        </MenuSection>

        <MenuSection label="Sort by">
          <div className="flex items-center gap-2">
            <Select
              value={search.sortBy ?? DEFAULT_SORT}
              onValueChange={(value) =>
                onSearchChange({ sortBy: isSortField(value) && value !== DEFAULT_SORT ? value : undefined })
              }
            >
              <SelectTrigger size="sm" className="flex-1" aria-label="Sort by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_FIELDS.map((field) => (
                  <SelectItem key={field} value={field}>
                    {SORT_LABELS[field]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSearchChange({ dir: descending ? 'asc' : undefined })}
              aria-label={descending ? 'Descending' : 'Ascending'}
            >
              {descending ? <ArrowDownIcon /> : <ArrowUpIcon />}
              {descending ? 'Descending' : 'Ascending'}
            </Button>
          </div>
        </MenuSection>
      </PopoverContent>
    </Popover>
  )
}
