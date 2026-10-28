# Roadmap

- Update detection and auto updates for the app.
- still no license key and I dont wanna pay for one
- publish in microsoft store

### Manual tagging and rating

- **Spec:** extends [004-metadata](specs/004-metadata/spec.md) and [009-media-viewer](specs/009-media-viewer/spec.md) · **Tier:** 3 (first time the app writes to user files)
- Add and remove tags, Places and People, and set the rating, from the viewer and for a selection in the gallery.
- Write both embedded metadata and XMP sidecars.
- Open questions:
  - Default target: embedded (travels with the file, but rewrites originals and is impossible for some formats, e.g. most RAW and videos) or sidecar (safe, but lost when the file is moved without it)? A likely answer: sidecar for RAW and video, embedded otherwise, configurable per library.
  - Gallery selection model (multi-select) is a prerequisite and doesn't exist yet.
  - Libraries on read-only or offline network shares.

### Cropping and rotating

- Non-destructive, stored like the edits below; rotation possibly also as the EXIF orientation flag.
- Shares the edit storage decision with [Photo editing](#photo-editing), so decide that first.

### Faces

1. Show face regions already embedded in files (MWG / Microsoft regions, already read for People tags) as boxes in the viewer, toggleable.
2. Face detection and recognition (as in digiKam): detect faces, cluster them, let the user name clusters, write the names back as face regions (depends on [Manual tagging](#manual-tagging-and-rating)).
- Open questions: model and runtime (ONNX in the indexer process?), where embeddings live (index database), performance on 500k files.

### Photo editing

- Non-destructive: edits are stored as parameters (index database, sidecar, or both), the original stays untouched; thumbnails and the viewer show the edited result; export writes a new file.
- Light: exposure, contrast, highlights, shadows, whites, blacks
- Curves (RGB and per channel)
- Color: white balance (temperature, tint), vibrance, saturation
- Effects: grain, vignette
- Open questions: GPU rendering in the renderer (WebGL / WebGPU) vs. sharp in the indexer; compatibility with other tools' sidecars (e.g. darktable, Lightroom XMP `crs:` tags).
- what about color profiles / bit depth? what errors did gimp do, what can we do better?

-mac and linux support

- Photos should be openable with this gallery over windows context menu
  - what about mac and linux for this

---

- light mode
- no backend wasm browser version hosted on github pages
- find more native alternative to exiftool for rust
- what dependencies can we remove to make the bundle smaller?
  - exiftool - is there something that works natively in Rust?
  - ffmpeg - is there a native Rust alternative for video processing?
  - libmpv - can we replace it with a Rust-native video player?
- I want that development of this app is also possible on a linux (ubuntu) machine. what do we need to change?
- known pitfalls got huge. what of it can / should we tackle, what information should be in other places instead?
- I wanna be able to scroll by holding the mousewheel and then moving the cursor up / down like in a browser. current scroll works but differently than in a browser. if you need more help understanding what I mean, ask me
- show amount of photos right next to each libraries name in the sidebar / next to each folder within a library
- sidebar should be closable
- the star icon for the ratings should be filled out stars (not an outlined star)
