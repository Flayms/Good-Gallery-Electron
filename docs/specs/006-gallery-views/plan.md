# 006 · Gallery views · Plan

Retrospective: records the approach that was taken (phase 4 of the former `docs/PLAN.md` and commit `1a23ca1`).

## Approach

- **Layout index instead of pagination:** `media.layout` returns the ids and aspect ratios (height / width × 1000, clamped 0.3–3) of *every* match in sort order. `media.byIds` returns tile data for chunks of 200 positions around the visible range (`hooks/use-gallery-media.ts`). The scroll height is exact from the start. Loaded items are remembered (up to 20k) so a refreshed layout doesn't flash placeholders. The viewer shares the same queries.
- **Virtualization:** `@tanstack/react-virtual`, no masonry library. Masonry uses `useVirtualizer` with `lanes` = columns (shortest-lane placement), heights from aspect × whole-pixel column width, positioned with `translate`. Justified (`lib/justified.ts`) precomputes rows (greedy fill at the target height, then scales the row to the exact width, rounding remainder to the last item) and virtualizes rows. Grid is Masonry with a constant aspect of 1. List virtualizes 52 px rows below a sticky 36 px header (`scrollMargin`).
- **Shared scroll behaviour** (`hooks/use-virtual-anchor.ts`): re-measure on a layout key change and scroll the previously first visible item back to the top, scroll a given item into view (used by the viewer), and report the rendered range.
- **Zoom:** column count 2–12 in `localStorage` (`hooks/use-columns.ts`). Slider inverted (right = bigger tiles), and a native non-passive wheel listener for Ctrl + wheel (`hooks/use-ctrl-wheel-zoom.ts`, deltas accumulated per 100 px). The view goes to `localStorage` as well (`hooks/use-gallery-view.ts`). Neither is in the URL.
- **Container width** via `ResizeObserver` (`hooks/use-content-width.ts`). A hidden window never lays out (see `docs/known-pitfalls.md`).
- **Live updates** (`hooks/use-indexer-status.ts`): one indexer status subscription in the root layout. It invalidates `libraries.list` when the scanning root changes, and media/layout/tag/folder queries after the first written files, at most every 5 s, and when a scan ends.
- **Alternatives rejected:** CSS columns / `react-masonry-css` (not virtualized, column-major order), CSS `grid-lanes` (not virtualized), `masonic` (unmaintained).

## Tasks

- [x] `media.layout` and `media.byIds`, `useGalleryMedia` chunk loading (REQ-006-08)
- [x] `MasonryGrid` with lanes and anchor-preserving relayout (REQ-006-02, REQ-006-07)
- [x] `JustifiedRows` and row algorithm (REQ-006-03)
- [x] Grid via square aspect (REQ-006-04)
- [x] `MediaList` with sticky header and detail columns (REQ-006-05)
- [x] View toggle and persisted view (REQ-006-01)
- [x] Zoom slider, buttons, Ctrl + wheel, persisted columns (REQ-006-06)
- [x] Video badge, empty, loading and error states (REQ-006-09, REQ-006-10)
- [x] Indexer-driven query invalidation (REQ-006-11)
- [ ] Component tests for view persistence, scroll anchoring, empty states and live refresh (REQ-006-01, REQ-006-07, REQ-006-10, REQ-006-11)
