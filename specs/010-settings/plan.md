# 010 · Settings · Plan

Retrospective: records the approach that was taken (phase 6 of the former `docs/PLAN.md`).

## Approach

- **Schema** (`src/shared/settings.ts`): one zod object (`thumbCacheGiB`, `quickCheckIntervalMinutes`, `ioConcurrency`) and `DEFAULT_SETTINGS`, shared by main (validation) and renderer (types).
- **Storage** (`src/main/settings.ts`): `settings (key, value JSON)` table. `SettingsStore` validates each stored key on load (invalid → default), validates the merged patch on update, writes all keys in one transaction and emits `change(next, previous)`.
- **Applying changes** (`src/main/index.ts`): the interval re-arms the rescan timer (`RescanScheduler.setInterval`). Cache cap and concurrency go to a running indexer as a `configure` message: p-queue concurrency, exiftool `setMaxProcs`, `ThumbCache.setMaxBytes` (evicts if over). A newly spawned indexer reads the current settings at spawn time, so `configure` is never sent without a worker.
- **Cache usage and clear:** the indexer owns the cache, so `settings.cacheUsage` / `settings.clearCache` are request/response messages (`cache` with a `requestId`) answered with the size in bytes. They fail when the worker exits.
- **UI** (`components/general-settings.tsx`): presets plus the current value (`withCurrent`). The concurrency slider shows the dragged value locally and commits on release. Usage is polled every 10 s, and a cap change invalidates it.

## Tasks

- [x] Settings schema, table, `SettingsStore` with fallback to defaults (REQ-010-01, REQ-010-02)
- [x] `settings.get` / `settings.update` (REQ-010-01, REQ-010-02)
- [x] Wiring of `change` to the rescan timer and `IndexerController.configure` (REQ-010-03 – REQ-010-05)
- [x] `cache` request/response, `settings.cacheUsage` / `settings.clearCache` (REQ-010-06)
- [x] Settings UI sections _Indexing_ and _Thumbnail cache_ (REQ-010-03 – REQ-010-06)
- [ ] Tests for the interval change and the concurrency slider (REQ-010-03, REQ-010-04)
