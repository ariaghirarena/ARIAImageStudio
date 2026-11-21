# ARIA Image Studio — 300 Feature Registry

> Generated from `packages/feature-registry/src/index.ts` — the single source of truth that the app also ships and syncs into SQLite.
> Status vocabulary is deliberately conservative: nothing is marked Tested unless it has been exercised end to end.

- Registry integrity: **300/300** rows, duplicate ids: **0**
- Implemented + tested: **266** features (89%)
- Partially implemented: **29** · Unsupported by the engine: **5**
- Categories: **30** × 10 features

## Status summary

| Status | Count | Meaning |
| --- | --- | --- |
| Implemented | 243 | Built and wired to a real command; not yet exercised on a signed-in account in CI |
| Tested | 23 | Built and exercised against a real Codex installation |
| Partially implemented | 29 | Works, but with a documented limitation |
| Unsupported by engine | 5 | The Codex engine does not expose this capability |

## Authentication & Accounts (001–010)

_احراز هویت و حساب‌ها_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 001 | **Login with ChatGPT via Codex** — Streams the official `codex login` flow inside the ARIA-owned CODEX_HOME and reports every redacted line in the UI. | Implemented | codex-account | Codex CLI | manual-pending |
| 002 | **Import auth.json** — Validates and imports an existing Codex auth.json without ever displaying token values. | Tested | requires-consent | none | automated |
| 003 | **Drag & drop auth file** — Accepts auth.json dropped onto the Authentication panel via the native drag-drop channel. | Implemented | requires-consent | none | manual-pending |
| 004 | **Multiple Codex profiles** — Each profile owns an isolated CODEX_HOME so accounts never overwrite each other. | Implemented | available | none | automated |
| 005 | **Select active account** — Switches the active profile used by the engine and persists it in settings. | Implemented | available | none | automated |
| 006 | **Login status check** — Runs `codex login status` against the profile CODEX_HOME and stores the result. | Implemented | codex-account | Codex CLI | manual-pending |
| 007 | **Credential validity check** — Reports presence and structural validity of credentials, and the live login status. | Implemented | codex-account | Codex CLI | manual-pending |
| 008 | **Secure sign out** — Runs `codex logout` and securely wipes the local credential copy. | Implemented | available | none | automated |
| 009 | **Replace credential** — Re-imports auth.json into an existing profile after encrypting a DPAPI backup. | Implemented | requires-consent | DPAPI (Windows) | manual-pending |
| 010 | **Delete account data** — Securely deletes the profile folder, credential file and encrypted backup. | Implemented | requires-consent | none | automated |

## Codex Engine (011–020)

_موتور Codex_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 011 | **Run Codex CLI** — Spawns `codex exec --json` with a strict, documented argument set. | Implemented | codex-account | Codex CLI | manual-pending |
| 012 | **Auto-detect Codex path** — Searches PATH, npm globals, winget links and common install folders. | Implemented | available | none | automated |
| 013 | **Manual codex.exe path** — Allows overriding the detected binary path in settings. | Implemented | available | none | automated |
| 014 | **Dedicated CODEX_HOME** — Every run uses an ARIA-owned CODEX_HOME; the user's personal Codex config is untouched. | Tested | available | none | automated |
| 015 | **Session management** — Codex sessions persist inside the ARIA CODEX_HOME for auditability. | Implemented | codex-account | Codex CLI | manual-pending |
| 016 | **Process management** — Child process tree termination, timeout enforcement and cancellation flags. | Implemented | available | none | automated |
| 017 | **JSONL output parsing** — Parses `codex exec --json` events into structured log lines and final messages. | Implemented | codex-account | Codex CLI | manual-pending |
| 018 | **Live log with redaction** — Streams generation output in real time with token patterns redacted before display. | Tested | available | none | automated |
| 019 | **Runtime error handling** — Classifies exit codes, empty results and engine failures with actionable hints. | Implemented | available | none | automated |
| 020 | **Version check & update guidance** — Reads the installed Codex version and reports when it is missing or outdated. | Partially implemented | available | Codex CLI | automated |

## Model & Configuration (021–030)

_مدل و پیکربندی_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 021 | **List valid Codex models** — Reads the model catalog the installed Codex publishes in the ARIA CODEX_HOME models cache. | Partially implemented | codex-account | Codex models cache | manual-pending |
| 022 | **Select text model** — Sends `-m <model>` only when the user selected a real model id. | Implemented | codex-account | Codex CLI | manual-pending |
| 023 | **Show active model** — Displays the configured model or 'Account default' when none is set. | Implemented | available | none | automated |
| 024 | **Reasoning effort** — Passes model_reasoning_effort only when supported values are chosen. | Implemented | codex-account | Codex CLI | manual-pending |
| 025 | **Verbosity** — Passes model_verbosity overrides through documented `-c` configuration. | Implemented | codex-account | Codex CLI | manual-pending |
| 026 | **Manage config.toml** — Reads and writes the profile config.toml with an automatic backup. | Implemented | requires-consent | none | automated |
| 027 | **Configuration profiles** — Each ARIA account profile keeps its own config.toml; Codex `--profile` values pass through untouched. | Partially implemented | codex-account | Codex CLI | manual-pending |
| 028 | **Real model capabilities** — Shows only capabilities reported by the installed engine; otherwise states 'Managed by Codex'. | Partially implemented | codex-account | Codex models cache | manual-pending |
| 029 | **Compare models** — Requires a model catalog with capability metadata, which many Codex builds do not publish. | Unsupported by engine | unavailable | Codex models cache | not-testable |
| 030 | **Reset configuration** — Restores defaults for ARIA settings and can restore config.toml from its backup. | Implemented | available | none | automated |

