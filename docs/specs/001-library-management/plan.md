# 001 · Library management · Plan

Retrospective: records the approach that was taken (phases 1, 2 and 6 of the former `docs/PLAN.md`).

## Approach

- `library_roots` table (`id`, `path` unique, `label`, `status` `unknown|online|offline`, `last_scan_at`). Media, folders and their tag links reference it with `ON DELETE CASCADE`, so removing a root is a single delete.
- tRPC `libraries` router in main: `list`, `add`, `remove`, `rescan`, `pickFolder`. Paths are validated in main (`isAbsolute`, `resolve`, reachability via a `stat` with a 5 s timeout so a dead share can't hang the call). Duplicates are checked with `lower(path)`.
- Native calls (`shell.showItemInFolder`, `dialog.showOpenDialog`) go through a `Desktop` interface in the tRPC context, so router tests can fake them.
- `add` inserts the root as `online` and asks `IndexerController.requestScan(id, { mode: 'full' })`. `remove` deletes the row and calls `IndexerController.removeRoot`, which drops the queued job and sends `remove` to the indexer (aborts the scan, closes the watcher). A cancelled scan writes nothing, because its rows are already gone.
- UI: `components/library-settings.tsx` on `/settings`. The path field stays next to _Browse…_ for UNC shares that the dialog can't reach. Removing invalidates media, layout and tag queries.

## Tasks

- [x] Schema and migration for `library_roots` (REQ-001-01, REQ-001-07)
- [x] `libraries.add` with validation, duplicate check and full scan request (REQ-001-01, REQ-001-03, REQ-001-04)
- [x] `libraries.pickFolder` via `Desktop.pickFolder` (REQ-001-02)
- [x] `libraries.remove` with cascade and `IndexerController.removeRoot` (REQ-001-05)
- [x] `libraries.rescan` queuing a full scan (REQ-001-06)
- [x] Settings UI: form, _Browse…_, list with status badge, last indexed time, rescan and remove with confirmation (REQ-001-01 – REQ-001-07)
- [ ] Tests for `libraries.rescan`, the picker-to-add flow and the list UI (REQ-001-02, REQ-001-06, REQ-001-07)
