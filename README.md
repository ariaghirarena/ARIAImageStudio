# ARIA Image Studio

**A Windows image studio built on your own Codex account.** ARIA generates, edits, enhances and manages images through the
official Codex CLI and its built-in `image_gen` tool — no `OPENAI_API_KEY`, no unofficial endpoints, no mock engine.

![platform](https://img.shields.io/badge/platform-Windows%20x64-0a84ff)
![stack](https://img.shields.io/badge/stack-Tauri%202%20%C2%B7%20Rust%20%C2%B7%20React%2019-7c5cff)
![engine](https://img.shields.io/badge/engine-Codex%20image__gen-22c55e)

---

## What it actually is

| Layer | Technology | Role |
| --- | --- | --- |
| Shell | Tauri 2 (Rust) | Native window, asset protocol, ~70 IPC commands, SQLite, file system |
| Engine | Codex CLI (`codex exec --json`) | Runs the built-in `image_gen` tool under your ChatGPT/Codex session |
| UI | React 19 + TypeScript + Vite 6 | 20 workspaces, design system, Persian/English RTL interface |
| State | Zustand + TanStack Query | Settings, routing, server-state caching |
| Data | SQLite (WAL) | Projects, jobs, generations, images, prompts, workflows, registry |

Everything the UI offers is wired to a real Rust command. Features the engine cannot support are labelled
**Unsupported** instead of being faked. See [FEATURES-300.md](./FEATURES-300.md) for the full, honest matrix
(300 rows, 30 categories).

## Highlights

- **Prompt Intelligence** — deterministic structuring (presets for quality/style/lighting/camera/composition),
  scoring, Persian ↔ English handling, and optional Codex rewriting.
- **Durable queue** — batch prompts become SQLite jobs with retry, cancel, pause, priorities and crash recovery.
- **Gallery** — content-hash indexing, thumbnails, tags, notes, favourites, duplicate detection, bulk rename.
- **Local post-processing** — brightness/contrast/saturation, sharpen, median denoise, Lanczos resampling,
  chroma-key background removal, format conversion. Non-destructive by default.
- **Workflows** — chain generate → upscale → remove background → convert, with a per-run log.
- **Profiles** — multiple isolated `CODEX_HOME` folders, DPAPI-protected credential backups, no tokens in SQLite.
- **Diagnostics** — installation checks, engine smoke test, exportable report, live feature registry.

## Install (end users)

1. Download `ARIA-Image-Studio_1.0.0_x64-setup.exe` from the repository's **Releases** page.
2. Install with the NSIS installer (per-user, no admin prompt) or run the portable `.exe`.
3. Install the Codex CLI if you do not have it: `npm install -g @openai/codex`
4. Open ARIA → **Authentication** → import `auth.json` or *Sign in with ChatGPT*.
5. **AI Engine → Install imagegen skill**, then create your first project.

The app never asks for an API key. Unsupported capabilities are stated in the UI and in the docs.

## Develop

```bash
npm install
npm run typecheck        # tsc -b
npm run dev              # Vite on http://localhost:5273
npm run tauri dev        # full desktop app (needs Rust)
npm run build            # production web assets
npm run features         # regenerate FEATURES-300.md from the registry
```

Requirements: Node 20+, Rust 1.77+ (MSVC toolchain), WebView2 runtime on Windows.

## Repository layout

```
apps/desktop/            React app + Tauri shell
  src/                   20 page modules, shell, store, hooks
  src-tauri/src/         Rust backend (auth, codex, engine, queue, library, …)
packages/core/           Typed IPC bridge
packages/ui/             Design system (icons, components, CSS modules)
packages/prompt-engine/  Deterministic prompt shaping
packages/feature-registry/ 300 verified feature rows
docs/                    Architecture, build, security, user guide
.github/workflows/       Windows x64 release build
```

## Documentation

- [PROJECT-STATUS.md](./PROJECT-STATUS.md) — what is built, what is verified, what is not
- [FEATURES-300.md](./FEATURES-300.md) — the feature matrix with real status
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — process model, data flow, database schema
- [docs/CODEX-INTEGRATION.md](./docs/CODEX-INTEGRATION.md) — exactly how the engine is driven, and its limits
- [docs/BUILD-WINDOWS.md](./docs/BUILD-WINDOWS.md) — producing the installer
- [docs/USER-GUIDE.md](./docs/USER-GUIDE.md) — everyday workflows
- [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) — symptoms and fixes
- [SECURITY.md](./SECURITY.md) — credential handling and reporting

## Honest limitations

- The image model, size, seed and quality are **managed by Codex**; ARIA cannot select them.
- Masked inpainting and OCR-based wrong-text detection are **unsupported** by the engine.
- Model discovery is **partial**: it reads the local Codex model cache and accepts a manual id.
- Rate limits are Codex's own; ARIA queues and retries, it never bypasses them.

## Licence

Proprietary. See [LICENSES/ARIA-EULA.md](./LICENSES/ARIA-EULA.md) and [LICENSES/THIRD-PARTY.md](./LICENSES/THIRD-PARTY.md).