## Image Generation (031–040)

_تولید تصویر_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 031 | **Text to image** — Generates an image from text through the built-in image_gen tool. | Implemented | codex-account | Codex image_gen | manual-pending |
| 032 | **Persian prompt generation** — Sends the Persian request verbatim, with optional Codex-assisted English refinement. | Implemented | codex-account | Codex image_gen | manual-pending |
| 033 | **English prompt generation** — Optimised English path with structured production vocabulary. | Implemented | codex-account | Codex image_gen | manual-pending |
| 034 | **Automatic prompt enhancement** — Deterministic structuring plus an optional real Codex rewrite step. | Tested | available | none | automated |
| 035 | **Generate multiple variants** — One built-in image_gen call per requested variant, never a fabricated 'n' parameter. | Implemented | codex-account | Codex image_gen | manual-pending |
| 036 | **Preserve main subject** — States subject invariants explicitly so edits keep identity. | Partially implemented | prompt-directive | engine behaviour | manual-pending |
| 037 | **Photoreal generation** — Photorealistic preset with natural material and light directives. | Implemented | prompt-directive | none | automated |
| 038 | **Artistic generation** — Art-style presets mapped to descriptive prompt language. | Implemented | prompt-directive | none | automated |
| 039 | **Advertising generation** — Luxury commercial and campaign presets with copy-space guidance. | Implemented | prompt-directive | none | automated |
| 040 | **Conceptual generation** — Creative-art preset with concept-first structuring. | Implemented | prompt-directive | none | automated |

## Image Editing (041–050)

_ویرایش تصویر_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 041 | **Edit an existing image** — Loads a local image through the view step and asks image_gen for a targeted edit. | Implemented | codex-account | Codex image_gen | manual-pending |
| 042 | **Change background** — Prompt-directed background replacement while preserving the subject. | Implemented | prompt-directive | none | manual-pending |
| 043 | **Remove unwanted elements** — Targeted removal instruction with explicit keep-list invariants. | Implemented | prompt-directive | none | manual-pending |
| 044 | **Add new elements** — Additive edit instruction constrained to the requested element only. | Implemented | prompt-directive | none | manual-pending |
| 045 | **Change object colour** — Colour-change edit that locks lighting and geometry. | Implemented | prompt-directive | none | manual-pending |
| 046 | **Change lighting** — Relighting edit with preserved composition. | Implemented | prompt-directive | none | manual-pending |
| 047 | **Change camera angle** — Viewpoint change expressed as composition language, not a fake parameter. | Implemented | prompt-directive | none | manual-pending |
| 048 | **Change art style** — Style transfer that keeps the subject and framing. | Implemented | prompt-directive | none | manual-pending |
| 049 | **Rebuild image regions** — True masked inpainting is not exposed by the built-in tool. | Unsupported by engine | unavailable | Codex tool limits | not-testable |
| 050 | **Preserve unchanged elements** — Every edit prompt carries an explicit keep-list; exactness depends on the engine. | Partially implemented | prompt-directive | engine behaviour | manual-pending |

## Prompt Intelligence (051–060)

_هوش پرامپت_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 051 | **Prompt Enhancer** — Structures the request into labelled production sections without inventing subjects. | Tested | available | none | automated |
| 052 | **Prompt Rewriter** — Rewrites via Codex with a strict no-new-content instruction. | Implemented | codex-account | Codex CLI | manual-pending |
| 053 | **Prompt Translator** — Persian to English translation performed by Codex, not a hard-coded dictionary. | Implemented | codex-account | Codex CLI | manual-pending |
| 054 | **Ambiguity detection** — Flags very short or vague requests before they are sent. | Tested | available | none | automated |
| 055 | **Main subject detection** — Extracts the primary subject from the user's own wording. | Tested | available | none | automated |
| 056 | **Composition analysis** — Scores whether framing is specified and suggests a preset. | Tested | available | none | automated |
| 057 | **Visual style suggestions** — Recommends a style preset based on the request language. | Tested | available | none | automated |
| 058 | **Lighting suggestions** — Recommends lighting presets with a one-line rationale. | Tested | available | none | automated |
| 059 | **Camera suggestions** — Maps subject type to a lens suggestion expressed as prompt language. | Tested | available | none | automated |
| 060 | **Structured professional prompt** — Emits the full labelled specification used by the engine. | Tested | available | none | automated |

