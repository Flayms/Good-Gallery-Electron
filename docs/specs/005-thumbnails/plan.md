# 005 · Thumbnails · Plan

Retrospective: records the approach that was taken (phase 3 of the former `docs/PLAN.md`).

## Approach

- **Rendering** (`src/indexer/thumbnail.ts`): one decode per file, resized to at most 800 × 2400 raw sRGB, then both WebP widths (quality 80) and a ThumbHash (≤ 100 px) from that buffer. `sharp.cache(false)`, so libvips doesn't keep SMB files open. Images: embedded `PreviewImage` via exiftool for JPEGs when it is large enough and has the same aspect ratio, with the original's orientation applied explicitly (`orient()`, mapping pinned by a test against `autoOrient()`). Otherwise `sharp(file, { failOn: 'none' }).autoOrient()`. Videos: `ffmpeg -ss <10 %> -i … -frames:v 1` as PNG over stdout, binary path rewritten to `app.asar.unpacked`.
- **Cache key** (`src/indexer/thumb-cache.ts`): `<userData>/thumbs/ab/cd/<sha1(rootId, relPath, size, mtime, width)>.webp`. A changed file gets a new key, so stale thumbnails are never served and are evicted over time. The sidecar mtime isn't part of the key.
- **ThumbCache** (indexer-owned): measures its size at startup (removes `*.tmp` leftovers), writes atomically (temp + rename), evicts by file mtime down to 90 % of the cap, and `clear()` deletes everything it can. Main touches a thumbnail's mtime when serving it (at most hourly) to record the view.
- **ThumbnailService** (`src/indexer/thumbnails.ts`): one p-queue with I/O concurrency. Background jobs have priority 0 and are pulled newest first in batches of 100 from `media_thumb_idx (thumb_status, sort_date)`, skipping offline roots. On-demand jobs get an increasing priority, and queued jobs are bumped via `setPriority`. When the cache is full, only requested thumbnails are written. Results are stored only if size and mtime didn't change while rendering.
- **Protocol** (`src/main/protocols.ts`): `gg-thumb://media/<id>/<width>` looks up the row, serves the cached file, or asks the indexer to render it (`IndexerController.requestThumbnail`, deduplicated) and serves it afterwards. Media with `thumb_status = 'error'` get a 404 without a new render.
- **Tile** (`components/media-tile.tsx`): ThumbHash data URL as CSS background, `<img>` fades in on load. A failure or `error` status shows `ImageOffIcon`. The width is picked with `pickThumbWidth(tileWidth, devicePixelRatio)`.

## Tasks

- [x] `renderMedia` / `renderThumbnails` with preview and video paths (REQ-005-01, REQ-005-03 – REQ-005-05)
- [x] `thumbPath` and `ThumbCache` with LRU eviction, atomic writes, startup cleanup (REQ-005-10, REQ-005-11, REQ-005-13)
- [x] `ThumbnailService` priority queue, background batches, full-cache policy (REQ-005-07, REQ-005-08, REQ-005-12)
- [x] Failure handling with reachability check, `thumb_status` (REQ-005-09)
- [x] `gg-thumb` protocol handler with on-demand rendering and view touch (REQ-005-07, REQ-005-11, REQ-005-14)
- [x] Tile placeholder, fade-in, failure icon, width picking (REQ-005-02, REQ-005-06)
- [ ] Tests for tile loading states, offline skipping, view recording and offline serving (REQ-005-06, REQ-005-08, REQ-005-11, REQ-005-14)
