# PROJECT-STATUS — ARIA Image Studio

_Last updated: 2026-11-21 · version 1.1.0_

This file is the honest engineering ledger. It distinguishes **written**, **type-checked**, **built** and **tested**.

## 1. Verification ledger

| Area | Written | Type-checked | Production bundle | Runtime-tested |
| --- | --- | --- | --- | --- |
| `packages/ui` design system | ✅ | ✅ | ✅ | ⏳ via app shell |
| `packages/core` IPC bridge | ✅ | ✅ | ✅ | ⏳ needs desktop runtime |
| `packages/prompt-engine` | ✅ | ✅ | ✅ | ✅ pure functions |
| `packages/feature-registry` | ✅ (300 rows) | ✅ | ✅ | ✅ integrity checks |
| `apps/desktop` 20 pages | ✅ | ✅ | ✅ | ⏳ needs desktop runtime |
| `apps/desktop/src-tauri` (Rust, ~70 commands) | ✅ | ✅ `cargo check` green on CI | ✅ release profile | ⏳ needs signed-in account |
| Windows installer (NSIS) | ✅ | — | ✅ built on `windows-latest` | ⏳ install test pending |
| Portable x64 EXE | ✅ | — | ✅ built on `windows-latest` | ⏳ smoke test pending |

`npm run typecheck` and `npm run build` pass locally (Vite, 114 modules, no type errors). The Rust crate compiles and
bundles on GitHub Actions `windows-latest`: `cargo check` is green, `tauri build --bundles nsis` produces the installer,
and the portable executable is copied next to it (run `44897534932`, branch `arena/7388aaac-ariaimagestudio`). What is
still pending is a signed-in manual pass on a real Windows machine — that is the only reason the runtime column is ⏳.

## 2. What ships in v1.0.0

- 20 workspaces: Welcome, Authentication, Dashboard, Create, Edit, Variations, Gallery, Prompt Studio, Prompt Library,
  Batch Studio, Workflow Builder, Projects, AI Engine, Model Settings, Codex Configuration, Accounts, History,
  Analytics, Preferences, Diagnostics.
- Rust backend modules: `auth`, `codex`, `engine`, `queue`, `library`, `imageops`, `analytics`, `registry`,
  `diagnostics`, `updates`, `fsbrowse`, `security`, `settings`, `db`, `paths`, `error`.
- SQLite schema: profiles, projects, jobs, job_events, generations, images, reference_assets, prompts, prompt_versions,
  workflows, workflow_runs, tags, feature_registry, diagnostics, settings_kv, analytics_events.
- 300-row feature registry, synced into SQLite on first boot (`counts.features === 0`) and re-syncable from
  Diagnostics.

## 3. Feature counts (generated from the registry)

| Status | Count |
| --- | --- |
| Tested | 23 |
| Implemented | 243 |
| Partially implemented | 29 |
| Unsupported by engine | 5 |
| **Total** | **300** |

Registry integrity: 300/300 rows, 0 duplicate ids. Full detail in [FEATURES-300.md](./FEATURES-300.md).

## 4. Deliberate non-features

| Capability | Why it is not offered |
| --- | --- |
| API-key mode / `OPENAI_API_KEY` | Contradicts the product contract; the account session is the only engine path |
| Alternative API fallback | Would silently change billing and privacy — explicitly forbidden |
| Model / size / seed / quality selectors for images | The built-in `image_gen` tool exposes none of these; inventing them would be fake UI |
| Masked inpainting | Not exposed by the tool; labelled Unsupported |
| OCR-based wrong-text detection | No OCR engine is wired; labelled Unsupported |
| Cloud sync / telemetry | No server exists; ARIA is local-first |

## 5. Known risks before public release

1. **Signed-in runtime pass** — generation, editing and queue behaviour depend on a real Codex account and cannot be
   exercised in CI. This is the remaining gate before calling the flows "Tested".
2. **Codex CLI variance** — flags are pinned to current `codex exec` (`--json`, `-C`, `-s`, `-i`, `-m`); a future CLI
   change could require `codex.rs` updates. Diagnostics surfaces version drift.
3. **Account-dependent output** — image generation requires a signed-in account with image access; ARIA cannot test
   that in CI without credentials, so end-to-end generation is manually verified only.
4. **Model discovery** — reads `<CODEX_HOME>/models_cache.json | models.json`; the app-server `model/list` RPC is not
   implemented, hence the "partial" label.

## 6. Next steps

1. Push the branch, run the Windows workflow, fix compiler findings, attach artifacts.
2. Tag `v1.0.0`, publish NSIS installer + portable EXE.
3. Perform a signed-in manual pass across Create → Edit → Variations → Batch → Workflow, then upgrade the 23 Tested
   rows to cover the corresponding flows.

## v1.1.0 — Persian light redesign