## Advanced Prompt Engineering (061–070)

_مهندسی پیشرفته پرامپت_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 061 | **Negative constraints** — Comma-separated avoid list injected into the engine prompt. | Tested | available | none | automated |
| 062 | **Required elements** — Explicit must-keep list carried into the specification. | Implemented | available | none | automated |
| 063 | **Forbidden elements** — Blocked subjects merged into the negative constraints. | Implemented | available | none | automated |
| 064 | **Composition definition** — Preset-driven framing language. | Implemented | available | none | automated |
| 065 | **Subject placement** — Third-line, centred or negative-space placement directives. | Implemented | available | none | automated |
| 066 | **Camera distance** — Close, medium and full shot directives. | Implemented | available | none | automated |
| 067 | **Lens as text directive** — Lens language is labelled as descriptive text, never as a model parameter. | Implemented | prompt-directive | none | automated |
| 068 | **Depth of field** — Shallow/medium/deep wording derived from the camera preset. | Implemented | prompt-directive | none | automated |
| 069 | **Light and shadow** — Lighting presets with shadow-behaviour wording. | Implemented | prompt-directive | none | automated |
| 070 | **Geometric constraints** — Aspect-safe-area and proportion constraints in the prompt. | Implemented | prompt-directive | none | automated |

## Reference Image Management (071–080)

_مدیریت تصاویر مرجع_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 071 | **Add a reference image** — Copies the file into References and records dimensions and role. | Implemented | available | none | automated |
| 072 | **Add multiple references** — Multi-select import with per-file roles. | Implemented | available | none | manual-pending |
| 073 | **Drag & drop images** — Native drop zone for reference images. | Implemented | available | none | manual-pending |
| 074 | **Reference preview** — Thumbnail previews generated locally with the image crate. | Implemented | available | none | automated |
| 075 | **Assign reference role** — Reference, edit target or style input roles are passed to the engine prompt. | Implemented | available | none | automated |
| 076 | **Compare references** — Side-by-side reference inspection in the lightbox. | Implemented | available | none | automated |
| 077 | **Reference priority** — Ordering is preserved as Image 1..N in the prompt. | Implemented | available | none | automated |
| 078 | **Reference content analysis** — Codex-assisted description of a reference image. | Partially implemented | codex-account | Codex CLI | manual-pending |
| 079 | **Reference history** — References are stored per project with timestamps. | Implemented | available | none | automated |
| 080 | **Reference collections** — References are grouped by project folder and role. | Partially implemented | available | none | manual-pending |

## Composition & Camera (081–090)

_ترکیب‌بندی و دوربین_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 081 | **Frame type selection** — Aspect and framing presets as prompt guidance. | Implemented | prompt-directive | none | automated |
| 082 | **Aspect ratio as prompt** — Aspect is described as composition guidance, not a hidden engine parameter. | Implemented | prompt-directive | none | automated |
| 083 | **Close shot** — Tight framing directive. | Implemented | prompt-directive | none | automated |
| 084 | **Medium shot** — Medium framing directive. | Implemented | prompt-directive | none | automated |
| 085 | **Wide shot** — Environmental framing directive. | Implemented | prompt-directive | none | automated |
| 086 | **High angle** — Top-down and elevated-angle directives. | Implemented | prompt-directive | none | automated |
| 087 | **Low angle** — Low-angle hero perspective directive. | Implemented | prompt-directive | none | automated |
| 088 | **Isometric view** — Isometric three-quarter directive. | Implemented | prompt-directive | none | automated |
| 089 | **Depth of field** — Aperture-like wording tied to the selected lens preset. | Implemented | prompt-directive | none | automated |
| 090 | **Subject placement in frame** — Composition preset controls placement wording. | Implemented | prompt-directive | none | automated |

## Lighting & Color (091–100)

_نور و رنگ_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 091 | **Natural light** — Natural daylight directive. | Implemented | prompt-directive | none | automated |
| 092 | **Studio light** — Controlled studio lighting directive. | Implemented | prompt-directive | none | automated |
| 093 | **Cinematic light** — Motivated cinematic key directive. | Implemented | prompt-directive | none | automated |
| 094 | **Soft light** — Large-source soft light directive. | Implemented | prompt-directive | none | automated |
| 095 | **Hard light** — Hard directional directive. | Implemented | prompt-directive | none | automated |
| 096 | **Backlight** — Backlit rim-separation directive. | Implemented | prompt-directive | none | automated |
| 097 | **Rim light** — Rim-light separation directive. | Implemented | prompt-directive | none | automated |
| 098 | **Colour grading** — Grading is applied through prompt language and local channel adjustments. | Implemented | local-processing | none | automated |
| 099 | **Palette management** — Palette notes are part of the prompt specification. | Implemented | available | none | automated |
| 100 | **Colour extraction from reference** — Extracts the dominant palette from any local image with a histogram quantiser. | Implemented | local-processing | none | automated |

## Artistic Styles (101–110)

