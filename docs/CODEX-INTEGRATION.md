# Codex Integration

ARIA does not implement image generation. It orchestrates the **official Codex CLI**, which owns the built-in
`image_gen` tool. This document states exactly what is used, and what is deliberately not.

## Binary discovery

`codex.rs::locate()` tries, in order:

1. `settings.codex_path` (explicit override)
2. `codex` / `codex.exe` on `PATH`
3. npm global prefixes (`%APPDATA%\npm`, `/usr/local/bin`, …)
4. WinGet shims and `%USERPROFILE%\.codex\bin`
5. `where codex` / `which codex`

On Windows, `.cmd`/`.ps1` shims are executed through `cmd.exe /C` so environment variables are preserved.

## Environment

Every invocation receives `CODEX_HOME=<ARIA root>/profiles/<profile-id>/codex`. Your personal `~/.codex` is never read
or written. `auth.json`, `config.toml`, `skills/`, `sessions/` and `generated_images/` all live inside that folder.

## Command shape

```
codex exec --json --skip-git-repo-check
  -C <project work dir or ARIA scratch>
  [-m <model>] [-s workspace-write|read-only|danger-full-access]
  [-c model_reasoning_effort="low|medium|high"] [-c model_verbosity="…"]
  [-i <reference image>]…
  -- "<engine instruction + final prompt>"
```

Flags come from the public CLI surface (`codex exec --help`): `-i/--image`, `-m/--model`, `-s/--sandbox`,
`-C/--cd`, `--json`, `-o/--output-last-message`, `--skip-git-repo-check`, `--ephemeral`, `--ignore-user-config`.
`--json` emits JSONL thread events (`thread.started`, `turn.started/completed`, `item.*`, `error`), which ARIA parses
for progress, usage and the final message.

## Engine instruction

```
Use your built-in image generation tool (image_gen) to create the requested image.
Do not write or run scripts, do not call any API, do not ask for an API key.
Produce the image(s) and finish.

PROMPT:
<final prompt from Prompt Intelligence>
```

Edits add: *the image provided is the source; change only the stated aspect; keep identity, geometry and framing*.
The instruction is intentionally short — the prompt carries the creative direction.

## Output capture

The built-in tool writes images to `<CODEX_HOME>/generated_images/<session_id>/<call_id>.png|.gif`. ARIA snapshots that
folder before the run, diffs it afterwards, then imports each new file: SHA-256 hash, dimension/format probe,
thumbnail, move into `Projects/<slug>/Generated` (or the configured output folder) and a row in `images`.

Because the tool reports no absolute path in the JSONL stream, the snapshot diff is the reliable contract. If Codex
changes the folder convention, Diagnostics will show "engine produced no file" and the run log will still contain the
agent's message.

## Authentication

Supported: `codex login` (ChatGPT browser flow), `codex login --device-auth`, and importing an existing `auth.json`.
Status comes from `codex login status` (presence of a session), never from token contents.

Never used: `--with-api-key`, `OPENAI_API_KEY`, personal access tokens, or any endpoint outside the CLI.

## Capability matrix

| Capability | State | Notes |
| --- | --- | --- |
| Generate from text | Supported | via `image_gen` |
| Edit an existing image | Supported (prompt-directed) | image passed with `-i` |
| Variations | Supported | one call per variant along one axis |
| Transparent background | Partial | only when the model honours the request |
| Exact pixel size / aspect enforcement | Partial | aspect expressed in the prompt; verified after import |
| Seed control | Unsupported | not exposed |
| Masked inpainting | Unsupported | not exposed |
| Per-image quality parameter | Unsupported | not exposed |
| Model selection for images | Managed by Codex | shown as such in the UI |
| Model list for the text agent | Partial | local cache + manual id |
| Rate-limit bypass | Never | jobs queue and surface the engine error |

## Failure modes

| Symptom | Cause | Handling |
| --- | --- | --- |
| `codex_not_found` | CLI missing | UI shows install command + docs link |
| `not_authenticated` | no session | redirect to Authentication |
| exit code non-zero, no file | prompt rejected / policy | run log + generation error stored |
| timeout | long generation | process tree killed, job marked failed with hint |
| empty `generated_images` diff | folder convention changed | diagnostics hint, log preserved |
