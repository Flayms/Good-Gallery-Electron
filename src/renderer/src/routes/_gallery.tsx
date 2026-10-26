import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useRef } from 'react'
import { Gallery } from '@/components/gallery'
import { GalleryToolbar } from '@/components/gallery-toolbar'
import { useColumns } from '@/hooks/use-columns'
import { useCtrlWheelZoom } from '@/hooks/use-ctrl-wheel-zoom'
import { useGalleryView } from '@/hooks/use-gallery-view'
import { useGroupByDay } from '@/hooks/use-group-by-day'
import { useTagIndicators } from '@/hooks/use-tag-indicators'
import { type GallerySearch, gallerySearch } from '@/lib/search'
import { trpc } from '@/lib/trpc'

// Pathless layout: the gallery stays mounted (and keeps its scroll position) while the viewer overlays it.
export const Route = createFileRoute('/_gallery')({
  validateSearch: gallerySearch,
  component: GalleryLayout,
})

function GalleryLayout() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [columns, setColumns] = useColumns()
  const [view, setView] = useGalleryView()
  const [groupByDay, setGroupByDay] = useGroupByDay()
  const [tagIndicators, setTagIndicators] = useTagIndicators()
  const libraries = useQuery(trpc.libraries.list.queryOptions())
  const gridRef = useRef<HTMLDivElement>(null)
  // Scrolling down zooms out, i.e. adds columns. The list has no zoom.
  useCtrlWheelZoom(gridRef, (steps) => {
    if (view !== 'list') setColumns((columns) => columns + steps)
  })

  const onSearchChange = (patch: Partial<GallerySearch>) => {
    void navigate({ to: '/', search: (prev) => ({ ...prev, ...patch }) })
  }

  // The toolbar floats over the gallery, which scrolls underneath it (REQ-013-03).
  return (
    <>
      <div ref={gridRef} className="relative min-h-0 flex-1">
        <GalleryToolbar
          search={search}
          onSearchChange={onSearchChange}
          view={view}
          onViewChange={setView}
          columns={columns}
          onColumnsChange={setColumns}
          groupByDay={groupByDay}
          onGroupByDayChange={setGroupByDay}
          tagIndicators={tagIndicators}
          onTagIndicatorsChange={setTagIndicators}
        />
        <Gallery
          search={search}
          view={view}
          columns={columns}
          groupByDay={groupByDay}
          tagIndicators={tagIndicators}
          hasLibraries={(libraries.data?.length ?? 0) > 0}
        />
      </div>
      <Outlet />
    </>
  )
}
