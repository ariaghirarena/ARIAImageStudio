# Third-party components

ARIA Image Studio bundles or links the following open-source projects. Versions follow the lockfiles
(`package-lock.json`, `Cargo.lock`).

## Rust

| Crate | Licence | Use |
| --- | --- | --- |
| `tauri` / `tauri-build` | MIT / Apache-2.0 | Desktop shell, IPC, asset protocol |
| `rusqlite` (with bundled SQLite) | MIT; SQLite public domain | Local database |
| `serde`, `serde_json` | MIT / Apache-2.0 | Serialisation |
| `chrono` | MIT / Apache-2.0 | Timestamps |
| `uuid` | MIT / Apache-2.0 | Identifiers |
| `image` | MIT / Apache-2.0 | Decode, resize, filters, encoding |
| `sha2` | MIT / Apache-2.0 | Content hashing |
| `walkdir` | MIT / Unlicense | Folder scanning |
| `dirs` | MIT / Apache-2.0 | Platform paths |

## JavaScript / TypeScript

| Package | Licence | Use |
| --- | --- | --- |
| `react`, `react-dom` | MIT | UI runtime |
| `@tanstack/react-query` | MIT | Server-state caching |
| `zustand` | MIT | Client state |
| `@tauri-apps/api`, `@tauri-apps/cli` | MIT / Apache-2.0 | IPC bridge, bundler |
| `vite`, `@vitejs/plugin-react` | MIT | Build tooling |
| `typescript` | Apache-2.0 | Type checking |
| `vitest` | MIT | Tests |

## Fonts and icons

The interface uses a system font stack (Segoe UI Variable / Segoe UI / Tahoma) and a hand-authored inline SVG icon set.
No third-party icon font or typeface file is redistributed.

## Runtime dependency (not bundled)

The **Codex CLI** is a separate program installed and signed in by the user. It is not distributed with ARIA and is
governed by its own licence and terms.
