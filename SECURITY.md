# Security policy

## Reporting

Open a private security advisory on the repository or email the maintainer listed in the GitHub profile. Do not create a
public issue for credential handling or sandbox-escape findings. Please include the app version, Windows build, and a
redacted reproduction — never attach `auth.json`.

## Threat model

ARIA is a local-first desktop app. The assets worth protecting are:

1. **Codex session tokens** (`auth.json`) — grants access to the user's own account.
2. **User content** — prompts, references, generated images.
3. **The host machine** — Codex must not be given more privilege than necessary.

There is no ARIA server, no telemetry endpoint, and no cloud sync.

## Credential handling

- Tokens live only in `%LOCALAPPDATA%/ARIA/ImageStudio/profiles/<id>/codex/auth.json`.
- File permissions are restricted to the current user (`icacls` grant/deny, `chmod 600` on Unix).
- An optional DPAPI-encrypted copy (`auth.vault`) enables recovery; it is bound to the Windows user profile.
- Tokens are **never** written to SQLite, logs, diagnostics, exports or crash reports.
- All engine output passes through `security::redact()` before reaching the UI, job events, or log files.
- Removing a profile runs `codex logout`, overwrites credential files, deletes the vault and removes the folder.
- `auth.json` is structurally validated on import (shape only) — values are never parsed for display.

## Subprocess policy

- Only the official `codex` binary is executed, with `CODEX_HOME` pinned to an ARIA profile.
- Sandbox defaults to `workspace-write`; `danger-full-access` is opt-in with an explicit warning.
- Network access inside the sandbox is off unless enabled per installation.
- On cancel/timeout the entire process tree is terminated (`taskkill /T /F`).
- No shell interpolation of user prompts: arguments are passed as a single `--` payload.

## Content Security Policy

```
default-src 'self';
img-src 'self' asset: http://asset.localhost data: blob:;
style-src 'self' 'unsafe-inline';
script-src 'self';
connect-src 'self' ipc: http://ipc.localhost
```

Remote images are not loaded; only local files through the asset protocol.

## Destructive actions

Deleting images, profiles or projects always requires explicit confirmation, is logged as a job/diagnostic event, and
never happens implicitly during cleanup.

## Updates

`updates.rs` reads GitHub Releases metadata over HTTPS and reports availability. It never downloads or executes an
installer automatically; the user opens the release page.

## Out of scope

- Security of the Codex CLI or OpenAI's service.
- Users running the app with a compromised Windows account or a tampered `codex.exe`.
- Third-party prompts that instruct the agent to do something outside the sandbox (blocked by the sandbox itself).
