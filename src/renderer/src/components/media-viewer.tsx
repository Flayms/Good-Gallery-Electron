import { mediaUrl, THUMB_WIDTHS, thumbUrl } from '@shared/media-urls'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { ChevronLeftIcon, ChevronRightIcon, FolderOpenIcon, GalleryHorizontalIcon, InfoIcon, XIcon } from 'lucide-react'
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { FILMSTRIP_HEIGHT, Filmstrip, type FilmstripProps } from '@/components/filmstrip'
import { MediaContextMenu } from '@/components/media-context-menu'
import { MediaInfo, Rating } from '@/components/media-info'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ZoomableImage } from '@/components/zoomable-image'
import { useFilmstrip } from '@/hooks/use-filmstrip'
import { useIdle } from '@/hooks/use-idle'
import { ambientGlassStyle } from '@/lib/ambient'
import { formatDateTime } from '@/lib/format'
import { controlsHidden } from '@/lib/idle'
import { Preloader, pickPreview } from '@/lib/preload'
import { thumbhashDataUrl } from '@/lib/thumbhash'
import { trpc } from '@/lib/trpc'
import { cn } from '@/lib/utils'

/** The controls step aside after this long without pointer movement or key presses (REQ-013-10). */
const IDLE_MS = 2500

/** A gallery neighbour; `kind` is unknown until its data is loaded. */
export interface MediaNeighbour {
  id: number
  kind?: 'image' | 'video'
}

interface MediaViewerProps {
  id: number
  /** Neighbours in the gallery order, if the item is part of the gallery. */
  prev?: MediaNeighbour
  next?: MediaNeighbour
  /** Gallery items around this one whose photos are preloaded (REQ-009-13). */
  nearby?: MediaNeighbour[]
  /** The gallery for the filmstrip (spec 015). */
  gallery?: Pick<FilmstripProps, 'ids' | 'current' | 'getItem' | 'onRangeChange'>
  onNavigate: (id: number) => void
  onClose: () => void
}

/** Room below the media for the control bar, plus the filmstrip when it's shown. */
const CONTROLS_SPACE = 80
const FILMSTRIP_SPACE = FILMSTRIP_HEIGHT + 12

/**
 * Full-window lightbox: arrow keys / buttons navigate, images zoom and pan, `i` toggles the info panel, `f` the
 * filmstrip.
 */
