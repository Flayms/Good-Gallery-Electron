import { AppHeader } from '@/components/app-header'
import { FiltersMenu } from '@/components/filters-menu'
import { TagSearch } from '@/components/tag-search'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { ViewMenu } from '@/components/view-menu'
import type { GalleryView } from '@/hooks/use-gallery-view'
import type { GallerySearch } from '@/lib/search'

interface GalleryToolbarProps {
  search: GallerySearch
  onSearchChange: (patch: Partial<GallerySearch>) => void
  view: GalleryView
  onViewChange: (view: GalleryView) => void
  columns: number
  onColumnsChange: (update: number | ((columns: number) => number)) => void
  groupByDay: boolean
  onGroupByDayChange: (groupByDay: boolean) => void
}

/** Search, filters and view options in the glass bar over the gallery; fits the minimum window width. */
export function GalleryToolbar({ search, onSearchChange, ...view }: GalleryToolbarProps) {
  return (
    <AppHeader className="@container">
      <SidebarTrigger className="no-drag" />
      <TagSearch search={search} onSearchChange={onSearchChange} className="no-drag" />
      <div className="ml-auto flex items-center gap-1">
        <FiltersMenu search={search} onSearchChange={onSearchChange} />
        <ViewMenu search={search} onSearchChange={onSearchChange} {...view} />
      </div>
    </AppHeader>
  )
}