- Persian presentation across all 20 pages, 300 Persian feature names (stable IDs and honest canonical statuses unchanged), RTL, bundled Peyda, conversational creation surface.
- Legacy preferences migrate to Persian/RTL/light without deleting user data.
- Central Windows child-process policy applies `CREATE_NO_WINDOW`; includes a Windows-only real-child console-handle regression test.
- Local: TypeScript check, Vite production bundle and 36 Vitest assertions pass (including server-render smoke checks for all 20 pages).
- Redesign base commit `0aa6370`: Windows `cargo check`, real-child console-handle test, NSIS installer and portable bundle all passed in CI run `44903480327`. Final tag `v1.1.0` at `5461ca8` also passed the full Windows pipeline in run `44904005306`, including all 36 JS tests, the real-child console test, packaging and publication.
- Installed Windows tab-by-tab visual check and authenticated generation/edit remain unverified; no claim of end-to-end runtime verification.
- Technical logs, model IDs, paths and engine prompt contents retain their original language.
- See `docs/RELEASE-1.1.0.fa.md` for user instructions and font provenance/licensing caveat.

### Published v1.1.0 assets

Release: https://github.com/ariaghirarena/ARIAImageStudio/releases/tag/v1.1.0

- `ARIA-Image-Studio-1.1.0-setup.exe` — 2,506,103 bytes
- `ARIA-Image-Studio-1.1.0-portable.exe` — 6,004,224 bytes
- `SHA256SUMS.txt` — 203 bytes

Tag pipeline: https://github.com/ariaghirarena/ARIAImageStudio/actions/runs/44904005306 (success). No signed-in generation or installed tab-by-tab visual test was performed.

## v1.1.1 — import personal images

- Added local image picker to Gallery, Edit and Create. In Create, imported images become references; in Edit they become the selected source immediately.
- Import copies into the managed Gallery/Imported folder, decodes before indexing, generates a thumbnail, and records dimensions/hash/origin. Original files are not indexed directly and are never removed by Gallery deletion.
- Accepts supported raster formats, maximum 100 MiB, validates project IDs and cleans managed copies after validation/DB failures.
- Rust regression test covers real image import, unique copies, thumbnails, invalid project, corrupt-image cleanup and source preservation after deleting the imported record. Passed on Windows CI run `44906576859` (tag `v1.1.1`, commit `50ee39f`).
- Frontend typecheck, production build and 36 JS tests passed locally. Installed Windows interactive picker and authenticated image editing remain unverified.

Published v1.1.1: https://github.com/ariaghirarena/ARIAImageStudio/releases/tag/v1.1.1 — NSIS 2,510,376 bytes; portable 6,019,584 bytes. Full tag CI succeeded, including 36 JS tests and Rust import/source-preservation and hidden-console tests.

## v1.1.2 — Windows Codex launch path fix

User-reported failure: cmd truncated the executable path at a space in the Windows user folder (`'C:\Users\PARDAZESH' is not recognized`). Removed manual `cmd /C` wrapping. Official npm installs now run the package's `bin/codex.js` through Node with a native argument vector; custom batch launchers use Rust's Windows batch quoting. Quoted manual executable settings are accepted. Exit code messages no longer display Rust's `Some(1)` debug representation.

Verified: 36 JavaScript tests, frontend build, Windows cargo check, Rust tests including npm-prefix paths with spaces, literal multiline Persian prompts with quotes/metacharacters, custom batch path with spaces, hidden-console and personal-image import regressions. Full tag pipeline `44911158790` succeeded at `9e760a0`; release `v1.1.2` published. This verifies process launching with fixtures, not generation under the user's real account.

Release: https://github.com/ariaghirarena/ARIAImageStudio/releases/tag/v1.1.2

## v1.1.3 — Create memory and cancellation

- Keep Create mounted across tab navigation; requests and async responses remain attached to the same conversation. Hidden Create shortcuts are disabled and handoffs are applied on re-entry.
- Save the most recent 200 conversation messages, draft, references and generation options in local WebView storage. On restart, pending messages become interrupted (not falsely still running). This is UI conversation persistence, not automatic semantic conversation context sent to Codex.
- Add confirmed clear-chat action (does not delete saved images).
- Direct generations now carry a frontend-generated unique job ID. Cancel uses the same backend cancellation flag and existing Windows process-tree termination. UI waits for completion before enabling another request; late finished images remain in gallery.
- Local: typecheck, production build and 40 tests pass. New Windows Rust regression exercises cancellation of a real long-running process. Tag CI `44913277252` passed at `f58bc21`: all 40 JS tests, Rust live-process cancellation regression, other Windows regressions, installer bundle and release publication. Installed manual generation/cancel remains unverified.

Published v1.1.3: https://github.com/ariaghirarena/ARIAImageStudio/releases/tag/v1.1.3 — setup 2,511,687 bytes; portable 6,021,632 bytes.
