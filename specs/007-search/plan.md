# 007 · Search · Plan

Retrospective: records the approach that was taken (phases 4, 5 and 8 of the former `docs/PLAN.md`).

## Approach

- **URL as state** (`lib/search.ts`): zod-validated search params on the pathless `_gallery` route: `root`, `folder`, `kind`, `name`, `sortBy`, `dir`, `tags`, `exclude`, `from`, `to` (inclusive local days `YYYY-MM-DD`), `rating`. `mediaSearchInput` maps them to the `media.layout` input (half-open ms range, folder only with root). Hash history keeps navigation inside the document.
- **Query** (`src/main/trpc/routers/media.ts`): one `WHERE` built from the filters. Folder = range on the generated `dir` column (`dir >= 'a/b/' AND dir < 'a/b0'`). Name = `instr(file_name_lower, lower(?))`. Rating `0` = `IS NULL`. Sort columns have composite indexes with `id` as tie-breaker. `path` sorts on `(root_id, rel_path)`.
- **Tag conditions** (`src/main/db/tag-search.ts`): each tag expands to its subtree (recursive CTE, `UNION` so parent cycles terminate). The estimate is the sum of `tags.media_count`. The query shape is picked per search: the rarest tag (≤ 5k) drives via `media.id IN (…)`. Otherwise the sort index is walked with `+media.id IN (…)` (≤ 100k) or `EXISTS` with `+tag_id`. The unary `+` operators pin the plans (see `docs/known-pitfalls.md`). Benchmarked on 500k synthetic media, 2k tags, 1M links: p95 1.4 ms without filters, 0.8–36 ms with tag combinations.
- **Autocomplete** (`tags.autocomplete`): range scan on the unique `name_norm` index (`>= prefix AND < prefix || U+10FFFF`), counts summed over the subtree, `HAVING count > 0` hides tags that are only pruned after the next scan.
- **UI:** `components/tag-search.tsx` (cmdk `Command` with `shouldFilter={false}`; the highlighted item is controlled because cmdk highlights before async suggestions arrive), `date-range-filter.tsx` (popover with native date inputs), `rating-filter.tsx` (multi toggle group), sort select and direction button in `gallery-toolbar.tsx`.

## Tasks

- [x] Search params schema and `mediaSearchInput` (REQ-007-10, REQ-007-13)
- [x] Generated `dir` / `file_name_lower` columns, indexes, sort orders (REQ-007-10, REQ-007-12)
- [x] `tagConditions` with subtree expansion and adaptive plans, `media_count` triggers (REQ-007-01 – REQ-007-03, REQ-007-14)
- [x] `tags.autocomplete` with descendant counts (REQ-007-04)
- [x] Search bar with chips, include/exclude, file name option, keyboard handling (REQ-007-05, REQ-007-06)
- [x] Kind toggle, date range, rating filter, sort controls (REQ-007-07 – REQ-007-09, REQ-007-12)
- [ ] Tests for search bar interactions, filter combinations and URL persistence across reloads. Commit the benchmark as an opt-in test (REQ-007-05, REQ-007-11, REQ-007-13, REQ-007-14)