_سبک‌های هنری_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 101 | **Photorealistic style** — Photoreal preset with natural texture and light. | Implemented | prompt-directive | none | automated |
| 102 | **Cinematic style** — Filmic contrast, grain and grade. | Implemented | prompt-directive | none | automated |
| 103 | **Minimalist style** — Few elements, strong hierarchy. | Implemented | prompt-directive | none | automated |
| 104 | **Surrealism style** — Dreamlike logic while keeping the requested subject. | Implemented | prompt-directive | none | automated |
| 105 | **Cyberpunk style** — Neon palette and night-city language. | Implemented | prompt-directive | none | automated |
| 106 | **Vintage style** — Analog character and halation. | Implemented | prompt-directive | none | automated |
| 107 | **Editorial style** — Magazine-grade styling. | Implemented | prompt-directive | none | automated |
| 108 | **3D render style** — Physically based render language. | Implemented | prompt-directive | none | automated |
| 109 | **Illustration style** — Deliberate line work and flat colour. | Implemented | prompt-directive | none | automated |
| 110 | **Custom styles** — Reusable custom style sets are stored as Prompt Library entries rather than fake model presets. | Partially implemented | available | Prompt Library | manual-pending |

## Product Photography (111–120)

_عکاسی محصول_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 111 | **Product photography** — Catalog-grade product fidelity preset. | Implemented | prompt-directive | none | automated |
| 112 | **Jewelry photography** — Macro jewellery preset with controlled sparkle. | Implemented | prompt-directive | none | automated |
| 113 | **Apparel photography** — Garment drape and construction preserved. | Implemented | prompt-directive | none | automated |
| 114 | **Electronics photography** — Screen, glass and metal handling directives. | Implemented | prompt-directive | none | automated |
| 115 | **Food photography** — Appetite appeal with honest texture. | Implemented | prompt-directive | none | automated |
| 116 | **White background product** — Seamless white set with contact shadow. | Implemented | prompt-directive | none | automated |
| 117 | **Product advertising image** — Luxury commercial preset with copy space. | Implemented | prompt-directive | none | automated |
| 118 | **Multi-angle product set** — Sequential variants with explicit angle directives. | Implemented | prompt-directive | none | manual-pending |
| 119 | **Preserve product detail** — Strong invariants reduce drift, but the engine may still alter fine detail. | Partially implemented | prompt-directive | engine behaviour | manual-pending |
| 120 | **Store-ready outputs** — Aspect, background and format guidance for marketplaces. | Implemented | available | none | automated |

## Professional Design (121–130)

_طراحی حرفه‌ای_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 121 | **Poster design** — Poster template with placement-safe margins. | Implemented | prompt-directive | none | automated |
| 122 | **Banner design** — Wide banner template with copy space. | Implemented | prompt-directive | none | automated |
| 123 | **Cover design** — Cover template with title-safe area. | Implemented | prompt-directive | none | automated |
| 124 | **Thumbnail design** — Thumbnail prompt template tuned for small sizes. | Implemented | prompt-directive | none | automated |
| 125 | **Social post design** — Square post template with caption space. | Implemented | prompt-directive | none | automated |
| 126 | **Story design** — 9:16 story template. | Implemented | prompt-directive | none | automated |
| 127 | **Digital advertising** — Campaign creative template. | Implemented | prompt-directive | none | automated |
| 128 | **Website imagery** — Web section imagery with hierarchy guidance. | Implemented | prompt-directive | none | automated |
| 129 | **Hero image** — Hero template with negative space for headlines. | Implemented | prompt-directive | none | automated |
| 130 | **UI/UX imagery** — UI mockup and illustration prompts. | Implemented | prompt-directive | none | automated |

## Typography & Text (131–140)

_تایپوگرافی و متن_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 131 | **Image containing text** — Text is requested verbatim inside the prompt. | Implemented | prompt-directive | engine text fidelity | manual-pending |
| 132 | **Persian text in image** — Persian shaping is requested verbatim; Arabic-script accuracy is not guaranteed by the engine. | Partially implemented | prompt-directive | engine behaviour | manual-pending |
| 133 | **English text in image** — Exact wording is quoted in the specification. | Implemented | prompt-directive | none | manual-pending |
| 134 | **Exact text content** — Verbatim text field is carried into the prompt without paraphrase. | Implemented | available | none | automated |
| 135 | **Text placement** — Placement is described as composition language. | Implemented | prompt-directive | none | automated |
| 136 | **Typography style** — Font character described in words (serif, geometric, condensed). | Implemented | prompt-directive | none | automated |
| 137 | **Output text verification** — Output text must be reviewed by the user in the lightbox; no OCR engine is bundled. | Partially implemented | available | manual review | manual-pending |
| 138 | **Wrong-text detection** — Requires an OCR engine, which ARIA does not bundle. | Unsupported by engine | unavailable | OCR engine | not-testable |
| 139 | **Text-free variant** — Generates a clean no-text version via negative constraints. | Implemented | prompt-directive | none | automated |
| 140 | **Typography comparison** — Visual side-by-side comparison of versions is available; automated grading is not. | Partially implemented | available | none | manual-pending |

