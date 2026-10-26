import {
  type MouseEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type WheelEvent,
} from 'react'

type OriginalState = 'pending' | 'loaded' | 'failed'

import { cn } from '@/lib/utils'
import { FIT, fitSize, MAX_SCALE, type Size, type ZoomView, zoomTo } from '@/lib/zoom'

const WHEEL_SENSITIVITY = 0.002
const KEY_ZOOM_STEP = 1.25
/** Longer than this and a pointer-down → pointer-up isn't a click, it's the end of a pan. */
const DRAG_THRESHOLD = 4
/** A single click is only fired once this long has passed without a second one turning it into a double-click. */
const CLICK_DELAY = 250

function sizeOf(element: HTMLElement): Size {
  // Layout size, unaffected by the zoom transform.
  return { width: element.offsetWidth, height: element.offsetHeight }
}

interface ZoomableImageProps {
  src: string
  alt: string
  /** Pixel size of the original, if known; lets the preview take the original's place before it has loaded. */
  size?: Size
  /** Shown until the original has loaded (REQ-009-14): its thumbnail, or a placeholder data URL without one. */
  preview?: string
  placeholder?: string
  /** Fires for a plain (non-double) click that lands on the letterboxing around the image, not the image itself. */
  onBackdropClick?: () => void
}

/**
 * Image fitted into its container; wheel / click / double-click / `+` `-` `0` zoom, dragging pans. Until the original has
 * loaded, its thumbnail stands in for it at the same size (REQ-009-14, REQ-009-15).
 */