export function MediaViewer({ id, prev, next, nearby = [], gallery, onNavigate, onClose }: MediaViewerProps) {
  const { data: item, error } = useQuery(trpc.media.byId.queryOptions({ id }, { placeholderData: keepPreviousData }))
  const [showInfo, setShowInfo] = useState(false)
  const [showFilmstrip, setShowFilmstrip] = useFilmstrip()
  const filmstrip = showFilmstrip && gallery !== undefined
  const [hovering, setHovering] = useState(false)
  const [videoPaused, setVideoPaused] = useState(false)
  const idle = useIdle(IDLE_MS)
  const hidden = controlsHidden({ idle, hovering, infoOpen: showInfo, videoPaused })
  const showInFolder = useMutation(
    trpc.media.showInFolder.mutationOptions({ onError: (error) => toast.error(error.message) }),
  )
  const thumbhash = item?.thumbhash
  const tint = useMemo(() => (thumbhash ? (ambientGlassStyle(thumbhash) as CSSProperties) : undefined), [thumbhash])
  const placeholder = useMemo(() => (thumbhash ? thumbhashDataUrl(thumbhash) : undefined), [thumbhash])
  const preloader = useRef<Preloader>(null)
  const shownId = item?.id
  // The thumbnail its tile already loaded shows at once; it's only replaced by the original (REQ-009-14).
  const preview = useMemo(
    () =>
      shownId === undefined
        ? undefined
        : pickPreview(THUMB_WIDTHS.toReversed().map((width) => thumbUrl(shownId, width))),
    [shownId],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return
      // Focused video controls use the arrow keys for seeking.
      const inVideo = event.target instanceof HTMLVideoElement
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowLeft' && prev && !inVideo) onNavigate(prev.id)
      else if (event.key === 'ArrowRight' && next && !inVideo) onNavigate(next.id)
      else if (event.key === 'i') setShowInfo((show) => !show)
      else if (event.key === 'f') setShowFilmstrip((show) => !show)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [prev, next, onNavigate, onClose, setShowFilmstrip])

  // The shown photo stays in the set, so stepping away from it and back doesn't load it again.
  const preloadKey = [item?.id === id ? item : undefined, ...nearby]
    .flatMap((neighbour) => (neighbour?.kind === 'image' ? [mediaUrl(neighbour.id)] : []))
    .join(' ')
  useEffect(() => {
    preloader.current ??= new Preloader()
    preloader.current.set(preloadKey ? preloadKey.split(' ') : [])
  }, [preloadKey])
  useEffect(() => () => preloader.current?.set([]), [])

  // A new video starts playing; only a pause by the user keeps the controls.
  // biome-ignore lint/correctness/useExhaustiveDependencies: resets whenever the shown item changes.
  useEffect(() => setVideoPaused(false), [id])

  const control = cn('transition-opacity duration-(--duration-base)', hidden && 'pointer-events-none opacity-0')
  const hover = { onPointerEnter: () => setHovering(true), onPointerLeave: () => setHovering(false) }
  const navButton = cn(control, 'glass-bar absolute top-1/2 -translate-y-1/2 rounded-full')
  const date = item ? (item.takenAt ?? item.mtime) : undefined
  // The media fits above the filmstrip, so it's never covered (REQ-015-01).
  const below = filmstrip ? FILMSTRIP_SPACE : 0
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item?.fileName ?? 'Media viewer'}
      data-viewer
      className={cn('fixed inset-0 z-50 overflow-hidden text-foreground', hidden && 'cursor-none')}
      style={tint}
    >
      {/* The window behind stays visible, blurred and darkened (REQ-013-14). A sibling of the controls, so their own
          glass still blurs what is behind the viewer. */}
      <div data-viewer-backdrop aria-hidden className="glass-scrim absolute inset-0" />
      {/* The viewer covers the title bar; this strip still moves the window. */}
      <div className="drag-region absolute inset-x-0 top-0 z-10 h-12" />
      <MediaContextMenu id={id} onInformation={() => setShowInfo(true)}>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: mouse-only convenience; Escape already closes. */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: see above. */}
        <div
          // The open info panel takes its width from the media area, so it never covers the photo.
          className={cn(
            'absolute inset-0 flex items-center justify-center px-16 pt-12',
            showInfo && 'pr-[calc(20rem+2.25rem)]',
          )}
          style={{ paddingBottom: CONTROLS_SPACE + below }}
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
        >
          {error && <p className="text-muted-foreground">{error.message}</p>}
          {item?.kind === 'video' && (
            // biome-ignore lint/a11y/useMediaCaption: personal videos come without caption tracks.
            <video
              key={item.id}
              src={mediaUrl(item.id)}
              controls
              autoPlay
              data-viewer-media
              className="max-h-full max-w-full"
              onPlay={() => setVideoPaused(false)}
              onPause={() => setVideoPaused(true)}
            />
          )}
          {item?.kind === 'image' && (
            <ZoomableImage
              key={item.id}
              src={mediaUrl(item.id)}
              alt={item.fileName}
              size={item.width && item.height ? { width: item.width, height: item.height } : undefined}
              preview={preview}
              placeholder={placeholder}
              onBackdropClick={onClose}
            />
          )}
        </div>
      </MediaContextMenu>

      {prev && (
        <Button
          variant="ghost"
          size="icon-lg"
          className={cn(navButton, 'left-3')}
          onClick={() => onNavigate(prev.id)}
          aria-label="Previous"
          title="Previous (←)"
          {...hover}
        >
          <ChevronLeftIcon />
        </Button>
      )}
      {next && (
        <Button
          variant="ghost"
          size="icon-lg"
          className={cn(navButton, showInfo ? 'right-[calc(20rem+1.5rem)]' : 'right-3')}
          onClick={() => onNavigate(next.id)}
          aria-label="Next"
          title="Next (→)"
          {...hover}
        >
          <ChevronRightIcon />
        </Button>
      )}

      <div
        role="toolbar"
        aria-label="Viewer controls"
        className={cn(
          control,
          'glass-bar absolute left-1/2 flex h-12 max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-full pr-1.5 pl-5',
        )}
        style={{ bottom: 16 + below }}
        {...hover}
      >
        <span className="min-w-0 truncate font-semibold">{item?.fileName}</span>
        {date !== undefined && <span className="shrink-0 tabular-nums">{formatDateTime(date)}</span>}
        {item?.rating ? <Rating value={item.rating} /> : null}
        <Separator orientation="vertical" className="h-5!" />
        <div className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => showInFolder.mutate({ id })}
            aria-label="Show in Explorer"
            title="Show in Explorer"
          >
            <FolderOpenIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn('rounded-full', showInfo && 'bg-accent')}
            onClick={() => setShowInfo((show) => !show)}
            aria-label="Info"
            aria-pressed={showInfo}
            title="Info (i)"
          >
            <InfoIcon />
          </Button>
          {gallery && (
            <Button
              variant="ghost"
              size="icon"
              className={cn('rounded-full', showFilmstrip && 'bg-accent')}
              onClick={() => setShowFilmstrip((show) => !show)}
              aria-label="Filmstrip"
              aria-pressed={showFilmstrip}
              title="Filmstrip (f)"
            >
              <GalleryHorizontalIcon />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
            autoFocus
          >
            <XIcon />
          </Button>
        </div>
      </div>

      {showInfo && item && (
        <aside
          className="glass-panel absolute top-14 right-3 flex w-80 flex-col overflow-y-auto rounded-xl p-4 text-sm"
          style={{ bottom: CONTROLS_SPACE + below }}
        >
          <MediaInfo item={item} />
        </aside>
      )}

      {filmstrip && (
        <Filmstrip
          {...gallery}
          onSelect={onNavigate}
          className={cn(control, 'absolute inset-x-3 bottom-3')}
          {...hover}
        />
      )}
    </div>
  )
}
