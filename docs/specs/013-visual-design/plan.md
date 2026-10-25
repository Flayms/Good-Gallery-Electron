# 013 · Visual design · Plan

## Approach

Four phases, each shippable on its own. Phase 0 is a spike whose results decide whether phase 1 uses glass over the scrolling gallery. Tokens and rules are in [docs/design.md](../../design.md); this plan only covers how to get there.

### Phase 0 · Spike: glass and title bar

- **Scroll performance:** a 50k-item fixture (generated like the e2e fixture), Masonry at 12 and 5 columns, toolbar with `backdrop-filter: blur(24px) saturate(1.6)` vs. opaque. Measure frame times while scrolling with a rAF sampler driven over CDP (see _Runtime verification_ in `docs/known-pitfalls.md`). Go if p95 frame time stays within 10 % of the opaque toolbar and below 16.7ms.
- **Title bar:** `titleBarStyle: 'hidden'` with `titleBarOverlay` (Windows, Linux) and `trafficLightPosition` (macOS). Check that a transparent overlay color works over the glass toolbar, that `env(titlebar-area-x / -width)` reports the reserved area, and that `app-region: drag` areas behave (drag, double-click maximize, no swallowed clicks on controls).
- Record findings in `docs/known-pitfalls.md`. Revise this plan if the result is no-go.
- **Outcome (2026-10-25): go.** Glass toolbar and panel showed no frame-time cost against an opaque toolbar (3 000 photos; at 12 columns the app already drops frames without glass, recorded as an open issue). The transparent overlay, `env(titlebar-area-*)` and drag regions work on Windows.

### Phase 1 · Foundation

- **Tokens** (`styles.css`): replace the shadcn palette with the design tokens on `:root`. Keep `class="dark"` on `<html>`, since shadcn components use `dark:` variants. Add `--star`, `--ambient`, motion tokens, the radius scale and the Field color.
- **Glass utilities:** `@utility glass-bar` and `@utility glass-panel`, each with a `@media (prefers-reduced-transparency: reduce)` and `@supports not (backdrop-filter: blur(1px))` fallback to Raised. Apply `glass-panel` to the content of popover, select, context menu, command, dialog and sheet in `components/ui/`.
- **Contrast test:** read the tokens from `styles.css`, composite each glass level over white and black, and assert 4.5:1 for Paper and Mist and 3:1 for the focus ring. Keeps the CSS as the only source of the values.
- **Typeface:** add `@fontsource-variable/atkinson-hyperlegible-next` (devDependency, renderer only), remove Geist, and update the tech stack table in `docs/architecture.md`.
- **Focus ring:** one `focus-visible` style (Paper ring with a dark outer ring) used by tiles, rows and all `ui/` components.
- **Title bar:** window options from the spike. Toolbar and sidebar header become drag regions with `no-drag` on interactive children, padded by the title bar area.

### Phase 2 · Layout

- **Toolbar over the gallery:** the toolbar is positioned over the gallery's scroll container. The virtualizers get a top padding of the toolbar's height, and `scrollToIndex` / anchoring account for it (`use-virtual-anchor.ts`). The List view's sticky header sits below the toolbar.
- **Filters** popover: media kind, `DateRangeFilter` and `RatingFilter` reused inside it. The trigger shows the number of active filters among them. _Clear filters_ resets those three, not tags, library or folder.
- **View** popover: view toggle, zoom (slider and buttons), sort field and direction. Ctrl + wheel stays.
- **Sidebar polish** (no behavior change): no tag icon on every tag row, ratings as star glyphs in Star, indexer progress as a compact status block with tabular figures, Recess background.
- **Tiles:** radius and gap by zoom level, solid video badge.
- **Dates:** `formatDateTime` in `lib/format.ts` with `Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })`, used by the info panel and the List view.

### Phase 3 · Viewer

- **Backdrop:** a `glass-scrim` layer over the whole window (`backdrop-filter` blur and a dark scrim), so the gallery, toolbar and sidebar stay visible behind the item. It is a sibling of the controls, not their ancestor, so their own glass still blurs what's behind the viewer. Replaced the first version, a blurred copy of the item (REQ-013-09, deprecated). The gallery stays mounted behind it (REQ-009-01).
- **Ambient:** the placeholder's average color (`thumbHashToAverageRGBA`), converted to OKLCH and clamped to L ≤ 0.32, C ≤ 0.06, set as `--ambient` on the viewer. Its glass mixes it in with `color-mix(in oklch, …)`. Unit test for the clamp and for contrast with extreme colors.
- **Controls:** a bottom pill (`glass-bar`) with file name, date, rating and the actions (_Show in Explorer_, _Info_, _Close_), round glass previous / next buttons, and the info panel as `glass-panel`. An idle hook hides them after 2.5s, unless hovered, the info panel is open or a video is paused.
- **Transition:** tile and viewer image share a `view-transition-name` for the opened item, navigating with TanStack Router's `viewTransition`. Skipped (instant) under reduced motion, and a fade when the tile isn't mounted.

### Spec changes when implementing

- REQ-006-01: views are picked under _View_, not in the toolbar directly.
- REQ-006-06: the zoom slider and buttons are under _View_. Ctrl + wheel is unchanged.
- REQ-007-07: media kind is picked under _Filters_.
- REQ-007-08, REQ-007-09: the date and rating buttons are inside _Filters_.
- `e2e/smoke.spec.ts` locators for the moved controls (Filters and View popovers).

## Tasks

- [x] Phase 0: scroll performance and title bar spike, findings in `docs/known-pitfalls.md` (REQ-013-02, REQ-013-03)
- [x] Design tokens, glass utilities with fallbacks, contrast test from `styles.css` (REQ-013-01, REQ-013-03, REQ-013-04, REQ-013-06)
- [x] Bundled typeface, Geist removed, `docs/architecture.md` updated (REQ-013-01)
- [x] Focus ring for all controls, tiles and rows, contrast test (REQ-013-05)
- [x] Content in the title bar with drag regions and reserved window-control area, e2e check (REQ-013-02)
- [x] Toolbar over the scrolling gallery, virtualizer offsets (REQ-013-03)
- [x] _Filters_ and _View_ popovers, fits at 800 × 600, e2e locators and specs 006 / 007 updated (REQ-013-08)
- [x] Sidebar and tile polish (no REQ, no behavior change)
- [x] `formatDateTime` in the info panel and List view (REQ-013-13)
- [x] ~~Immersive viewer backdrop with crossfade (REQ-013-09)~~ replaced by the blurred window behind the viewer (REQ-013-14)
- [x] Ambient tint with clamping (REQ-013-11, REQ-013-04)
- [x] Viewer control bar with idle hiding (REQ-013-10)
- [x] Tile ↔ viewer view transition with reduced-motion and fallback paths (REQ-013-12, REQ-013-07)
- [x] README screenshots (`pnpm screenshots`), spec 013 verification table and status
