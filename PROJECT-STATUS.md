# PROJECT-STATUS — ARIA Image Studio

_Last updated: 2026-11-21 · version 1.0.0_

This file is the honest engineering ledger. It distinguishes **written**, **type-checked**, **built** and **tested**.

## 1. Verification ledger

| Area | Written | Type-checked | Production bundle | Runtime-tested |
| --- | --- | --- | --- | --- |
| `packages/ui` design system | ✅ | ✅ | ✅ | ⏳ via app shell |
| `packages/core` IPC bridge | ✅ | ✅ | ✅ | ⏳ needs desktop runtime |
| `packages/prompt-engine` | ✅ | ✅ | ✅ | ✅ pure functions |
| `packages/feature-registry` | ✅ (300 rows) | ✅ | ✅ | ✅ integrity checks |
| `apps/desktop` 20 pages | ✅ | ✅ | ✅ | ⏳ needs desktop runtime |
| `apps/desktop/src-tauri` (Rust, ~70 commands) | ✅ | ⏳ first `cargo check` runs in CI | ⏳ | ⏳ |
| Windows installer (NSIS) | ⏳ workflow prepared | — | — | ⏳ |
| Portable x64 EXE | ⏳ workflow prepared | — | — | ⏳ |

`npm run typecheck` and `npm run build` pass locally (Vite, 114 modules, no type errors). The Rust crate has **never been
compiled** in this environment because no Rust toolchain is available here; the first compilation happens on
GitHub Actions `windows-latest`. Expect a small number of compiler fixes on that first run — that is exactly why the
workflow exists, and why the installer claim is marked ⏳ rather than ✅.

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

1. **First Rust compile** — type/ownership errors are likely; tracked as the immediate blocker.
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
