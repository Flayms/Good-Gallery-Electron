# Roadmap

Ordered by priority within each section: bugs first, then features, then larger decisions. Each entry names the spec it touches (or "new spec") and its tier from [AGENTS.md](../AGENTS.md#tiers). When work starts, the entry moves into a spec in [docs/specs](specs/README.md); when it ships, remove it here.

## Bugs

_None open._

## Next

### Update detection and auto updates

- **Spec:** new · **Tier:** 3 (touches release pipeline, main process and settings)
- Tell the user when a newer release exists and install it with as little friction as possible.
- Open questions:
  - `electron-updater` against GitHub releases (fits [014-ci-release](specs/014-ci-release/spec.md)), or only a "new version available" notice with a link?
  - Silent download and install on quit, or ask first? Opt-out in settings?
  - Code signing: unsigned Windows builds trigger SmartScreen; macOS auto updates require a signed and notarized app.

### Manual tagging and rating

- **Spec:** extends [004-metadata](specs/004-metadata/spec.md) and [009-media-viewer](specs/009-media-viewer/spec.md) · **Tier:** 3 (first time the app writes to user files)
- Add and remove tags, Places and People, and set the rating, from the viewer and for a selection in the gallery.
- Write both embedded metadata and XMP sidecars.
- Open questions:
  - Default target: embedded (travels with the file, but rewrites originals and is impossible for some formats, e.g. most RAW and videos) or sidecar (safe, but lost when the file is moved without it)? A likely answer: sidecar for RAW and video, embedded otherwise, configurable per library.
  - Gallery selection model (multi-select) is a prerequisite and doesn't exist yet.
  - Libraries on read-only or offline network shares.

### Cropping and rotating

- **Spec:** new · **Tier:** 3
- Non-destructive, stored like the edits below; rotation possibly also as the EXIF orientation flag.
- Shares the edit storage decision with [Photo editing](#photo-editing), so decide that first.

## Later

### Faces

- **Spec:** new · **Tier:** 3
1. Show face regions already embedded in files (MWG / Microsoft regions, already read for People tags) as boxes in the viewer, toggleable.
2. Face detection and recognition (as in digiKam): detect faces, cluster them, let the user name clusters, write the names back as face regions (depends on [Manual tagging](#manual-tagging-and-rating)).
- Open questions: model and runtime (ONNX in the indexer process?), where embeddings live (index database), performance on 500k files.

### Photo editing

- **Spec:** new · **Tier:** 3
- Non-destructive: edits are stored as parameters (index database, sidecar, or both), the original stays untouched; thumbnails and the viewer show the edited result; export writes a new file.
- Light: exposure, contrast, highlights, shadows, whites, blacks
- Curves (RGB and per channel)
- Color: white balance (temperature, tint), vibrance, saturation
- Effects: grain, vignette
- Open questions: GPU rendering in the renderer (WebGL / WebGPU) vs. sharp in the indexer; compatibility with other tools' sidecars (e.g. darktable, Lightroom XMP `crs:` tags).

### macOS and Linux

- **Spec:** new · **Tier:** 3
- Build, package and test on both (CI runners, e2e).
- Known gaps: Window Controls Overlay on macOS is unverified (see [known pitfalls](known-pitfalls.md)), _Show in Explorer_ wording (REQ-009-10), native dependencies (sharp, exiftool, ffmpeg) per platform, signing and notarization.

## Decisions to make

### Migrate to Rust (egui / eframe on wgpu)?

- **Tier:** 3 (rewrite), needs a decision record before any plan.
- Questions to answer first: what problem does it solve (memory, startup, scroll performance at high zoom, distribution size)? Can that be measured and fixed in the current stack? What do we lose (shadcn UI, glass via `backdrop-filter`, view transitions, Playwright e2e)?
- If yes, a workspace split along the existing process boundaries is natural: `core` (domain, index database), `indexer` (scan, metadata, thumbnails), `app` (egui UI). More crates only where compile times or reuse demand it.
- Should come before large new features, otherwise they are built twice.
