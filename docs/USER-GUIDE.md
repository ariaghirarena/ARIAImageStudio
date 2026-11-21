# User guide

## First run

1. **Welcome** — four checklist steps; the panel shows live detection of the CLI, credentials and the imagegen skill.
2. **Authentication** — import `auth.json`, drag it onto the page, or *Sign in with ChatGPT* (device flow also
   available). Each import creates an isolated profile; no token is ever displayed.
3. **AI Engine** — install the `imagegen` skill, run the smoke test, review the effective command.
4. **Projects** — create a project (folder tree: Inputs, References, Generated, Variations, Edited, Exports) and mark it
   active.

## Making an image

1. **Create** — describe the scene in Persian or English. Prompt Intelligence scores it and shows what is missing.
2. Pick a quality preset, optionally style/lighting/camera/composition, aspect and variants.
3. *Refine with Codex* rewrites the prompt (review it), *Translate* converts Persian to English while keeping intent.
4. Add reference images if the composition must match an existing asset.
5. *Generate* streams redacted engine output; imported results appear immediately and in the Gallery.

`Ctrl/Cmd + Enter` generates, `Ctrl/Cmd + S` saves the prompt.

## Editing

- **Edit** offers engine edits (background replacement, object add/remove, relight, restyle) that always state what must
  stay unchanged, plus local adjustments (brightness/contrast/saturation/sharpen/upscale/denoise/background key).
  Local adjustments write a new file and show a before/after slider.
- **Variations** branches one axis at a time (style, colour, background, lighting, angle, minimal) and can diff two
  images numerically.

## Managing images

- Gallery filters by project, format, favourites and free text (filename, prompt, note, tag).
- Select multiple images to bulk rename with `{name}`, `{index}`, `{date}` patterns.
- Duplicate detection groups files by identical SHA-256.
- Deleting asks for confirmation and removes both the file and the index row.

## Automation

- **Batch Studio** — one prompt per line; each line becomes a durable job. Pause/resume, cancel, retry, inspect events.
- **Workflow Builder** — chain `generate → upscale → remove background → convert`, save, run, read the per-step log.

## Housekeeping

- **History** lists every generation with prompt, duration and error; jobs expose their event log.
- **Analytics** shows per-day counts, success rate, failures and library totals; exports JSON.
- **Preferences** controls language (فارسی/English + RTL), theme, storage limits, output root and update checks.
- **Diagnostics** runs installation checks, exports a report, and renders the 300-feature matrix with live filters.

## Keyboard

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd + K` | Command palette |
| `Ctrl/Cmd + Enter` | Generate (Create) |
| `Ctrl/Cmd + S` | Save prompt |
| `Ctrl/Cmd + 1…5` | Jump to a workspace |
| `Shift + ?` | Help |
| `Esc` | Close dialog / lightbox |