export function ZoomableImage({ src, alt, size, preview, placeholder, onBackdropClick }: ZoomableImageProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  // The zoomed frame holds the preview and the original; zoom math works on its layout size.
  const imageRef = useRef<HTMLDivElement>(null)
  const originalRef = useRef<HTMLImageElement>(null)
  const drag = useRef<{ pointerId: number; x: number; y: number; view: ZoomView; dragged: boolean } | null>(null)
  // Set by the release of a pan, so the click that follows it is ignored.
  const panned = useRef(false)
  const clickTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [view, setView] = useState(FIT)
  const [viewportSize, setViewportSize] = useState<Size>()
  const [natural, setNatural] = useState(size)
  const [original, setOriginal] = useState<OriginalState>('pending')
  // An original that is ready on mount (preloaded, REQ-009-13) shows without preview and fade.
  const [instant, setInstant] = useState(false)
  // The preview stays under the original until it has faded in.
  const [settled, setSettled] = useState(false)
  // Without a cached thumbnail the placeholder stands in.
  const [previewFailed, setPreviewFailed] = useState(false)

  useEffect(() => () => clearTimeout(clickTimer.current), [])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    // Measured before the first paint, so the preview is in place when the viewer appears.
    setViewportSize(sizeOf(viewport))
    const observer = new ResizeObserver(() => setViewportSize(sizeOf(viewport)))
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const image = originalRef.current
    if (!image?.complete || image.naturalWidth === 0) return
    setNatural((known) => known ?? { width: image.naturalWidth, height: image.naturalHeight })
    setOriginal('loaded')
    setInstant(true)
  }, [])

  const onOriginalLoad = () => {
    const image = originalRef.current
    if (!image) return
    setNatural((known) => known ?? { width: image.naturalWidth, height: image.naturalHeight })
    // Decoded first, so the fade doesn't stall on a large photo.
    image
      .decode()
      .catch(() => {})
      .then(() => {
        setOriginal('loaded')
        // Without a transition (reduced motion) there is no transitionend to wait for.
        if (getComputedStyle(image).transitionDuration === '0s') setSettled(true)
      })
  }

  /** Zooms around a point given in client coordinates, or around the center. */
  const zoom = useCallback((scale: (current: ZoomView) => number, client?: { x: number; y: number }) => {
    const viewport = viewportRef.current
    const image = imageRef.current
    if (!viewport || !image) return
    const rect = viewport.getBoundingClientRect()
    const point = client
      ? { x: client.x - rect.left - rect.width / 2, y: client.y - rect.top - rect.height / 2 }
      : { x: 0, y: 0 }
    setView((current) => zoomTo(current, scale(current), point, sizeOf(image), sizeOf(viewport)))
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return
      if (event.key === '+' || event.key === '=') zoom((current) => current.scale * KEY_ZOOM_STEP)
      else if (event.key === '-') zoom((current) => current.scale / KEY_ZOOM_STEP)
      else if (event.key === '0') setView(FIT)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [zoom])

  const onWheel = (event: WheelEvent) => {
    const factor = Math.exp(-event.deltaY * WHEEL_SENSITIVITY)
    zoom((current) => current.scale * factor, { x: event.clientX, y: event.clientY })
  }

  /** Toggles between fitted and actual pixels (at least 2×, so small images zoom too) around the pointer. */
  const toggleZoom = (event: MouseEvent) => {
    const image = imageRef.current
    const actual = image && natural ? natural.width / Math.max(1, image.offsetWidth) : 2
    zoom((current) => (current.scale > 1 ? 1 : Math.min(MAX_SCALE, Math.max(2, actual))), {
      x: event.clientX,
      y: event.clientY,
    })
  }

  /** By position, not target: while a pan has the pointer captured, clicks target the viewport. */
  const onImage = (event: MouseEvent) => {
    const rect = imageRef.current?.getBoundingClientRect()
    return (
      !!rect &&
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    )
  }

  const onClick = (event: MouseEvent) => {
    if (panned.current) {
      panned.current = false
      return
    }
    // A click on the image zooms (REQ-009-16); the second click of a double-click doesn't switch back.
    if (onImage(event)) {
      if (event.detail <= 1) toggleZoom(event)
      return
    }
    if (!onBackdropClick) return
    clearTimeout(clickTimer.current)
    // Delayed so a following click (a double-click, handled below) can cancel it instead of also zooming and closing.
    clickTimer.current = setTimeout(onBackdropClick, CLICK_DELAY)
  }

  const onDoubleClick = (event: MouseEvent) => {
    clearTimeout(clickTimer.current)
    // On the image, the first click already switched.
    if (!onImage(event)) toggleZoom(event)
  }

  const onPointerDown = (event: PointerEvent) => {
    panned.current = false
    if (event.button !== 0 || view.scale <= 1) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, view, dragged: false }
  }

  const onPointerMove = (event: PointerEvent) => {
    const start = drag.current
    const viewport = viewportRef.current
    const image = imageRef.current
    if (!start || start.pointerId !== event.pointerId || !viewport || !image) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD) start.dragged = true
    const moved = { ...start.view, x: start.view.x + dx, y: start.view.y + dy }
    // zoomTo at the same scale only clamps the pan.
    setView(zoomTo(moved, moved.scale, { x: 0, y: 0 }, sizeOf(image), sizeOf(viewport)))
  }

  const onPointerUp = (event: PointerEvent) => {
    if (drag.current?.pointerId !== event.pointerId) return
    // A real pan shouldn't also fire the click that follows pointer-up.
    panned.current = drag.current.dragged
    drag.current = null
  }

  const zoomed = view.scale > 1
  const fitted = natural && viewportSize ? fitSize(natural, viewportSize) : undefined
  const showPreview = !instant && !settled
  return (
    // To assistive tech this is just the image; the mouse gestures mirror the global `+` `-` `0` keys.
    // biome-ignore lint/a11y/useKeyWithClickEvents: mouse-only convenience; Escape already closes the viewer.
    <div
      ref={viewportRef}
      role="img"
      aria-label={alt}
      className="flex size-full touch-none items-center justify-center overflow-hidden"
      onWheel={onWheel}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        ref={imageRef}
        data-viewer-media
        // Only the image shows what a click does; around it, a click closes the viewer (REQ-009-16).
        className={cn(
          'relative shrink-0 select-none',
          zoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in',
        )}
        style={{
          width: fitted?.width,
          height: fitted?.height,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
        }}
      >
        {showPreview && (
          <div
            aria-hidden
            data-viewer-preview
            className="absolute inset-0 bg-center bg-cover"
            style={
              placeholder && (!preview || previewFailed) ? { backgroundImage: `url("${placeholder}")` } : undefined
            }
          >
            {preview && !previewFailed && (
              <img
                src={preview}
                alt=""
                draggable={false}
                className="size-full object-contain"
                onError={() => setPreviewFailed(true)}
              />
            )}
          </div>
        )}
        <img
          ref={originalRef}
          src={src}
          alt={alt}
          draggable={false}
          data-viewer-original
          className={cn(
            'absolute inset-0 size-full object-contain',
            !instant && 'transition-opacity duration-(--duration-base)',
            original === 'loaded' ? 'opacity-100' : 'opacity-0',
          )}
          onLoad={onOriginalLoad}
          onError={() => setOriginal('failed')}
          onTransitionEnd={() => original === 'loaded' && setSettled(true)}
        />
        {original === 'failed' && (
          <p
            className="glass-bar absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-1.5 text-sm"
            role="alert"
          >
            Can't load the original. Showing a preview.
          </p>
        )}
      </div>
    </div>
  )
}
