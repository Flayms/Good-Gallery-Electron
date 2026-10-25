# 004 · Metadata · Plan

Retrospective: records the approach that was taken (phases 2 and 8 of the former `docs/PLAN.md`).

## Approach

- **exiftool-vendored** with a pool of `-stay_open` processes (`maxProcs` = I/O concurrency, 60 s task timeout). File and sidecar are read in parallel, then reduced by the pure functions `extractMetadata` / `extractTags` (`src/indexer/metadata.ts`), which the unit tests cover.
- **Source order:** embedded tags first, sidecar second, for dates and rating. Tags from both are merged. Dimensions and duration come from the file only.
- **Tags as paths:** every tag is a path, outermost first, and flat keywords are one-element paths. Paths are deduplicated by their normalized key. Flat keywords that appear in any hierarchy or face region are dropped.
- **Storage:** `tags (name, name_norm unique, parent_id)` plus `media_tags`. `IndexWriter` resolves a path to the leaf id, creating missing tags. It links a parent only if the tag has none yet and the link doesn't create a cycle. `tags.media_count` (direct links) is maintained by triggers (custom migration, since drizzle-kit can't model triggers).
- **Normalization** (`src/shared/tags.ts`): `cleanTag` = NFKC + trim + collapse whitespace (display). `normalizeTag` = `cleanTag` + lower case (identity).
- **Face regions:** `PersonInImage`, MWG `RegionName`/`RegionType`, Microsoft `RegionPersonDisplayName`, all mapped to `People|<name>` (`PEOPLE_TAG_ROOT`).
- **Versioning:** `METADATA_VERSION` (`src/shared/metadata.ts`) is stored per row. Bump it with every extraction change (see `docs/known-pitfalls.md`).
- **Sidecar matching** (`findSidecar` in `walk.ts`): the folder listing collects `.xmp` names lower-cased and prefers `<file>.<ext>.xmp` over `<file>.xmp`.

## Tasks

- [x] exiftool pool and `extractMetadata` for dimensions, date, duration (REQ-004-02 – REQ-004-04)
- [x] Rating extraction (MWG composite `Rating`) and `media.rating` (REQ-004-05)
- [x] Flat keywords and hierarchies, `extractTags` (REQ-004-06, REQ-004-07)
- [x] Tag tables, parent links with cycle protection, `media_count` triggers (REQ-004-07, REQ-004-08)
- [x] Face regions as `People` tags (REQ-004-09)
- [x] Sidecar discovery and merge, sidecar mtime in change detection (REQ-004-10)
- [x] `cleanTag` / `normalizeTag` (REQ-004-11)
- [ ] Tests for video rotation and sidecar name preference (REQ-004-02, REQ-004-10)
