# 003 · Change detection · Plan

Retrospective: records the approach that was taken (phase 2 notes of the former `docs/PLAN.md`, extended in commit `a6515b0`).

## Approach

- **Scan scopes** (`ScanScope` in `src/indexer/protocol.ts`): `full`, `quick`, `changes { paths }`. Every scope runs as `full` while a root has no stored folders.
- **Folder table:** `folders (root_id, rel_dir, mtime)` stores each listed folder's mtime, taken *before* listing. `quick` skips the listing of a folder whose stored mtime matches and continues with its known subfolders. Folders that failed to list store `-1`, so they are always listed again.
- **`changes` scope:** walks from the parents of the reported paths, descends only into subfolders not yet stored, and checks known files only if they or a possible sidecar (`x.jpg.xmp`, `x.xmp`) were reported. Comparison is case-insensitive, which at worst checks one file too many.
- **Watcher** (`src/indexer/watcher.ts`): one recursive `fs.watch` per root (ReadDirectoryChangesW), started by the indexer after a completed scan and stopped on `offline` or `remove`. `RootWatcher` filters housekeeping paths and debounces (2 s quiet, 10 s max). It emits paths, or `undefined` when a `null` filename signals lost events. Errors close it and report unknown changes.
- **Main:** a `changed` event becomes `requestScan(root, changes | quick)`. More than 5,000 merged paths become `quick`. A `changes` request is never treated as covered by the root's running scan.
- **Schedule** (`src/main/rescan.ts`): quick scan of all roots at startup and every `quickCheckIntervalMinutes` (`0` disables the timer). Offline roots get a quick scan every 60 s. `setInterval` re-arms the timer when the setting changes.

## Tasks

- [x] `folders` table and migration, mtime bookkeeping in `scanRoot` (REQ-003-08)
- [x] `quick` and `changes` traversal in `scanRoot` (REQ-003-04, REQ-003-08)
- [x] `RootWatcher` with debounce and housekeeping filter (REQ-003-02, REQ-003-03)
- [x] Start and stop watchers in the indexer, report `changed` to main (REQ-003-01, REQ-003-06)
- [x] Scope merging and quick-scan fallback in `IndexerController` (REQ-003-05, REQ-003-07)
- [x] `scheduleRescans` with configurable interval and offline retry (REQ-003-09, REQ-003-10)
- [ ] Tests for `scheduleRescans`, watcher lifecycle in the indexer process, and the unknown-changes fallback (REQ-003-01, REQ-003-05, REQ-003-06, REQ-003-09, REQ-003-10)
