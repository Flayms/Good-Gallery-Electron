# 008 · Sidebar · Plan

Retrospective: records the approach that was taken (phases 5 and 8 of the former `docs/PLAN.md`).

## Approach

- **Structure** (`components/app-sidebar.tsx`): shadcn `Sidebar`. The header holds the app name. The content holds the libraries (with the folder tree of the active one), then `SidebarTags` (People, Places, Ratings, Tags). The footer holds the indexer progress (002) and the Settings link. Every entry is a router `Link` that patches the URL search, so filters are shareable state and Back works.
- **Folders:** `libraries.folders` groups media by the generated `dir` column over the `(root_id, dir)` index (folders with direct media only, ~50 ms for 350k media, so only for the selected library). `lib/folders.ts` adds intermediate folders, sums counts upwards and sorts with `Intl.Collator({ numeric: true, sensitivity: 'base' })`.
- **Categories by name, not by column:** `TAG_CATEGORY_ROOTS` (`src/shared/tags.ts`) lists normalized root aliases. `src/main/db/tag-categories.ts` uses recursive CTEs for `categoryTags` (tree rows with subtree counts, parent `null` directly under a root), `categorizedTagIds` (excluded from `tags.popular`) and `categoriesOf` (used by the info panel, 009). `lib/tag-tree.ts` builds the tree in the renderer.
- **Ratings:** `media.ratingCounts` groups by `coalesce(rating, 0)` over all libraries.
- **Collapsible groups** (`components/collapsible-sidebar-group.tsx`): open state in `localStorage` (`sidebar.group.<id>`), wrapped in try/catch since it's only a convenience.
- **shadcn caveat:** `SidebarMenuBadge` only positions correctly next to a `SidebarMenuButton`, so nested folder and tag levels show counts in the tooltip instead (see `docs/known-pitfalls.md`).

## Tasks

- [x] Library list with status icons, badges and spinner (REQ-008-01)
- [x] `libraries.folders`, `buildFolderTree`, `FolderTree` (REQ-008-02)
- [x] Tag category roots, `tags.category`, `TagTree` with preview and _Show all_ (REQ-008-03)
- [x] `media.ratingCounts` and `SidebarRatings` (REQ-008-04)
- [x] `tags.popular` without categorized tags, `PopularTags` (REQ-008-05)
- [x] Include/remove toggling via `withTag` / `withoutTag` (REQ-008-06)
- [x] `CollapsibleSidebarGroup` with persisted state (REQ-008-07)
- [ ] Component tests for sidebar navigation, tag toggling, rating toggling and collapsed state (REQ-008-01 – REQ-008-04, REQ-008-06, REQ-008-07)
