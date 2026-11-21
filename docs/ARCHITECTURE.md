# Architecture

## Process model

```
┌─────────────────────────────────────────────┐  IPC (invoke)   ┌────────────────────────────────┐
│ WebView (React 19, Vite bundle)            │ ──────────────▶ │ Tauri host (Rust)              │
│  pages/  components/  store.ts  hooks.tsx  │ ◀────────────── │  lib.rs → 70 commands          │
└─────────────────────────────────────────────┘   events        │  engine / queue / library …    │
                                                                └───────────┬────────────────────┘
                                                                            │ spawn + stream JSONL
                                                                ┌───────────▼────────────────────┐
                                                                │ codex exec --json              │
                                                                │  CODEX_HOME = ARIA profile     │
                                                                │  built-in image_gen tool       │
                                                                └───────────┬────────────────────┘
                                                                            │ writes files
                                                                ┌───────────▼────────────────────┐
                                                                │ $CODEX_HOME/generated_images/  │
                                                                │ <session>/<call>.png|.gif      │
                                                                └────────────────────────────────┘
```

The frontend never touches the file system directly. It calls typed wrappers in `@aria/core`, which forward to
registered Tauri commands. Images are displayed through the Tauri asset protocol (`convertFileSrc`) with an explicit
CSP allowance; in a browser preview the same helpers fall back to plain paths.

## Backend modules

| Module | Responsibility |
| --- | --- |
| `paths.rs` | Single source for `%LOCALAPPDATA%/ARIA/ImageStudio` layout, per-profile CODEX_HOME, sanitisation |
| `settings.rs` | Typed settings with atomic save; theme/language/engine defaults |
| `db.rs` | Connection (WAL, FK), schema bootstrap, JSON row mapping helpers |
| `security.rs` | Redaction, DPAPI protect/unprotect, ACL hardening, secure delete |
| `codex.rs` | Locate CLI (PATH, npm, WinGet, `.codex`), shim `.cmd` via cmd.exe, version, login status, skill install, model cache |
| `auth.rs` | Profile folders, auth.json import/replace/delete, vault backup, login/logout process streaming |
| `engine.rs` | Builds the engine instruction, runs `codex exec`, streams events, snapshots `generated_images`, imports results |
| **`queue.rs`** | Durable job table, worker pool, retry/backoff, cancel, pause, interruption recovery |
| `imageops.rs` | Decode/encode, resize, brightness/contrast/saturation, sharpen, median denoise, chroma key, hashing |
| `library.rs` | Projects, gallery queries, prompts + versions, references, post-process derivatives, bulk rename |
| `analytics.rs` | Aggregates + daily series + JSON export |
| `registry.rs` | Sync/read/summary/export of the 300-row feature matrix |
| `diagnostics.rs` | Installation checks, redacted report, markdown/JSON export |
| `updates.rs` | Reads GitHub `releases/latest`, compares versions, never auto-executes installers |
| `fsbrowse.rs` | In-app folder picker roots/listing for dialogs |

## Generation flow (synchronous "Generate now")

1. UI builds a `GenerationRequest` (original prompt, final structured prompt, negatives, aspect, references, engine flags).
2. `lib.rs` resolves the active profile → `CODEX_HOME`; inserts a `generations` row (`running`).
3. `engine.rs` snapshots `generated_images`, composes the instruction:
   *use the built-in image generation tool; do not write scripts; do not use an API key; produce the image and finish.*
4. `codex exec --json --skip-git-repo-check -C <work> [-m model] [-s sandbox] [-i ref …] --` is spawned; stdout JSONL is
   parsed line by line and re-emitted as `aria://generation-line` events after redaction.
5. On exit, the snapshot is diffed; new PNG/GIF files are imported: hashed, probed, thumbnailed, moved into
   `Projects/<slug>/Generated`, inserted into `images`, linked to the generation.
6. The `generations` row is finalised with status, duration, result count, error and exit code.

## Queue

`queue.rs` keeps jobs in SQLite (`jobs`), with `queued → running → succeeded|failed|cancelled`, attempts and priority.
A worker pool of `settings.max_concurrent_jobs` (1–4) pulls work, writes `job_events`, and re-queues interrupted jobs on
boot. Cancel kills the Codex process tree (`taskkill /T /F` on Windows).

## Database schema (summary)

`profiles`, `projects`, `jobs`, `job_events`, `generations`, `images`, `reference_assets`, `prompts`,
`prompt_versions`, `workflows`, `workflow_runs`, `tags`, `feature_registry`, `diagnostics`, `settings_kv`,
`analytics_events`.

Credentials are **not** part of the schema. Only profile metadata and status strings are stored.

## Frontend structure

- `store.ts` — Zustand: boot payload, settings, route, toasts, command palette, help drawer, cross-page handoff
  (image id/path/prompt).
- `lib/hooks.tsx` — TanStack Query hooks (`useGallery`, `useJobs`, `useProjects`, `usePrompts`, `useWorkflows`,
  `useAnalytics`, `useTimeseries`, `useRegistrySummary`, `useModels`, `useReferences`) and `useAction`, a mutation
  wrapper with toasts and cache invalidation.
- `components/shell.tsx` — sidebar/topbar, command palette (Ctrl/Cmd+K), help drawer, runtime gate, thumbnail,
  and `PickerField` (in-app file/folder picker).
- `pages/*` — 20 workspaces, one per route in `App.tsx`.

## Design system

`packages/ui` ships an inline 66-icon SVG set, buttons (primary/ghost/outline/danger/success; sm/lg/icon), cards,
inputs, select, toggle, slider, badges, stat tiles, tabs, modal, toasts, code block, spinner, progress bar,
before/after compare slider, zoomable lightbox and the file picker modal. All styling is CSS modules + tokens in
`theme.css`; no CSS framework.