## Image Variations (141–150)

_نسخه‌های متفاوت_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 141 | **Create variations** — One built-in call per variant with a shared specification. | Implemented | codex-account | Codex image_gen | manual-pending |
| 142 | **Style change preserving subject** — Style-only edit with a keep-list. | Implemented | prompt-directive | none | manual-pending |
| 143 | **Colour change preserving composition** — Palette edit without moving geometry. | Implemented | prompt-directive | none | manual-pending |
| 144 | **Background change preserving subject** — Background swap with subject lock. | Implemented | prompt-directive | none | manual-pending |
| 145 | **Advertising versions** — Campaign variants from one source image. | Implemented | prompt-directive | none | manual-pending |
| 146 | **Minimal versions** — Minimal restyling variant. | Implemented | prompt-directive | none | manual-pending |
| 147 | **Realistic versions** — Photoreal restyling variant. | Implemented | prompt-directive | none | manual-pending |
| 148 | **Compare versions** — Side-by-side and difference metrics between any two images. | Implemented | available | none | automated |
| 149 | **Pick the best version** — Favourites and the review view record the chosen output. | Implemented | available | none | automated |
| 150 | **Branch from one image** — Derived images record parent_image_id and their edit history. | Implemented | available | none | automated |

## Quality Control (151–160)

_کنترل کیفیت_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 151 | **Real resolution check** — Reads true pixel dimensions from the decoded file. | Tested | local-processing | none | automated |
| 152 | **Output dimension check** — Reports width and height for every imported image. | Tested | local-processing | none | automated |
| 153 | **Format check** — Detects the stored format from the file extension and decoder. | Tested | local-processing | none | automated |
| 154 | **File size check** — Records byte size for every asset. | Tested | local-processing | none | automated |
| 155 | **Corruption check** — Full decode on import fails loudly for truncated files. | Tested | local-processing | none | automated |
| 156 | **Duplicate detection** — SHA-256 hashing groups identical files. | Tested | local-processing | none | automated |
| 157 | **Visual sharpness check** — Laplacian-variance focus metric computed locally. | Implemented | local-processing | none | automated |
| 158 | **Artefact detection** — Automated AI-artefact scoring would need a dedicated model. | Unsupported by engine | unavailable | vision model | not-testable |
| 159 | **Composition quality check** — Composition quality is subjective; ARIA surfaces presets and review tools instead of fake scores. | Unsupported by engine | unavailable | none | not-testable |
| 160 | **Quality report** — Per-image metrics plus an exportable usage report. | Partially implemented | available | none | automated |

## Image Enhancement (161–170)

_بهبود تصویر_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 161 | **Local upscale** — Lanczos3 resampling up to 4x; explicitly not AI super-resolution. | Implemented | local-processing | none | automated |
| 162 | **Noise reduction** — 3x3 median filter denoiser. | Implemented | local-processing | none | automated |
| 163 | **Colour correction** — Per-channel white-balance gains. | Implemented | local-processing | none | automated |
| 164 | **Contrast adjustment** — Contrast multiplier with clamping. | Implemented | local-processing | none | automated |
| 165 | **Brightness adjustment** — Additive brightness control. | Implemented | local-processing | none | automated |
| 166 | **Sharpness adjustment** — Unsharp-mask sharpening. | Implemented | local-processing | none | automated |
| 167 | **White balance** — Manual channel gain correction. | Implemented | local-processing | none | automated |
| 168 | **Local background removal** — Corner-sampled flood-fill keyer with tolerance control. | Implemented | local-processing | none | automated |
| 169 | **Transparency repair** — Writes true RGBA PNG with alpha preserved. | Implemented | local-processing | none | automated |
| 170 | **Non-destructive processing** — Every edit writes a new derivative and keeps the original. | Implemented | local-processing | none | automated |

## Background & Transparency (171–180)

_پس‌زمینه و شفافیت_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 171 | **Background detection** — Estimates the background colour from border sampling. | Partially implemented | local-processing | none | automated |
| 172 | **Background removal** — Flood-fill removal from the border inward. | Implemented | local-processing | none | automated |
| 173 | **Transparent PNG output** — Forces RGBA PNG output for cutouts. | Implemented | local-processing | none | automated |
| 174 | **Alpha channel preservation** — Alpha is carried through every local transform. | Implemented | local-processing | none | automated |
| 175 | **Transparency verification** — Reports whether an image really has an alpha channel. | Implemented | local-processing | none | automated |
| 176 | **Background replacement** — Generation edit that swaps the background and keeps the subject. | Implemented | codex-account | Codex image_gen | manual-pending |
| 177 | **Studio background** — Studio-set background directive. | Implemented | prompt-directive | none | automated |
| 178 | **Gradient background** — Gradient-set background directive. | Implemented | prompt-directive | none | automated |
| 179 | **Minimal background** — Minimal background directive. | Implemented | prompt-directive | none | automated |
| 180 | **Background previews** — Previewing several backgrounds requires multiple generations; ARIA shows all variants for review. | Partially implemented | codex-account | Codex image_gen | manual-pending |

