import { Link, useParams } from '@tanstack/react-router'
import { FolderPlusIcon, ImagesIcon, TriangleAlertIcon } from 'lucide-react'
import { type ReactNode, useCallback, useMemo } from 'react'
import { APP_HEADER_HEIGHT } from '@/components/app-header'
import { DATE_GROUP_HEADER_HEIGHT, DateGroupHeader } from '@/components/date-group-header'
import { MediaList } from '@/components/media-list'
import { MediaTile } from '@/components/media-tile'
import { TileGallery } from '@/components/tile-gallery'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useGalleryMedia } from '@/hooks/use-gallery-media'
import type { GalleryView } from '@/hooks/use-gallery-view'
import { groupsShown } from '@/lib/date-groups'
import type { GallerySearch } from '@/lib/search'
import { cn } from '@/lib/utils'

/** From this zoom level on, tiles are small: narrower gaps and corners. */
const DENSE_COLUMNS = 8
const SKELETON_HEIGHTS = [220, 160, 280, 190, 240, 150, 260, 200, 170, 230, 180, 250]

function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
      {icon}
      <p className="font-medium text-foreground">{title}</p>
      {children}
    </div>
  )
}

function GallerySkeleton({ view, columns }: { view: GalleryView; columns: number }) {
  if (view === 'list') {
    return (
      <div className="flex flex-col gap-3 overflow-hidden p-3" style={{ paddingTop: APP_HEADER_HEIGHT + 12 }}>
        {Array.from({ length: 12 }, (_, i) => i).map((row) => (
          <Skeleton key={`row-${row}`} className="h-10" />
        ))}
      </div>
    )
  }
  return (
    <div className="flex gap-2 overflow-hidden p-3" style={{ paddingTop: APP_HEADER_HEIGHT + 12 }}>
      {Array.from({ length: columns }, (_, i) => i).map((column) => (
        <div key={`column-${column}`} className="flex min-w-0 flex-1 flex-col gap-2">
          {[0, 1, 2].map((row) => (
            <Skeleton
              key={`tile-${row}`}
              style={{ height: SKELETON_HEIGHTS[(column * 3 + row) % SKELETON_HEIGHTS.length] }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function Gallery({
  search,
  view,
  columns,
  groupByDay,
  hasLibraries,
}: {
  search: GallerySearch
  view: GalleryView
  columns: number
  groupByDay: boolean
  hasLibraries: boolean
}) {
  const {
    layout: { error, isPending },
    ids,
    count,
    aspectAt,
    groups: dateGroups,
    getItem,
    setRange,
  } = useGalleryMedia(search)
  const groups = groupsShown(groupByDay, search, dateGroups)
  // The viewer navigates through the same items; keep the one it shows in view behind it.
  const viewedId = useParams({ strict: false, select: (params) => params.id })
  const viewedIndex = useMemo(() => (viewedId === undefined ? undefined : ids.indexOf(viewedId)), [ids, viewedId])
  const getKey = useCallback((index: number) => ids[index] ?? -index - 1, [ids])
  const renderHeader = (group: number) => {
    const dateGroup = groups[group]
    return dateGroup ? <DateGroupHeader group={dateGroup} /> : null
  }

  if (isPending) return <GallerySkeleton view={view} columns={columns} />
  if (error) {
    return (
      <EmptyState icon={<TriangleAlertIcon className="size-10" />} title="Couldn't load media">
        <p className="text-sm">{error.message}</p>
      </EmptyState>
    )
  }
  if (count === 0) {
    return hasLibraries ? (
      <EmptyState icon={<ImagesIcon className="size-10" />} title="No media found">
        <p className="text-sm">Nothing matches the current filters yet — new files appear while indexing.</p>
      </EmptyState>
    ) : (
      <EmptyState icon={<FolderPlusIcon className="size-10" />} title="No libraries yet">
        <Button asChild>
          <Link to="/settings">Add a library</Link>
        </Button>
      </EmptyState>
    )
  }

  if (view === 'list') {
    return (
      <MediaList
        count={count}
        getKey={getKey}
        getItem={getItem}
        groups={groups}
        renderHeader={(group) => <div className="h-full px-3">{renderHeader(group)}</div>}
        onRangeChange={setRange}
        scrollToIndex={viewedIndex}
        insetTop={APP_HEADER_HEIGHT}
        className="py-1"
      />
    )
  }

  const dense = columns >= DENSE_COLUMNS
  const renderTile = (index: number, size: { width: number }) => {
    const item = getItem(index)
    return item ? (
      <MediaTile item={item} width={size.width} dense={dense} />
    ) : (
      <div className={cn('size-full bg-muted', dense ? 'rounded-xs' : 'rounded-sm')} />
    )
  }
  return (
    <TileGallery
      view={view}
      count={count}
      getKey={getKey}
      aspectAt={aspectAt}
      groups={groups}
      columns={columns}
      gap={dense ? 4 : 8}
      headerHeight={DATE_GROUP_HEADER_HEIGHT}
      onRangeChange={setRange}
      scrollToIndex={viewedIndex}
      insetTop={APP_HEADER_HEIGHT}
      renderItem={renderTile}
      renderHeader={renderHeader}
    />
  )
}
