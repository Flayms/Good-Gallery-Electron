# AGENTS.md

A desktop gallery for large photo and video libraries (50k–500k files). Media appear in a virtualized masonry, justified, grid or list view. Libraries on network shares are supported, and thumbnails are cached locally. Search uses the tags that are already embedded in your files.

## Orientation

| Document                 | Why                                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `README.md`              | User facing description. Keep up to date with screenshots.                                                        |
| `docs/architecture.md`   | Architecture overview                                                                                             |
| `docs/design.md`         | Visual design: principles, tokens, surfaces, type, motion, writing. Read before any UI work                       |
| `docs/glossary.md`       | Definitions of domain terms                                                                                       |
| `docs/roadmap.md`        | Upcoming features and bug reports.                                                                                |
| `docs/known-pitfalls.md` | if you encounter problems or pitfalls add them here, either to avoid them in the future or for us to fix later on |
| `docs/specs/README.md`   | Index of feature specs with their status, conventions and template                                                |

## Project

- Stack: Electron + electron-vite, React, TanStack, shadcn/ui, tRPC over IPC, SQLite (better-sqlite3 + Drizzle), sharp / exiftool / ffmpeg. Details in `docs/architecture.md`.
- Test: `pnpm test` (e2e: `pnpm test:e2e`) · Lint: `pnpm format` + `pnpm typecheck` + `pnpm check:specs` · Run: `pnpm dev` · Release: `pnpm release` (conventional commits, see `README.md`)

## Principles

> [!NOTE]
> These are no absolutes, decide when it's appropriate to apply them.

- Follow SOLID principles: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion.
- Decide when it's appropriate to apply DRY, YAGNI and KISS.
- spec-first, TDD (red → green → refactor), BDD acceptance criteria. DDD only where the domain warrants it; always use domain terms (`docs/glossary.md`).

## Tiers

0. No behavior change → tests pass.
1. Bug (code violates a REQ) → regression test referencing the REQ, then fix.
2. Small feature or spec gap → `spec.md` first. A wrong or missing spec is a spec change, not a bug.
3. Large or architectural → `spec.md` + `plan.md` (with tasks); wait for approval before implementing.

## Specs

`docs/specs/NNN-name/`. IDs are `REQ-NNN-XX`: never reused, deprecated rather than deleted, and referenced in tests. Spec and code change together.

- `spec.md`: Status, Goal, Requirements (Given/When/Then), Out of scope, Assumptions, Verification (REQ | test | result). No implementation details.
- `plan.md`: Approach, Tasks (linked to REQs).

## Definition of Done

- Every REQ in scope has a test that you saw fail, then pass.
- Full test suite and lint run in this session and pass.
- Verification table and spec status updated.
- No unrelated changes.
- Summary: tier, REQs touched, results, open issues.

## Git

Stay on the current branch. commit or push only if explicitly asked for.