## Batch Management (181–190)

_مدیریت دسته‌ای_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 181 | **Generation queue** — SQLite-backed queue with a worker pool. | Tested | available | none | automated |
| 182 | **Add multiple jobs** — Each request becomes a durable job row. | Implemented | available | none | automated |
| 183 | **Sequential execution** — Workers execute jobs one at a time by default. | Implemented | available | none | automated |
| 184 | **Pending job management** — Pending jobs are listed with status and retry controls. | Implemented | available | none | automated |
| 185 | **Cancel a job** — Cancellation flag terminates the Codex process tree. | Implemented | available | none | manual-pending |
| 186 | **Retry failures** — Failed jobs can be requeued with attempt tracking. | Implemented | available | none | automated |
| 187 | **Pause the queue** — Pause flag stops new work from starting. | Implemented | available | none | automated |
| 188 | **Resume the queue** — Clearing the pause flag resumes work. | Implemented | available | none | automated |
| 189 | **Job prioritisation** — Jobs are ordered by priority then creation time; the UI does not yet expose priority editing. | Partially implemented | available | none | automated |
| 190 | **Per-job reporting** — Every job keeps a timestamped event log and result payload. | Implemented | available | none | automated |

## Gallery & History (191–200)

_گالری و تاریخچه_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 191 | **Image gallery** — Virtualised-free but paginated gallery of all imported images. | Implemented | available | none | automated |
| 192 | **Grid view** — Responsive grid with lazy-loaded thumbnails. | Implemented | available | none | automated |
| 193 | **List view** — Compact table view with dimensions and size. | Implemented | available | none | automated |
| 194 | **Filter images** — Filter by project, format, favourites and tags. | Implemented | available | none | automated |
| 195 | **Search images** — Searches file names, prompts, notes and tags. | Implemented | available | none | automated |
| 196 | **Categorise images** — Images are grouped by project and tag. | Implemented | available | none | automated |
| 197 | **Tagging** — Free-form tags with usage counts. | Implemented | available | none | automated |
| 198 | **Favourites** — One-click favourite state stored in the database. | Implemented | available | none | automated |
| 199 | **Full generation history** — Every generation is recorded with prompt, engine and duration. | Implemented | available | none | automated |
| 200 | **Recover the prompt of any image** — Each image row stores original and optimised prompts. | Implemented | available | none | automated |

## File Management (201–210)

_مدیریت فایل_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 201 | **Save as PNG** — PNG encoding through the image crate. | Implemented | local-processing | none | automated |
| 202 | **Save as JPEG** — JPEG encoding with adjustable quality. | Implemented | local-processing | none | automated |
| 203 | **Save as WebP** — WebP encoding through the image crate. | Implemented | local-processing | none | automated |
| 204 | **Bulk rename** — Pattern-based rename with collision-safe suffixes. | Implemented | available | none | automated |
| 205 | **Move files** — Per-project output folders are configurable; arbitrary moves are done in the in-app file browser. | Partially implemented | available | none | manual-pending |
| 206 | **Copy files** — Derivatives are copied into the project Edited folder. | Partially implemented | available | none | automated |
| 207 | **Secure file deletion** — Overwrites then deletes the file where the OS permits. | Implemented | requires-consent | none | automated |
| 208 | **Folder management** — Project folder scaffolding and directory creation from the picker. | Implemented | available | none | automated |
| 209 | **Duplicate file detection** — SHA-256 grouping across the whole library. | Implemented | local-processing | none | automated |
| 210 | **Metadata management** — Dimensions, format, size and hashes are indexed; EXIF writing is not implemented. | Partially implemented | local-processing | none | automated |

## Comparison & Review (211–220)

_مقایسه و بازبینی_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 211 | **Before / after comparison** — Slider comparison between any two images. | Implemented | available | none | automated |
| 212 | **Side-by-side view** — Two-image layout with synchronised zoom. | Implemented | available | none | automated |
| 213 | **Slider comparison** — Draggable split view. | Implemented | available | none | automated |
| 214 | **Detail comparison** — Pixel-difference metric plus zoomed inspection. | Implemented | local-processing | none | automated |
| 215 | **Zoom** — Wheel/drag zoom in the lightbox. | Implemented | available | none | automated |
| 216 | **Pan** — Drag to pan while zoomed. | Implemented | available | none | automated |
| 217 | **Fullscreen view** — Fullscreen lightbox overlay. | Implemented | available | none | automated |
| 218 | **Compare multiple outputs** — Two at a time in the comparison view; the gallery grid is used for wider review. | Partially implemented | available | none | manual-pending |
| 219 | **Select final version** — Favourite the approved output. | Implemented | available | none | automated |
| 220 | **Notes on an image** — Per-image notes stored in SQLite. | Implemented | available | none | automated |

## Prompt Library (221–230)

