# 009 · Media viewer

**Status:** Implemented (retrospective spec)

## Goal

The user looks at one media item at full quality without losing their place in the gallery: steps through the current result with the keyboard, zooms into photos, plays videos, checks a file's details and tags, and jumps to the file in Explorer.

## Requirements

### REQ-009-01 · Open an item

- **Given** the gallery in any view
- **When** the user clicks (or presses Enter on) a tile or list row
- **Then** the viewer opens over the whole window, showing the item and its file name
- **And** the gallery behind it keeps its scroll position and scrolls the viewed item into view, so closing the viewer lands on it

### REQ-009-02 · Step through the gallery

- **Given** the viewer
- **When** the user presses ← / → or clicks _Previous_ / _Next_
- **Then** the previous or next item of the gallery is shown, following its current filters and sort order. There is no _Previous_ on the first item and no _Next_ on the last
- **And** while video controls have focus, ← / → seek the video instead
- **And** stepping adds no history entries, so Back closes the viewer

### REQ-009-03 · Close the viewer

- **Given** the viewer
- **When** the user presses Escape, clicks _Close_, uses Back, or clicks the dark area around the photo or video
- **Then** the viewer closes and the gallery is shown with the same search
- **And** clicks on the media itself, the release of a pan, and double-clicks don't close it

### REQ-009-04 · Original quality

- **Given** an image or video in the viewer
- **When** it is shown
- **Then** the original file is shown at full resolution, fitted into the window, and loaded from the library (not from the thumbnail cache)

### REQ-009-05 · Zoom and pan photos

- **Given** a photo in the viewer
- **When** the user turns the mouse wheel, double-clicks, presses `+` / `-` / `0`, or drags
- **Then** the wheel zooms around the pointer, a double-click switches between fitted and actual pixels (at least 2×) around the pointer, `+` / `-` zoom around the center, `0` fits it again, and dragging pans a zoomed photo
- **And** zoom stays between fitted (1×) and 8×, and a zoomed photo always covers the area it can fill (no panning into empty space)

### REQ-009-06 · Play videos

- **Given** a video in the viewer
- **When** it is shown
- **Then** it starts playing with standard controls, and seeking works before the whole file has loaded

### REQ-009-07 · Preload neighbours

- **Given** a photo before or after the current item in the gallery
- **When** the viewer shows the current item
- **Then** the neighbouring photos start loading, so stepping to them is quick

### REQ-009-08 · Info panel

- **Given** the viewer
- **When** the user presses `i` or clicks _Info_
- **Then** a side panel toggles, showing file name, full path (selectable), library, date taken (if known), date modified, dimensions (if known), duration (videos), file size, rating (if rated) and the item's tags, grouped into People, Places and Tags

### REQ-009-09 · Filter by a tag from the info panel

- **Given** the info panel or info sheet
- **When** the user clicks a tag
- **Then** the viewer closes and the gallery is filtered by that tag (added as included, keeping the other filters)

### REQ-009-10 · Show in Explorer

- **Given** the viewer or a tile's context menu
- **When** the user chooses _Show in Explorer_
- **Then** Explorer opens the item's folder with the file selected. If the item no longer exists, an error toast is shown

### REQ-009-11 · Context menu

- **Given** a tile, a list row or the media area of the viewer
- **When** the user right-clicks it
- **Then** a menu offers _Show in Explorer_ and _Information_
- **And** _Information_ opens the info sheet beside the gallery (same content as REQ-009-08) without opening the viewer, or opens the info panel inside the viewer

### REQ-009-12 · Missing items

- **Given** a viewer URL for an item that isn't indexed (anymore), or whose file vanished
- **When** the viewer opens it
- **Then** it shows "Media not found", or the media fails to load, instead of showing something else

## Out of scope

- Slideshows, rotating, cropping, editing, deleting, copying or sharing files.
- Opening a file in another app (other than revealing it in Explorer).
- Fullscreen mode, a filmstrip and comparing items side by side.
- Showing EXIF details beyond REQ-009-08.

## Assumptions

- Chromium can decode all supported media types (002). Videos with codecs Chromium can't play (e.g. some HEVC files) don't play in the viewer.
- Originals are read straight from the library, so viewing needs the library to be reachable (thumbnails don't).

## Verification

| REQ        | Test                                                                                                                                                         | Result                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| REQ-009-01 | `e2e/smoke.spec.ts` (tile and list row open the viewer)                                                                                                       | partial: scrolling the viewed item into view is untested            |
| REQ-009-02 | `e2e/smoke.spec.ts` (→ follows the gallery order)                                                                                                             | partial: buttons, ends of the gallery, video focus and history are untested |
| REQ-009-03 | `e2e/smoke.spec.ts` (Escape, click beside a video)                                                                                                            | partial: double-click and pan release are untested                  |
| REQ-009-04 | `src/main/protocols.test.ts` › gg-media handler › streams the whole file; `e2e/smoke.spec.ts` (full-width original)                                          | pass                                                                |
| REQ-009-05 | `src/renderer/src/lib/zoom.test.ts` › zoomTo; clampView; `e2e/smoke.spec.ts` (wheel zoom, `0` resets)                                                        | partial: double-click and dragging are untested                     |
| REQ-009-06 | `src/main/protocols.test.ts` › gg-media handler › serves byte ranges; parseRange                                                                              | partial: playback in the viewer is untested                         |
| REQ-009-07 | —                                                                                                                                                            | no test                                                             |
| REQ-009-08 | `src/main/trpc/router.test.ts` › media.byId › includes the file path, library and tags; includes the rating and groups tags by category; `e2e/smoke.spec.ts` (`i` shows path and tags) | pass                                   |
| REQ-009-09 | `e2e/smoke.spec.ts` (clicking a tag filters and closes the viewer)                                                                                            | pass                                                                |
| REQ-009-10 | `src/main/trpc/router.test.ts` › media.showInFolder › reveals the file resolved from the index                                                               | partial: the buttons and the error toast are untested               |
| REQ-009-11 | `e2e/smoke.spec.ts` (_Information_ from a tile's context menu)                                                                                                | partial: the viewer's context menu is untested                      |
| REQ-009-12 | `src/main/trpc/router.test.ts` › media.byId › returns a single item or NOT_FOUND; `src/main/protocols.test.ts` › gg-media handler › answers 404 for unknown ids and vanished files | pass                                      |
