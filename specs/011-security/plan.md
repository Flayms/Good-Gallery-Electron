# 011 · Security · Plan

Retrospective: records the approach that was taken (phases 1 and 3 of the former `docs/PLAN.md`).

## Approach

- **Window** (`src/main/index.ts`): `contextIsolation`, `sandbox`, no `nodeIntegration`, `webSecurity`. The preload must be CJS (`index.cjs`) for the sandbox. It exposes only `window.api.trpc` (`send` / `onMessage` on one IPC channel) via `contextBridge`.
- **Navigation** (`src/main/security.ts`): the renderer uses hash history, so a real `will-navigate` is always foreign and is prevented, as are `will-redirect` and `will-attach-webview`. `setWindowOpenHandler` denies everything and hands `https:` URLs to `shell.openExternal`. Permission request and check handlers allow only `fullscreen` for trusted URLs.
- **Trusted page:** `isTrustedRendererUrl` accepts the dev server origin (unpackaged builds with `ELECTRON_RENDERER_URL`) or the packaged `index.html` file URL.
- **tRPC over IPC:** own link, because `electron-trpc` only supports tRPC v10 and `trpc-electron` is unmaintained. `src/shared/trpc-ipc.ts` defines the protocol (request / stop; data / started / stopped / error). `src/main/trpc/ipc-server.ts` is transport-agnostic and tested in-process. `ipc-main.ts` wires it to Electron: main-frame and trusted-URL check, zod-validated envelope, disconnect (abort all) on main-frame navigation or `destroyed`. `src/renderer/src/lib/ipc-link.ts` is the client link. superjson is the transformer.
- **Custom protocols** (`src/shared/media-urls.ts`, `src/main/protocols.ts`): privileged standard schemes with a fixed `media` host (numeric hosts would be canonicalized as IPv4), strict parsing (id regex, known widths, no query or hash), lookup by id only.
- **CSP** in `src/renderer/index.html`: `default-src 'self'`, `img-src`/`media-src` limited to `self`, `data:`/`blob:` and the two schemes. `object-src`, `frame-src`, `base-uri` and `form-action` set to `'none'`.

## Tasks

- [x] Hardened `BrowserWindow`, CJS preload with minimal API (REQ-011-01)
- [x] Navigation, window-open and permission handlers (REQ-011-02, REQ-011-05)
- [x] tRPC IPC protocol, server, Electron wiring and client link (REQ-011-03, REQ-011-07)
- [x] `gg-thumb` / `gg-media` URL scheme with id-only resolution (REQ-011-04)
- [x] Content Security Policy (REQ-011-06)
- [ ] Tests for the IPC sender check, navigation and permission handlers (REQ-011-02, REQ-011-03, REQ-011-05)