_کتابخانه پرامپت_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 221 | **Save prompts** — Persistent prompt library with titles and categories. | Implemented | available | none | automated |
| 222 | **Prompt categories** — Category field with filtering. | Implemented | available | none | automated |
| 223 | **Prompt search** — Searches title, body and tags. | Implemented | available | none | automated |
| 224 | **Edit prompts** — Editing creates a new version row. | Implemented | available | none | automated |
| 225 | **Duplicate prompt** — Client-side copy into a new prompt entry. | Implemented | available | none | automated |
| 226 | **Prompt templates** — Built-in templates with variables. | Implemented | available | none | automated |
| 227 | **Dynamic variables** — {{variable}} substitution with a live form. | Tested | available | none | automated |
| 228 | **Prompt favourites** — Favourite prompts sort first. | Implemented | available | none | automated |
| 229 | **Version history** — Every saved edit is stored in prompt_versions. | Implemented | available | none | automated |
| 230 | **Import / export prompts** — JSON round-trip for the whole library. | Implemented | available | none | automated |

## Automation (231–240)

_اتوماسیون_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 231 | **Run saved job settings** — Requests are serialised into job params and replayed. | Implemented | available | none | automated |
| 232 | **Workflow builder** — Visual step editor for generate and local processing steps. | Implemented | available | none | manual-pending |
| 233 | **Operation chains** — Each step consumes the previous step's output. | Implemented | available | none | manual-pending |
| 234 | **Batch-process existing files** — Local steps run over workflow outputs; arbitrary folder batch runs are not implemented yet. | Partially implemented | local-processing | none | manual-pending |
| 235 | **Automatic local operations** — Workflow steps run without manual intervention once started. | Implemented | local-processing | none | manual-pending |
| 236 | **Allowed triggers** — Workflows start only from explicit user action; no background schedulers. | Implemented | requires-consent | none | automated |
| 237 | **Automatic post-processing** — Optional post steps after generation. | Implemented | local-processing | none | automated |
| 238 | **Automatic output saving** — Generated files are imported and saved immediately. | Implemented | available | none | automated |
| 239 | **Chain error handling** — Each step logs failures and continues with a clear report. | Implemented | available | none | automated |
| 240 | **Workflow run report** — workflow_runs stores the full log and status. | Implemented | available | none | automated |

## Workspace & Projects (241–250)

_ورک‌اسپیس و پروژه‌ها_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 241 | **Create projects** — Projects scaffold Inputs/References/Generated/Variations/Edited/Exports. | Implemented | available | none | automated |
| 242 | **Manage multiple projects** — Project switcher with counts and archive state. | Implemented | available | none | automated |
| 243 | **Per-project settings** — Output folder is per project; deeper per-project overrides are not implemented. | Partially implemented | available | none | automated |
| 244 | **Project images** — Every image is scoped to a project. | Implemented | available | none | automated |
| 245 | **Project prompts** — Prompts can be scoped to a project. | Implemented | available | none | automated |
| 246 | **Switch workspace** — Active project is persisted and used as the generation target. | Implemented | available | none | automated |
| 247 | **Output folder selection** — Native folder picker plus manual path entry. | Implemented | requires-consent | none | automated |
| 248 | **Archive projects** — Archived projects stay searchable but sort last. | Implemented | available | none | automated |
| 249 | **Project backup** — Recursive copy into the Backups folder. | Implemented | available | none | automated |
| 250 | **Project restore** — Restores a backup folder back into Projects. | Implemented | requires-consent | none | manual-pending |

## Settings & Preferences (251–260)

_تنظیمات_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 251 | **General settings** — Persisted settings.json with validation and clamping. | Implemented | available | none | automated |
| 252 | **Language** — Persian/English UI switch with RTL support. | Implemented | available | none | automated |
| 253 | **Theme** — Obsidian and Graphite dark themes. | Implemented | available | none | automated |
| 254 | **Save location** — Configurable output root and per-project folders. | Implemented | available | none | automated |
| 255 | **Preview quality** — Thumbnail quality control. | Implemented | available | none | automated |
| 256 | **Cache settings** — Thumbnail cache size limit setting. | Implemented | available | none | automated |
| 257 | **History settings** — History retention limit setting. | Implemented | available | none | automated |
| 258 | **Auto-save behaviour** — Auto-save toggle for prompts and drafts. | Implemented | available | none | automated |
| 259 | **Notifications** — In-app toast notifications with a master toggle. | Implemented | available | none | automated |
| 260 | **Reset application settings** — Restores ARIA defaults without touching credentials. | Implemented | requires-consent | none | automated |

## Performance & Reliability (261–270)

