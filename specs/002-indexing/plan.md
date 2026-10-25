# 002 · Indexing · Plan

Retrospective: records the approach that was taken (phase 2 of the former `docs/PLAN.md`).

## Approach

- **Process split:** the indexer runs as an Electron `utilityProcess` (`src/indexer/index.ts`) with its own SQLite write connection (WAL). Main runs the migrations before forking and keeps a read connection. Messages are zod-validated in both directions (`src/indexer/protocol.ts`).
- **Queue in main:** `IndexerController` (`src/main/indexer.ts`) owns the scan queue (one job per root, merged via `mergeScopes`), dispatches one scan at a time, spawns the worker lazily and respawns it after a crash. It republishes the status (`idle|scanning`, queue, progress) as a tRPC subscription.
- **Walk:** iterative depth-first `opendir` walk (`walk.ts`) that skips symlinks, housekeeping folders and dotfiles, and yields one listing per folder (files, sidecars, subfolders, folder mtime).
- **Diff:** `scanRoot` (`scan.ts`) compares `(size, mtime, sidecar_mtime, meta_version)` against the index. Changed files are read through a p-queue (I/O concurrency) with backpressure (queue ≤ 4 × concurrency). Files still `unseen` after their folder was listed are removed once the scan completes. Files below folders that failed to list are kept, and such folders are stored with mtime `-1`.
- **Writes:** `IndexWriter` (`writer.ts`) upserts batches of 250 files (plus a 2 s timer) in one transaction each, and replaces their tag links. A cancelled scan writes nothing, because the root's rows may already be gone.
- **Offline:** reachability is a `stat` of the root with a 5 s timeout. Transient errors (errno codes other than ENOENT, EACCES, EPERM, …) are retried 3× with backoff (`retry.ts`). If they persist, they trigger a reachability check that aborts the whole scan with outcome `offline`.
- **Metadata version:** `media.meta_version` vs `METADATA_VERSION` forces re-reads. `main/rescan.ts` turns a root's scheduled quick scan into a full scan while outdated rows exist.
- **Generated columns** instead of expression indexes (drizzle-kit limitation): `sort_date = coalesce(taken_at, mtime)`, `dir` (folder with trailing `/`), `file_name_lower`.
- **Tag pruning:** after each completed scan, tags without media links and without children are deleted bottom-up.

## Tasks

- [x] Indexer utilityProcess, message protocol, lazy spawn and respawn (REQ-002-13)
- [x] Media type and housekeeping filters, iterative walk (REQ-002-01, REQ-002-02)
- [x] `scanRoot` diff, batched writes, removal of vanished files and folders (REQ-002-03, REQ-002-04, REQ-002-06)
- [x] Retry with backoff, reachability checks, offline outcome (REQ-002-09, REQ-002-10)
- [x] Keep media of folders that failed to list. Unreadable metadata falls back to empty metadata (REQ-002-11, REQ-002-12)
- [x] `IndexerController` queue with scope merging and status subscription (REQ-002-07, REQ-002-08)
- [x] Sidebar progress footer and per-library spinner (REQ-002-08)
- [x] `meta_version` column, re-read and full-scan upgrade (REQ-002-05)
- [x] Tag pruning after completed scans (REQ-002-14)
- [ ] Tests for mid-scan offline, unlistable folders, unreadable files, scheduled full-scan upgrade and progress UI (REQ-002-05, REQ-002-08, REQ-002-10 – REQ-002-12)
