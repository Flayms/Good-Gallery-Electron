# 009 · Media viewer · Plan

Retrospective: records the approach that was taken (phases 4, 6 and 8 of the former `docs/PLAN.md`).

## Approach

- **Route as overlay:** `/media/$id` is a child of the pathless `_gallery` layout, so the gallery stays mounted (scroll position, queries) behind the viewer. The route reuses `useGalleryMedia(search)` to find neighbours in the same ordered id list and loads their chunk. Navigation uses `replace`, so Back closes the viewer. The gallery passes the viewed index as `scrollToIndex` to its virtualizer.
- **Originals over `gg-media://media/<id>`** (`src/main/protocols.ts`): main resolves the path from the index by id. It parses a single `bytes=` range (multi-range → full 200, out of range → 416) and streams with `createReadStream`. The scheme is registered with `stream: true` so `<video>` can seek while loading.
- **Viewer** (`components/media-viewer.tsx`): `role="dialog"` over the window. Global key handler for Esc / ← / → / `i`, which skips modified keys and focused `<video>` elements. Photos up to two places around the current one (and the current one) are kept loading and decoded by a `Preloader` (`lib/preload.ts`), which cancels downloads that drop out of that set. `media.byId` uses `keepPreviousData` to avoid flashes while stepping.
- **Preview** (`components/zoomable-image.tsx`): the zoomed element is a frame sized by `fitSize` from the indexed dimensions. Until the original has loaded and decoded, it shows the sharpest thumbnail already in the memory cache (`pickPreview`, usually the one its tile loaded), else the 800 px one. The ThumbHash only shows when there is no thumbnail. The original fades in on top and the preview is removed after the fade. An original that is already complete on mount skips preview and fade. No loading indicator: the thumbnail is the loading state. On error a message shows over it.
- **Zoom and pan** (`components/zoomable-image.tsx`, math in `lib/zoom.ts`): `translate(x, y) scale(s)` around the center. `zoomTo` keeps the point under the cursor fixed, and `clampView` limits the scale to 1–8 and keeps zoomed content covering the viewport. A single click on the letterbox is delayed 250 ms so a double-click can cancel it. A pan (> 4 px) suppresses the click.
- **Details:** `media.byId` returns the absolute path, library label and direct tags with their category (`categoriesOf`, 008). `components/media-info.tsx` renders the panel and the sheet. Tag badges are links that patch the search with `withTag(…, 'include')`.
- **Shell:** `media.showInFolder` resolves the path by id and calls `Desktop.showItemInFolder`. The renderer never sends paths.
- **Context menu** (`components/media-context-menu.tsx`): Radix context menu around tiles, rows and the viewer's media area. _Information_ opens a `Sheet` in the gallery, or calls `onInformation` in the viewer.

## Tasks

- [x] `/media/$id` overlay route with neighbour lookup and replace navigation (REQ-009-01, REQ-009-02)
- [x] `gg-media` protocol with range support (REQ-009-04, REQ-009-06, REQ-009-12)
- [x] Viewer shell: keys, buttons, backdrop close, preloading (REQ-009-02, REQ-009-03, REQ-009-07)
- [x] `ZoomableImage` and zoom math (REQ-009-05)
- [x] `media.byId` details with categorized tags, `MediaInfo` panel (REQ-009-08, REQ-009-09)
- [x] `media.showInFolder` via `Desktop` (REQ-009-10)
- [x] `MediaContextMenu` with info sheet (REQ-009-11)
- [x] Preload ±2 with cancellation, instant thumbnail preview, failure message (REQ-009-13, REQ-009-14, REQ-009-15)
- [ ] e2e or component tests for viewer buttons, ends of the gallery, double-click/pan, preloading and the viewer context menu (REQ-009-02, REQ-009-03, REQ-009-05, REQ-009-07, REQ-009-11)