_کارایی و پایداری_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 261 | **Async processing** — Long tasks run on blocking worker threads, never the UI thread. | Implemented | available | none | automated |
| 262 | **Memory management** — Streaming image decode with size guards; no explicit heap accounting. | Partially implemented | available | none | manual-pending |
| 263 | **Cache management** — Thumbnail cache with configurable budget setting. | Partially implemented | available | none | automated |
| 264 | **Lazy image loading** — Gallery thumbnails load lazily. | Implemented | available | none | automated |
| 265 | **Thumbnail generation** — WebP thumbnails generated on import. | Implemented | local-processing | none | automated |
| 266 | **Crash handling** — Panics are contained in the backend; a crash log is written by Tauri. | Partially implemented | available | none | manual-pending |
| 267 | **Operation recovery** — Running jobs are requeued after a restart. | Implemented | available | none | automated |
| 268 | **Timeout management** — Per-run timeout kills the process tree. | Implemented | available | none | manual-pending |
| 269 | **Codex disruption detection** — Health check compares codex presence, login state and recent failures. | Implemented | available | none | automated |
| 270 | **Health check system** — Diagnostics page runs ten independent checks. | Implemented | available | none | automated |

## Security & Privacy (271–280)

_امنیت و حریم خصوصی_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 271 | **Secure credential storage** — ACL-hardened auth.json plus a DPAPI-encrypted backup. | Implemented | requires-consent | DPAPI (Windows) | manual-pending |
| 272 | **Dedicated CODEX_HOME** — Credentials and sessions never touch the personal Codex home. | Tested | available | none | automated |
| 273 | **auth.json protection** — User-only ACLs, secure deletion and no token parsing for display. | Implemented | available | none | automated |
| 274 | **Log redaction** — JWT and key-like tokens are redacted before display or storage. | Tested | available | none | automated |
| 275 | **File access control** — All app files live under one root with per-profile isolation. | Implemented | available | none | automated |
| 276 | **No unintended command execution** — Only fixed Codex argument vectors are executed; no shell interpolation of prompts. | Implemented | available | none | automated |
| 277 | **Workspace permissions** — Codex runs in workspace-write sandbox mode by default. | Implemented | available | none | automated |
| 278 | **Secure account data deletion** — Overwrite-then-delete for credential files and folders. | Implemented | requires-consent | none | automated |
| 279 | **No unintended uploads** — ARIA only talks to Codex locally; nothing is uploaded to ARIA servers. | Implemented | available | none | automated |
| 280 | **Security report** — Diagnostics export contains no credentials or image pixels. | Implemented | available | none | automated |

## Analytics & Reporting (281–290)

_تحلیل و گزارش_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 281 | **Images generated count** — Aggregated from the images table. | Implemented | available | none | automated |
| 282 | **Successful jobs count** — Aggregated from the jobs table. | Implemented | available | none | automated |
| 283 | **Failed jobs count** — Aggregated from the jobs table. | Implemented | available | none | automated |
| 284 | **Average generation time** — Mean duration of successful generations. | Implemented | available | none | automated |
| 285 | **Disk usage report** — Database byte totals plus a filesystem scan of the ARIA root. | Implemented | available | none | automated |
| 286 | **Codex status report** — Health check output for the installed CLI and session. | Implemented | available | none | automated |
| 287 | **Model status report** — Reports the configured model or that the model is managed by Codex. | Partially implemented | codex-account | Codex models cache | manual-pending |
| 288 | **Workflow performance report** — Run logs with per-step outcomes and timings are stored. | Implemented | available | none | automated |
| 289 | **Error report** — Failed generations carry the engine error and exit code. | Implemented | available | none | automated |
| 290 | **Report export** — Markdown reports for analytics, diagnostics and the feature registry. | Implemented | available | none | automated |

## Professional Experience (291–300)

_تجربه حرفه‌ای_

| # | Feature | Status | Availability | Dependencies | Test state |
| --- | --- | --- | --- | --- | --- |
| 291 | **Guided onboarding** — Four-step first-run flow for account, engine, project and first image. | Implemented | available | none | manual-pending |
| 292 | **Dashboard** — Live counts, engine health, queue state and recent work. | Implemented | available | none | manual-pending |
| 293 | **Quick actions** — Dashboard shortcuts to create, edit and review. | Implemented | available | none | automated |
| 294 | **Keyboard shortcuts** — Global shortcut map with an in-app reference. | Implemented | available | none | automated |
| 295 | **Command palette** — Ctrl/Cmd+K palette over every page and action. | Implemented | available | none | manual-pending |
| 296 | **In-app help** — Contextual guidance on every page plus a help drawer. | Implemented | available | none | automated |
| 297 | **Update system** — Checks GitHub Releases, shows notes and opens the verified download. | Partially implemented | available | GitHub Releases | automated |
| 298 | **Settings export / import** — Settings are a documented JSON file; UI-level export is not wired yet. | Partially implemented | available | none | automated |
| 299 | **Feature registry management** — All 300 capabilities mirrored to SQLite with status filters and export. | Implemented | available | none | automated |
| 300 | **Diagnostics & support bundle** — One-click bundle with checks, versions and no secrets. | Implemented | available | none | automated |

## How to verify

1. Open **Diagnostics** inside the app — the same matrix is rendered with live filters, plus installation checks.
2. Run `npm run features` to regenerate this document from source.
3. Export from the app (**Diagnostics → Export markdown**) to compare the shipped DB rows with the source rows.
