# 001 · Library management

**Status:** Implemented (retrospective spec)

## Goal

The user decides which folders make up the gallery: folders on local disks or network shares, including UNC paths that aren't mapped as drives. Libraries can be added, rescanned and removed from the Settings page. The files themselves are never touched.

## Requirements

### REQ-001-01 · Add a library by path

- **Given** an absolute path to a reachable folder that isn't a library yet
- **When** the user enters it on the Settings page and clicks _Add_
- **Then** the folder appears in the library list as `online`, labelled with the folder's name (the full path for a drive root), a full scan is queued and a toast confirms "Added <label>, indexing…"

### REQ-001-02 · Add a library with the folder picker

- **Given** the Settings page
- **When** the user clicks _Browse…_ and picks a folder
- **Then** the folder is added as in REQ-001-01
- **And** cancelling the dialog adds nothing

### REQ-001-03 · Reject invalid paths

- **Given** a relative path, or a folder that doesn't exist or isn't reachable within 5 seconds
- **When** the user tries to add it
- **Then** nothing is added and an error explains why ("Path must be absolute", "Folder not found or not reachable")

### REQ-001-04 · Reject duplicate libraries

- **Given** a library `D:\Photos`
- **When** the user adds the same path in any letter case (e.g. `d:\photos`)
- **Then** nothing is added and the error "Library already added" is shown

### REQ-001-05 · Remove a library

- **Given** a library, possibly being scanned or waiting in the scan queue
- **When** the user clicks _Remove_ and confirms that files on disk aren't touched
- **Then** the library and all its media items disappear from the gallery and the sidebar
- **And** its queued scan is dropped, a running scan is cancelled without writing anything further, and its watcher stops
- **And** no file in the library is modified or deleted

### REQ-001-06 · Rescan a library

- **Given** a library
- **When** the user clicks _Rescan_
- **Then** a full scan is queued, which also finds files that changed in place while the app wasn't running, and a toast confirms "Rescan queued"

### REQ-001-07 · Library list

- **Given** one or more libraries
- **When** the user opens the Settings page
- **Then** each library shows its label, status (`online`, `offline`, `unknown`), full path and the time it was last indexed, sorted by label
- **And** without libraries the list says "No libraries yet."

## Out of scope

- Renaming a library's label in the UI (the label is always derived from the folder name).
- Detecting nested or overlapping libraries (a library inside another one is indexed twice).
- Moving a library to a new path while keeping its index.
- Deleting a removed library's cached thumbnails right away (they are evicted from the thumbnail cache over time, see 005).
- Non-Windows paths.

## Assumptions

- Windows paths are case-insensitive, so duplicates are detected case-insensitively.
- UNC paths that aren't mapped in Explorer can't always be picked in the folder dialog, which is why typing a path stays possible.

## Verification

| REQ        | Test                                                                                                                                          | Result                                                                              |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| REQ-001-01 | `src/main/trpc/router.test.ts` › libraries › adds a reachable folder and queues a scan; `e2e/smoke.spec.ts`                                    | pass                                                                                |
| REQ-001-02 | `src/main/trpc/router.test.ts` › libraries.pickFolder › returns the chosen folder or null when cancelled                                      | partial: picking a folder then adding it is untested                                |
| REQ-001-03 | `src/main/trpc/router.test.ts` › libraries › rejects relative and missing paths                                                               | pass                                                                                |
| REQ-001-04 | `src/main/trpc/router.test.ts` › libraries › rejects duplicates case-insensitively                                                            | pass                                                                                |
| REQ-001-05 | `src/main/trpc/router.test.ts` › libraries › removes a root with its media; `src/main/indexer.test.ts` › removes roots from the queue and the worker; `src/indexer/scan.test.ts` › writes nothing when cancelled | pass                                                                                |
| REQ-001-06 | —                                                                                                                                             | no test (the `rescan` procedure is untested; scan behaviour is covered by 002)      |
| REQ-001-07 | `e2e/smoke.spec.ts` (path shown after adding)                                                                                                 | partial: status, last indexed time, sort order and empty state are untested         |
