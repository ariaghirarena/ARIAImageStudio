/**
 * @aria/feature-registry — the single source of truth for all 300 declared
 * capabilities. Statuses are honest: "tested" means covered by an automated or
 * documented manual test in this repository, "implemented" means the code path
 * exists but still needs a real Codex account/run, "partial" means a real but
 * limited implementation, "unsupported" means the engine cannot do it.
 */

export type FeatureStatus = "tested" | "implemented" | "partial" | "unsupported" | "blocked" | "planned";

export type Availability =
  | "available"
  | "codex-account"
  | "prompt-directive"
  | "local-processing"
  | "requires-consent"
  | "unavailable";

export interface Feature {
  id: string;
  category: string;
  categoryLabel: string;
  categoryLabelFa: string;
  name: string;
  description: string;
  status: FeatureStatus;
  availability: Availability;
  dependencies: string;
  testStatus: string;
}

export interface Category {
  id: string;
  label: string;
  labelFa: string;
  from: number;
  to: number;
}

export const CATEGORIES: Category[] = [
  { id: "auth", label: "Authentication & Accounts", labelFa: "احراز هویت و حساب‌ها", from: 1, to: 10 },
  { id: "engine", label: "Codex Engine", labelFa: "موتور Codex", from: 11, to: 20 },
  { id: "config", label: "Model & Configuration", labelFa: "مدل و پیکربندی", from: 21, to: 30 },
  { id: "generate", label: "Image Generation", labelFa: "تولید تصویر", from: 31, to: 40 },
  { id: "editing", label: "Image Editing", labelFa: "ویرایش تصویر", from: 41, to: 50 },
  { id: "prompt", label: "Prompt Intelligence", labelFa: "هوش پرامپت", from: 51, to: 60 },
  { id: "prompt-advanced", label: "Advanced Prompt Engineering", labelFa: "مهندسی پیشرفته پرامپت", from: 61, to: 70 },
  { id: "references", label: "Reference Image Management", labelFa: "مدیریت تصاویر مرجع", from: 71, to: 80 },
  { id: "composition", label: "Composition & Camera", labelFa: "ترکیب‌بندی و دوربین", from: 81, to: 90 },
  { id: "lighting", label: "Lighting & Color", labelFa: "نور و رنگ", from: 91, to: 100 },
  { id: "styles", label: "Artistic Styles", labelFa: "سبک‌های هنری", from: 101, to: 110 },
  { id: "product", label: "Product Photography", labelFa: "عکاسی محصول", from: 111, to: 120 },
  { id: "design", label: "Professional Design", labelFa: "طراحی حرفه‌ای", from: 121, to: 130 },
  { id: "typography", label: "Typography & Text", labelFa: "تایپوگرافی و متن", from: 131, to: 140 },
  { id: "variations", label: "Image Variations", labelFa: "نسخه‌های متفاوت", from: 141, to: 150 },
  { id: "quality", label: "Quality Control", labelFa: "کنترل کیفیت", from: 151, to: 160 },
  { id: "enhance", label: "Image Enhancement", labelFa: "بهبود تصویر", from: 161, to: 170 },
  { id: "background", label: "Background & Transparency", labelFa: "پس‌زمینه و شفافیت", from: 171, to: 180 },
  { id: "batch", label: "Batch Management", labelFa: "مدیریت دسته‌ای", from: 181, to: 190 },
  { id: "gallery", label: "Gallery & History", labelFa: "گالری و تاریخچه", from: 191, to: 200 },
  { id: "files", label: "File Management", labelFa: "مدیریت فایل", from: 201, to: 210 },
  { id: "compare", label: "Comparison & Review", labelFa: "مقایسه و بازبینی", from: 211, to: 220 },
  { id: "prompt-library", label: "Prompt Library", labelFa: "کتابخانه پرامپت", from: 221, to: 230 },
  { id: "automation", label: "Automation", labelFa: "اتوماسیون", from: 231, to: 240 },
  { id: "workspace", label: "Workspace & Projects", labelFa: "ورک‌اسپیس و پروژه‌ها", from: 241, to: 250 },
  { id: "settings", label: "Settings & Preferences", labelFa: "تنظیمات", from: 251, to: 260 },
  { id: "performance", label: "Performance & Reliability", labelFa: "کارایی و پایداری", from: 261, to: 270 },
  { id: "security", label: "Security & Privacy", labelFa: "امنیت و حریم خصوصی", from: 271, to: 280 },
  { id: "analytics", label: "Analytics & Reporting", labelFa: "تحلیل و گزارش", from: 281, to: 290 },
  { id: "experience", label: "Professional Experience", labelFa: "تجربه حرفه‌ای", from: 291, to: 300 },
];

type Row = [name: string, description: string, status: FeatureStatus, availability: Availability, dependencies?: string, testStatus?: string];

const ROWS: Row[] = [
  // 001-010 Authentication & Accounts
  ["Login with ChatGPT via Codex", "Streams the official `codex login` flow inside the ARIA-owned CODEX_HOME and reports every redacted line in the UI.", "implemented", "codex-account", "Codex CLI", "manual-pending"],
  ["Import auth.json", "Validates and imports an existing Codex auth.json without ever displaying token values.", "tested", "requires-consent", "none", "automated"],
  ["Drag & drop auth file", "Accepts auth.json dropped onto the Authentication panel via the native drag-drop channel.", "implemented", "requires-consent", "none", "manual-pending"],
  ["Multiple Codex profiles", "Each profile owns an isolated CODEX_HOME so accounts never overwrite each other.", "implemented", "available", "none", "automated"],
  ["Select active account", "Switches the active profile used by the engine and persists it in settings.", "implemented", "available", "none", "automated"],
  ["Login status check", "Runs `codex login status` against the profile CODEX_HOME and stores the result.", "implemented", "codex-account", "Codex CLI", "manual-pending"],
  ["Credential validity check", "Reports presence and structural validity of credentials, and the live login status.", "implemented", "codex-account", "Codex CLI", "manual-pending"],
  ["Secure sign out", "Runs `codex logout` and securely wipes the local credential copy.", "implemented", "available", "none", "automated"],
  ["Replace credential", "Re-imports auth.json into an existing profile after encrypting a DPAPI backup.", "implemented", "requires-consent", "DPAPI (Windows)", "manual-pending"],
  ["Delete account data", "Securely deletes the profile folder, credential file and encrypted backup.", "implemented", "requires-consent", "none", "automated"],

  // 011-020 Codex Engine
  ["Run Codex CLI", "Spawns `codex exec --json` with a strict, documented argument set.", "implemented", "codex-account", "Codex CLI", "manual-pending"],
  ["Auto-detect Codex path", "Searches PATH, npm globals, winget links and common install folders.", "implemented", "available", "none", "automated"],
  ["Manual codex.exe path", "Allows overriding the detected binary path in settings.", "implemented", "available", "none", "automated"],
  ["Dedicated CODEX_HOME", "Every run uses an ARIA-owned CODEX_HOME; the user's personal Codex config is untouched.", "tested", "available", "none", "automated"],
  ["Session management", "Codex sessions persist inside the ARIA CODEX_HOME for auditability.", "implemented", "codex-account", "Codex CLI", "manual-pending"],
  ["Process management", "Child process tree termination, timeout enforcement and cancellation flags.", "implemented", "available", "none", "automated"],
  ["JSONL output parsing", "Parses `codex exec --json` events into structured log lines and final messages.", "implemented", "codex-account", "Codex CLI", "manual-pending"],
  ["Live log with redaction", "Streams generation output in real time with token patterns redacted before display.", "tested", "available", "none", "automated"],
  ["Runtime error handling", "Classifies exit codes, empty results and engine failures with actionable hints.", "implemented", "available", "none", "automated"],
  ["Version check & update guidance", "Reads the installed Codex version and reports when it is missing or outdated.", "partial", "available", "Codex CLI", "automated"],

  // 021-030 Model & Configuration
  ["List valid Codex models", "Reads the model catalog the installed Codex publishes in the ARIA CODEX_HOME models cache.", "partial", "codex-account", "Codex models cache", "manual-pending"],
  ["Select text model", "Sends `-m <model>` only when the user selected a real model id.", "implemented", "codex-account", "Codex CLI", "manual-pending"],
  ["Show active model", "Displays the configured model or 'Account default' when none is set.", "implemented", "available", "none", "automated"],
  ["Reasoning effort", "Passes model_reasoning_effort only when supported values are chosen.", "implemented", "codex-account", "Codex CLI", "manual-pending"],
  ["Verbosity", "Passes model_verbosity overrides through documented `-c` configuration.", "implemented", "codex-account", "Codex CLI", "manual-pending"],
  ["Manage config.toml", "Reads and writes the profile config.toml with an automatic backup.", "implemented", "requires-consent", "none", "automated"],
  ["Configuration profiles", "Each ARIA account profile keeps its own config.toml; Codex `--profile` values pass through untouched.", "partial", "codex-account", "Codex CLI", "manual-pending"],
  ["Real model capabilities", "Shows only capabilities reported by the installed engine; otherwise states 'Managed by Codex'.", "partial", "codex-account", "Codex models cache", "manual-pending"],
  ["Compare models", "Requires a model catalog with capability metadata, which many Codex builds do not publish.", "unsupported", "unavailable", "Codex models cache", "not-testable"],
  ["Reset configuration", "Restores defaults for ARIA settings and can restore config.toml from its backup.", "implemented", "available", "none", "automated"],

  // 031-040 Image Generation
  ["Text to image", "Generates an image from text through the built-in image_gen tool.", "implemented", "codex-account", "Codex image_gen", "manual-pending"],
  ["Persian prompt generation", "Sends the Persian request verbatim, with optional Codex-assisted English refinement.", "implemented", "codex-account", "Codex image_gen", "manual-pending"],
  ["English prompt generation", "Optimised English path with structured production vocabulary.", "implemented", "codex-account", "Codex image_gen", "manual-pending"],
  ["Automatic prompt enhancement", "Deterministic structuring plus an optional real Codex rewrite step.", "tested", "available", "none", "automated"],
  ["Generate multiple variants", "One built-in image_gen call per requested variant, never a fabricated 'n' parameter.", "implemented", "codex-account", "Codex image_gen", "manual-pending"],
  ["Preserve main subject", "States subject invariants explicitly so edits keep identity.", "partial", "prompt-directive", "engine behaviour", "manual-pending"],
  ["Photoreal generation", "Photorealistic preset with natural material and light directives.", "implemented", "prompt-directive", "none", "automated"],
  ["Artistic generation", "Art-style presets mapped to descriptive prompt language.", "implemented", "prompt-directive", "none", "automated"],
  ["Advertising generation", "Luxury commercial and campaign presets with copy-space guidance.", "implemented", "prompt-directive", "none", "automated"],
  ["Conceptual generation", "Creative-art preset with concept-first structuring.", "implemented", "prompt-directive", "none", "automated"],

  // 041-050 Image Editing
  ["Edit an existing image", "Loads a local image through the view step and asks image_gen for a targeted edit.", "implemented", "codex-account", "Codex image_gen", "manual-pending"],
  ["Change background", "Prompt-directed background replacement while preserving the subject.", "implemented", "prompt-directive", "none", "manual-pending"],
  ["Remove unwanted elements", "Targeted removal instruction with explicit keep-list invariants.", "implemented", "prompt-directive", "none", "manual-pending"],
  ["Add new elements", "Additive edit instruction constrained to the requested element only.", "implemented", "prompt-directive", "none", "manual-pending"],
  ["Change object colour", "Colour-change edit that locks lighting and geometry.", "implemented", "prompt-directive", "none", "manual-pending"],
  ["Change lighting", "Relighting edit with preserved composition.", "implemented", "prompt-directive", "none", "manual-pending"],
  ["Change camera angle", "Viewpoint change expressed as composition language, not a fake parameter.", "implemented", "prompt-directive", "none", "manual-pending"],
  ["Change art style", "Style transfer that keeps the subject and framing.", "implemented", "prompt-directive", "none", "manual-pending"],
  ["Rebuild image regions", "True masked inpainting is not exposed by the built-in tool.", "unsupported", "unavailable", "Codex tool limits", "not-testable"],
  ["Preserve unchanged elements", "Every edit prompt carries an explicit keep-list; exactness depends on the engine.", "partial", "prompt-directive", "engine behaviour", "manual-pending"],

  // 051-060 Prompt Intelligence
  ["Prompt Enhancer", "Structures the request into labelled production sections without inventing subjects.", "tested", "available", "none", "automated"],
  ["Prompt Rewriter", "Rewrites via Codex with a strict no-new-content instruction.", "implemented", "codex-account", "Codex CLI", "manual-pending"],
  ["Prompt Translator", "Persian to English translation performed by Codex, not a hard-coded dictionary.", "implemented", "codex-account", "Codex CLI", "manual-pending"],
  ["Ambiguity detection", "Flags very short or vague requests before they are sent.", "tested", "available", "none", "automated"],
  ["Main subject detection", "Extracts the primary subject from the user's own wording.", "tested", "available", "none", "automated"],
  ["Composition analysis", "Scores whether framing is specified and suggests a preset.", "tested", "available", "none", "automated"],
  ["Visual style suggestions", "Recommends a style preset based on the request language.", "tested", "available", "none", "automated"],
  ["Lighting suggestions", "Recommends lighting presets with a one-line rationale.", "tested", "available", "none", "automated"],
  ["Camera suggestions", "Maps subject type to a lens suggestion expressed as prompt language.", "tested", "available", "none", "automated"],
  ["Structured professional prompt", "Emits the full labelled specification used by the engine.", "tested", "available", "none", "automated"],

  // 061-070 Advanced Prompt Engineering
  ["Negative constraints", "Comma-separated avoid list injected into the engine prompt.", "tested", "available", "none", "automated"],
  ["Required elements", "Explicit must-keep list carried into the specification.", "implemented", "available", "none", "automated"],
  ["Forbidden elements", "Blocked subjects merged into the negative constraints.", "implemented", "available", "none", "automated"],
  ["Composition definition", "Preset-driven framing language.", "implemented", "available", "none", "automated"],
  ["Subject placement", "Third-line, centred or negative-space placement directives.", "implemented", "available", "none", "automated"],
  ["Camera distance", "Close, medium and full shot directives.", "implemented", "available", "none", "automated"],
  ["Lens as text directive", "Lens language is labelled as descriptive text, never as a model parameter.", "implemented", "prompt-directive", "none", "automated"],
  ["Depth of field", "Shallow/medium/deep wording derived from the camera preset.", "implemented", "prompt-directive", "none", "automated"],
  ["Light and shadow", "Lighting presets with shadow-behaviour wording.", "implemented", "prompt-directive", "none", "automated"],
  ["Geometric constraints", "Aspect-safe-area and proportion constraints in the prompt.", "implemented", "prompt-directive", "none", "automated"],

  // 071-080 Reference Images
  ["Add a reference image", "Copies the file into References and records dimensions and role.", "implemented", "available", "none", "automated"],
  ["Add multiple references", "Multi-select import with per-file roles.", "implemented", "available", "none", "manual-pending"],
  ["Drag & drop images", "Native drop zone for reference images.", "implemented", "available", "none", "manual-pending"],
  ["Reference preview", "Thumbnail previews generated locally with the image crate.", "implemented", "available", "none", "automated"],
  ["Assign reference role", "Reference, edit target or style input roles are passed to the engine prompt.", "implemented", "available", "none", "automated"],
  ["Compare references", "Side-by-side reference inspection in the lightbox.", "implemented", "available", "none", "automated"],
  ["Reference priority", "Ordering is preserved as Image 1..N in the prompt.", "implemented", "available", "none", "automated"],
  ["Reference content analysis", "Codex-assisted description of a reference image.", "partial", "codex-account", "Codex CLI", "manual-pending"],
  ["Reference history", "References are stored per project with timestamps.", "implemented", "available", "none", "automated"],
  ["Reference collections", "References are grouped by project folder and role.", "partial", "available", "none", "manual-pending"],

  // 081-090 Composition & Camera
  ["Frame type selection", "Aspect and framing presets as prompt guidance.", "implemented", "prompt-directive", "none", "automated"],
  ["Aspect ratio as prompt", "Aspect is described as composition guidance, not a hidden engine parameter.", "implemented", "prompt-directive", "none", "automated"],
  ["Close shot", "Tight framing directive.", "implemented", "prompt-directive", "none", "automated"],
  ["Medium shot", "Medium framing directive.", "implemented", "prompt-directive", "none", "automated"],
  ["Wide shot", "Environmental framing directive.", "implemented", "prompt-directive", "none", "automated"],
  ["High angle", "Top-down and elevated-angle directives.", "implemented", "prompt-directive", "none", "automated"],
  ["Low angle", "Low-angle hero perspective directive.", "implemented", "prompt-directive", "none", "automated"],
  ["Isometric view", "Isometric three-quarter directive.", "implemented", "prompt-directive", "none", "automated"],
  ["Depth of field", "Aperture-like wording tied to the selected lens preset.", "implemented", "prompt-directive", "none", "automated"],
  ["Subject placement in frame", "Composition preset controls placement wording.", "implemented", "prompt-directive", "none", "automated"],

  // 091-100 Lighting & Colour
  ["Natural light", "Natural daylight directive.", "implemented", "prompt-directive", "none", "automated"],
  ["Studio light", "Controlled studio lighting directive.", "implemented", "prompt-directive", "none", "automated"],
  ["Cinematic light", "Motivated cinematic key directive.", "implemented", "prompt-directive", "none", "automated"],
  ["Soft light", "Large-source soft light directive.", "implemented", "prompt-directive", "none", "automated"],
  ["Hard light", "Hard directional directive.", "implemented", "prompt-directive", "none", "automated"],
  ["Backlight", "Backlit rim-separation directive.", "implemented", "prompt-directive", "none", "automated"],
  ["Rim light", "Rim-light separation directive.", "implemented", "prompt-directive", "none", "automated"],
  ["Colour grading", "Grading is applied through prompt language and local channel adjustments.", "implemented", "local-processing", "none", "automated"],
  ["Palette management", "Palette notes are part of the prompt specification.", "implemented", "available", "none", "automated"],
  ["Colour extraction from reference", "Extracts the dominant palette from any local image with a histogram quantiser.", "implemented", "local-processing", "none", "automated"],
];

// 101-300 continue in FEATURES-300.md and are defined below.

ROWS.push(
  // 101-110 Artistic Styles
  ["Photorealistic style", "Photoreal preset with natural texture and light.", "implemented", "prompt-directive", "none", "automated"],
  ["Cinematic style", "Filmic contrast, grain and grade.", "implemented", "prompt-directive", "none", "automated"],
  ["Minimalist style", "Few elements, strong hierarchy.", "implemented", "prompt-directive", "none", "automated"],
  ["Surrealism style", "Dreamlike logic while keeping the requested subject.", "implemented", "prompt-directive", "none", "automated"],
  ["Cyberpunk style", "Neon palette and night-city language.", "implemented", "prompt-directive", "none", "automated"],
  ["Vintage style", "Analog character and halation.", "implemented", "prompt-directive", "none", "automated"],
  ["Editorial style", "Magazine-grade styling.", "implemented", "prompt-directive", "none", "automated"],
  ["3D render style", "Physically based render language.", "implemented", "prompt-directive", "none", "automated"],
  ["Illustration style", "Deliberate line work and flat colour.", "implemented", "prompt-directive", "none", "automated"],
  ["Custom styles", "Reusable custom style sets are stored as Prompt Library entries rather than fake model presets.", "partial", "available", "Prompt Library", "manual-pending"],

  // 111-120 Product Photography
  ["Product photography", "Catalog-grade product fidelity preset.", "implemented", "prompt-directive", "none", "automated"],
  ["Jewelry photography", "Macro jewellery preset with controlled sparkle.", "implemented", "prompt-directive", "none", "automated"],
  ["Apparel photography", "Garment drape and construction preserved.", "implemented", "prompt-directive", "none", "automated"],
  ["Electronics photography", "Screen, glass and metal handling directives.", "implemented", "prompt-directive", "none", "automated"],
  ["Food photography", "Appetite appeal with honest texture.", "implemented", "prompt-directive", "none", "automated"],
  ["White background product", "Seamless white set with contact shadow.", "implemented", "prompt-directive", "none", "automated"],
  ["Product advertising image", "Luxury commercial preset with copy space.", "implemented", "prompt-directive", "none", "automated"],
  ["Multi-angle product set", "Sequential variants with explicit angle directives.", "implemented", "prompt-directive", "none", "manual-pending"],
  ["Preserve product detail", "Strong invariants reduce drift, but the engine may still alter fine detail.", "partial", "prompt-directive", "engine behaviour", "manual-pending"],
  ["Store-ready outputs", "Aspect, background and format guidance for marketplaces.", "implemented", "available", "none", "automated"],

  // 121-130 Professional Design
  ["Poster design", "Poster template with placement-safe margins.", "implemented", "prompt-directive", "none", "automated"],
  ["Banner design", "Wide banner template with copy space.", "implemented", "prompt-directive", "none", "automated"],
  ["Cover design", "Cover template with title-safe area.", "implemented", "prompt-directive", "none", "automated"],
  ["Thumbnail design", "Thumbnail prompt template tuned for small sizes.", "implemented", "prompt-directive", "none", "automated"],
  ["Social post design", "Square post template with caption space.", "implemented", "prompt-directive", "none", "automated"],
  ["Story design", "9:16 story template.", "implemented", "prompt-directive", "none", "automated"],
  ["Digital advertising", "Campaign creative template.", "implemented", "prompt-directive", "none", "automated"],
  ["Website imagery", "Web section imagery with hierarchy guidance.", "implemented", "prompt-directive", "none", "automated"],
  ["Hero image", "Hero template with negative space for headlines.", "implemented", "prompt-directive", "none", "automated"],
  ["UI/UX imagery", "UI mockup and illustration prompts.", "implemented", "prompt-directive", "none", "automated"],

  // 131-140 Typography & Text
  ["Image containing text", "Text is requested verbatim inside the prompt.", "implemented", "prompt-directive", "engine text fidelity", "manual-pending"],
  ["Persian text in image", "Persian shaping is requested verbatim; Arabic-script accuracy is not guaranteed by the engine.", "partial", "prompt-directive", "engine behaviour", "manual-pending"],
  ["English text in image", "Exact wording is quoted in the specification.", "implemented", "prompt-directive", "none", "manual-pending"],
  ["Exact text content", "Verbatim text field is carried into the prompt without paraphrase.", "implemented", "available", "none", "automated"],
  ["Text placement", "Placement is described as composition language.", "implemented", "prompt-directive", "none", "automated"],
  ["Typography style", "Font character described in words (serif, geometric, condensed).", "implemented", "prompt-directive", "none", "automated"],
  ["Output text verification", "Output text must be reviewed by the user in the lightbox; no OCR engine is bundled.", "partial", "available", "manual review", "manual-pending"],
  ["Wrong-text detection", "Requires an OCR engine, which ARIA does not bundle.", "unsupported", "unavailable", "OCR engine", "not-testable"],
  ["Text-free variant", "Generates a clean no-text version via negative constraints.", "implemented", "prompt-directive", "none", "automated"],
  ["Typography comparison", "Visual side-by-side comparison of versions is available; automated grading is not.", "partial", "available", "none", "manual-pending"],

  // 141-150 Image Variations
  ["Create variations", "One built-in call per variant with a shared specification.", "implemented", "codex-account", "Codex image_gen", "manual-pending"],
  ["Style change preserving subject", "Style-only edit with a keep-list.", "implemented", "prompt-directive", "none", "manual-pending"],
  ["Colour change preserving composition", "Palette edit without moving geometry.", "implemented", "prompt-directive", "none", "manual-pending"],
  ["Background change preserving subject", "Background swap with subject lock.", "implemented", "prompt-directive", "none", "manual-pending"],
  ["Advertising versions", "Campaign variants from one source image.", "implemented", "prompt-directive", "none", "manual-pending"],
  ["Minimal versions", "Minimal restyling variant.", "implemented", "prompt-directive", "none", "manual-pending"],
  ["Realistic versions", "Photoreal restyling variant.", "implemented", "prompt-directive", "none", "manual-pending"],
  ["Compare versions", "Side-by-side and difference metrics between any two images.", "implemented", "available", "none", "automated"],
  ["Pick the best version", "Favourites and the review view record the chosen output.", "implemented", "available", "none", "automated"],
  ["Branch from one image", "Derived images record parent_image_id and their edit history.", "implemented", "available", "none", "automated"],

  // 151-160 Quality Control
  ["Real resolution check", "Reads true pixel dimensions from the decoded file.", "tested", "local-processing", "none", "automated"],
  ["Output dimension check", "Reports width and height for every imported image.", "tested", "local-processing", "none", "automated"],
  ["Format check", "Detects the stored format from the file extension and decoder.", "tested", "local-processing", "none", "automated"],
  ["File size check", "Records byte size for every asset.", "tested", "local-processing", "none", "automated"],
  ["Corruption check", "Full decode on import fails loudly for truncated files.", "tested", "local-processing", "none", "automated"],
  ["Duplicate detection", "SHA-256 hashing groups identical files.", "tested", "local-processing", "none", "automated"],
  ["Visual sharpness check", "Laplacian-variance focus metric computed locally.", "implemented", "local-processing", "none", "automated"],
  ["Artefact detection", "Automated AI-artefact scoring would need a dedicated model.", "unsupported", "unavailable", "vision model", "not-testable"],
  ["Composition quality check", "Composition quality is subjective; ARIA surfaces presets and review tools instead of fake scores.", "unsupported", "unavailable", "none", "not-testable"],
  ["Quality report", "Per-image metrics plus an exportable usage report.", "partial", "available", "none", "automated"],

  // 161-170 Image Enhancement
  ["Local upscale", "Lanczos3 resampling up to 4x; explicitly not AI super-resolution.", "implemented", "local-processing", "none", "automated"],
  ["Noise reduction", "3x3 median filter denoiser.", "implemented", "local-processing", "none", "automated"],
  ["Colour correction", "Per-channel white-balance gains.", "implemented", "local-processing", "none", "automated"],
  ["Contrast adjustment", "Contrast multiplier with clamping.", "implemented", "local-processing", "none", "automated"],
  ["Brightness adjustment", "Additive brightness control.", "implemented", "local-processing", "none", "automated"],
  ["Sharpness adjustment", "Unsharp-mask sharpening.", "implemented", "local-processing", "none", "automated"],
  ["White balance", "Manual channel gain correction.", "implemented", "local-processing", "none", "automated"],
  ["Local background removal", "Corner-sampled flood-fill keyer with tolerance control.", "implemented", "local-processing", "none", "automated"],
  ["Transparency repair", "Writes true RGBA PNG with alpha preserved.", "implemented", "local-processing", "none", "automated"],
  ["Non-destructive processing", "Every edit writes a new derivative and keeps the original.", "implemented", "local-processing", "none", "automated"],

  // 171-180 Background & Transparency
  ["Background detection", "Estimates the background colour from border sampling.", "partial", "local-processing", "none", "automated"],
  ["Background removal", "Flood-fill removal from the border inward.", "implemented", "local-processing", "none", "automated"],
  ["Transparent PNG output", "Forces RGBA PNG output for cutouts.", "implemented", "local-processing", "none", "automated"],
  ["Alpha channel preservation", "Alpha is carried through every local transform.", "implemented", "local-processing", "none", "automated"],
  ["Transparency verification", "Reports whether an image really has an alpha channel.", "implemented", "local-processing", "none", "automated"],
  ["Background replacement", "Generation edit that swaps the background and keeps the subject.", "implemented", "codex-account", "Codex image_gen", "manual-pending"],
  ["Studio background", "Studio-set background directive.", "implemented", "prompt-directive", "none", "automated"],
  ["Gradient background", "Gradient-set background directive.", "implemented", "prompt-directive", "none", "automated"],
  ["Minimal background", "Minimal background directive.", "implemented", "prompt-directive", "none", "automated"],
  ["Background previews", "Previewing several backgrounds requires multiple generations; ARIA shows all variants for review.", "partial", "codex-account", "Codex image_gen", "manual-pending"],

  // 181-190 Batch Management
  ["Generation queue", "SQLite-backed queue with a worker pool.", "tested", "available", "none", "automated"],
  ["Add multiple jobs", "Each request becomes a durable job row.", "implemented", "available", "none", "automated"],
  ["Sequential execution", "Workers execute jobs one at a time by default.", "implemented", "available", "none", "automated"],
  ["Pending job management", "Pending jobs are listed with status and retry controls.", "implemented", "available", "none", "automated"],
  ["Cancel a job", "Cancellation flag terminates the Codex process tree.", "implemented", "available", "none", "manual-pending"],
  ["Retry failures", "Failed jobs can be requeued with attempt tracking.", "implemented", "available", "none", "automated"],
  ["Pause the queue", "Pause flag stops new work from starting.", "implemented", "available", "none", "automated"],
  ["Resume the queue", "Clearing the pause flag resumes work.", "implemented", "available", "none", "automated"],
  ["Job prioritisation", "Jobs are ordered by priority then creation time; the UI does not yet expose priority editing.", "partial", "available", "none", "automated"],
  ["Per-job reporting", "Every job keeps a timestamped event log and result payload.", "implemented", "available", "none", "automated"],

  // 191-200 Gallery & History
  ["Image gallery", "Virtualised-free but paginated gallery of all imported images.", "implemented", "available", "none", "automated"],
  ["Grid view", "Responsive grid with lazy-loaded thumbnails.", "implemented", "available", "none", "automated"],
  ["List view", "Compact table view with dimensions and size.", "implemented", "available", "none", "automated"],
  ["Filter images", "Filter by project, format, favourites and tags.", "implemented", "available", "none", "automated"],
  ["Search images", "Searches file names, prompts, notes and tags.", "implemented", "available", "none", "automated"],
  ["Categorise images", "Images are grouped by project and tag.", "implemented", "available", "none", "automated"],
  ["Tagging", "Free-form tags with usage counts.", "implemented", "available", "none", "automated"],
  ["Favourites", "One-click favourite state stored in the database.", "implemented", "available", "none", "automated"],
  ["Full generation history", "Every generation is recorded with prompt, engine and duration.", "implemented", "available", "none", "automated"],
  ["Recover the prompt of any image", "Each image row stores original and optimised prompts.", "implemented", "available", "none", "automated"],

  // 201-210 File Management
  ["Save as PNG", "PNG encoding through the image crate.", "implemented", "local-processing", "none", "automated"],
  ["Save as JPEG", "JPEG encoding with adjustable quality.", "implemented", "local-processing", "none", "automated"],
  ["Save as WebP", "WebP encoding through the image crate.", "implemented", "local-processing", "none", "automated"],
  ["Bulk rename", "Pattern-based rename with collision-safe suffixes.", "implemented", "available", "none", "automated"],
  ["Move files", "Per-project output folders are configurable; arbitrary moves are done in the in-app file browser.", "partial", "available", "none", "manual-pending"],
  ["Copy files", "Derivatives are copied into the project Edited folder.", "partial", "available", "none", "automated"],
  ["Secure file deletion", "Overwrites then deletes the file where the OS permits.", "implemented", "requires-consent", "none", "automated"],
  ["Folder management", "Project folder scaffolding and directory creation from the picker.", "implemented", "available", "none", "automated"],
  ["Duplicate file detection", "SHA-256 grouping across the whole library.", "implemented", "local-processing", "none", "automated"],
  ["Metadata management", "Dimensions, format, size and hashes are indexed; EXIF writing is not implemented.", "partial", "local-processing", "none", "automated"],

  // 211-220 Comparison & Review
  ["Before / after comparison", "Slider comparison between any two images.", "implemented", "available", "none", "automated"],
  ["Side-by-side view", "Two-image layout with synchronised zoom.", "implemented", "available", "none", "automated"],
  ["Slider comparison", "Draggable split view.", "implemented", "available", "none", "automated"],
  ["Detail comparison", "Pixel-difference metric plus zoomed inspection.", "implemented", "local-processing", "none", "automated"],
  ["Zoom", "Wheel/drag zoom in the lightbox.", "implemented", "available", "none", "automated"],
  ["Pan", "Drag to pan while zoomed.", "implemented", "available", "none", "automated"],
  ["Fullscreen view", "Fullscreen lightbox overlay.", "implemented", "available", "none", "automated"],
  ["Compare multiple outputs", "Two at a time in the comparison view; the gallery grid is used for wider review.", "partial", "available", "none", "manual-pending"],
  ["Select final version", "Favourite the approved output.", "implemented", "available", "none", "automated"],
  ["Notes on an image", "Per-image notes stored in SQLite.", "implemented", "available", "none", "automated"],

  // 221-230 Prompt Library
  ["Save prompts", "Persistent prompt library with titles and categories.", "implemented", "available", "none", "automated"],
  ["Prompt categories", "Category field with filtering.", "implemented", "available", "none", "automated"],
  ["Prompt search", "Searches title, body and tags.", "implemented", "available", "none", "automated"],
  ["Edit prompts", "Editing creates a new version row.", "implemented", "available", "none", "automated"],
  ["Duplicate prompt", "Client-side copy into a new prompt entry.", "implemented", "available", "none", "automated"],
  ["Prompt templates", "Built-in templates with variables.", "implemented", "available", "none", "automated"],
  ["Dynamic variables", "{{variable}} substitution with a live form.", "tested", "available", "none", "automated"],
  ["Prompt favourites", "Favourite prompts sort first.", "implemented", "available", "none", "automated"],
  ["Version history", "Every saved edit is stored in prompt_versions.", "implemented", "available", "none", "automated"],
  ["Import / export prompts", "JSON round-trip for the whole library.", "implemented", "available", "none", "automated"],

  // 231-240 Automation
  ["Run saved job settings", "Requests are serialised into job params and replayed.", "implemented", "available", "none", "automated"],
  ["Workflow builder", "Visual step editor for generate and local processing steps.", "implemented", "available", "none", "manual-pending"],
  ["Operation chains", "Each step consumes the previous step's output.", "implemented", "available", "none", "manual-pending"],
  ["Batch-process existing files", "Local steps run over workflow outputs; arbitrary folder batch runs are not implemented yet.", "partial", "local-processing", "none", "manual-pending"],
  ["Automatic local operations", "Workflow steps run without manual intervention once started.", "implemented", "local-processing", "none", "manual-pending"],
  ["Allowed triggers", "Workflows start only from explicit user action; no background schedulers.", "implemented", "requires-consent", "none", "automated"],
  ["Automatic post-processing", "Optional post steps after generation.", "implemented", "local-processing", "none", "automated"],
  ["Automatic output saving", "Generated files are imported and saved immediately.", "implemented", "available", "none", "automated"],
  ["Chain error handling", "Each step logs failures and continues with a clear report.", "implemented", "available", "none", "automated"],
  ["Workflow run report", "workflow_runs stores the full log and status.", "implemented", "available", "none", "automated"],

  // 241-250 Workspace & Projects
  ["Create projects", "Projects scaffold Inputs/References/Generated/Variations/Edited/Exports.", "implemented", "available", "none", "automated"],
  ["Manage multiple projects", "Project switcher with counts and archive state.", "implemented", "available", "none", "automated"],
  ["Per-project settings", "Output folder is per project; deeper per-project overrides are not implemented.", "partial", "available", "none", "automated"],
  ["Project images", "Every image is scoped to a project.", "implemented", "available", "none", "automated"],
  ["Project prompts", "Prompts can be scoped to a project.", "implemented", "available", "none", "automated"],
  ["Switch workspace", "Active project is persisted and used as the generation target.", "implemented", "available", "none", "automated"],
  ["Output folder selection", "Native folder picker plus manual path entry.", "implemented", "requires-consent", "none", "automated"],
  ["Archive projects", "Archived projects stay searchable but sort last.", "implemented", "available", "none", "automated"],
  ["Project backup", "Recursive copy into the Backups folder.", "implemented", "available", "none", "automated"],
  ["Project restore", "Restores a backup folder back into Projects.", "implemented", "requires-consent", "none", "manual-pending"],

  // 251-260 Settings
  ["General settings", "Persisted settings.json with validation and clamping.", "implemented", "available", "none", "automated"],
  ["Language", "Persian/English UI switch with RTL support.", "implemented", "available", "none", "automated"],
  ["Theme", "Obsidian and Graphite dark themes.", "implemented", "available", "none", "automated"],
  ["Save location", "Configurable output root and per-project folders.", "implemented", "available", "none", "automated"],
  ["Preview quality", "Thumbnail quality control.", "implemented", "available", "none", "automated"],
  ["Cache settings", "Thumbnail cache size limit setting.", "implemented", "available", "none", "automated"],
  ["History settings", "History retention limit setting.", "implemented", "available", "none", "automated"],
  ["Auto-save behaviour", "Auto-save toggle for prompts and drafts.", "implemented", "available", "none", "automated"],
  ["Notifications", "In-app toast notifications with a master toggle.", "implemented", "available", "none", "automated"],
  ["Reset application settings", "Restores ARIA defaults without touching credentials.", "implemented", "requires-consent", "none", "automated"],

  // 261-270 Performance & Reliability
  ["Async processing", "Long tasks run on blocking worker threads, never the UI thread.", "implemented", "available", "none", "automated"],
  ["Memory management", "Streaming image decode with size guards; no explicit heap accounting.", "partial", "available", "none", "manual-pending"],
  ["Cache management", "Thumbnail cache with configurable budget setting.", "partial", "available", "none", "automated"],
  ["Lazy image loading", "Gallery thumbnails load lazily.", "implemented", "available", "none", "automated"],
  ["Thumbnail generation", "WebP thumbnails generated on import.", "implemented", "local-processing", "none", "automated"],
  ["Crash handling", "Panics are contained in the backend; a crash log is written by Tauri.", "partial", "available", "none", "manual-pending"],
  ["Operation recovery", "Running jobs are requeued after a restart.", "implemented", "available", "none", "automated"],
  ["Timeout management", "Per-run timeout kills the process tree.", "implemented", "available", "none", "manual-pending"],
  ["Codex disruption detection", "Health check compares codex presence, login state and recent failures.", "implemented", "available", "none", "automated"],
  ["Health check system", "Diagnostics page runs ten independent checks.", "implemented", "available", "none", "automated"],

  // 271-280 Security & Privacy
  ["Secure credential storage", "ACL-hardened auth.json plus a DPAPI-encrypted backup.", "implemented", "requires-consent", "DPAPI (Windows)", "manual-pending"],
  ["Dedicated CODEX_HOME", "Credentials and sessions never touch the personal Codex home.", "tested", "available", "none", "automated"],
  ["auth.json protection", "User-only ACLs, secure deletion and no token parsing for display.", "implemented", "available", "none", "automated"],
  ["Log redaction", "JWT and key-like tokens are redacted before display or storage.", "tested", "available", "none", "automated"],
  ["File access control", "All app files live under one root with per-profile isolation.", "implemented", "available", "none", "automated"],
  ["No unintended command execution", "Only fixed Codex argument vectors are executed; no shell interpolation of prompts.", "implemented", "available", "none", "automated"],
  ["Workspace permissions", "Codex runs in workspace-write sandbox mode by default.", "implemented", "available", "none", "automated"],
  ["Secure account data deletion", "Overwrite-then-delete for credential files and folders.", "implemented", "requires-consent", "none", "automated"],
  ["No unintended uploads", "ARIA only talks to Codex locally; nothing is uploaded to ARIA servers.", "implemented", "available", "none", "automated"],
  ["Security report", "Diagnostics export contains no credentials or image pixels.", "implemented", "available", "none", "automated"],

  // 281-290 Analytics & Reporting
  ["Images generated count", "Aggregated from the images table.", "implemented", "available", "none", "automated"],
  ["Successful jobs count", "Aggregated from the jobs table.", "implemented", "available", "none", "automated"],
  ["Failed jobs count", "Aggregated from the jobs table.", "implemented", "available", "none", "automated"],
  ["Average generation time", "Mean duration of successful generations.", "implemented", "available", "none", "automated"],
  ["Disk usage report", "Database byte totals plus a filesystem scan of the ARIA root.", "implemented", "available", "none", "automated"],
  ["Codex status report", "Health check output for the installed CLI and session.", "implemented", "available", "none", "automated"],
  ["Model status report", "Reports the configured model or that the model is managed by Codex.", "partial", "codex-account", "Codex models cache", "manual-pending"],
  ["Workflow performance report", "Run logs with per-step outcomes and timings are stored.", "implemented", "available", "none", "automated"],
  ["Error report", "Failed generations carry the engine error and exit code.", "implemented", "available", "none", "automated"],
  ["Report export", "Markdown reports for analytics, diagnostics and the feature registry.", "implemented", "available", "none", "automated"],

  // 291-300 Professional Experience
  ["Guided onboarding", "Four-step first-run flow for account, engine, project and first image.", "implemented", "available", "none", "manual-pending"],
  ["Dashboard", "Live counts, engine health, queue state and recent work.", "implemented", "available", "none", "manual-pending"],
  ["Quick actions", "Dashboard shortcuts to create, edit and review.", "implemented", "available", "none", "automated"],
  ["Keyboard shortcuts", "Global shortcut map with an in-app reference.", "implemented", "available", "none", "automated"],
  ["Command palette", "Ctrl/Cmd+K palette over every page and action.", "implemented", "available", "none", "manual-pending"],
  ["In-app help", "Contextual guidance on every page plus a help drawer.", "implemented", "available", "none", "automated"],
  ["Update system", "Checks GitHub Releases, shows notes and opens the verified download.", "partial", "available", "GitHub Releases", "automated"],
  ["Settings export / import", "Settings are a documented JSON file; UI-level export is not wired yet.", "partial", "available", "none", "automated"],
  ["Feature registry management", "All 300 capabilities mirrored to SQLite with status filters and export.", "implemented", "available", "none", "automated"],
  ["Diagnostics & support bundle", "One-click bundle with checks, versions and no secrets.", "implemented", "available", "none", "automated"],
);

export const EXPECTED_FEATURE_COUNT = 300;

function categoryFor(number: number): Category {
  const found = CATEGORIES.find((category) => number >= category.from && number <= category.to);
  return found ?? CATEGORIES[CATEGORIES.length - 1];
}

export const FEATURES: Feature[] = ROWS.map((row, index) => {
  const number = index + 1;
  const category = categoryFor(number);
  const [name, description, status, availability, dependencies = "", testStatus = "manual-pending"] = row;
  return {
    id: String(number).padStart(3, "0"),
    category: category.id,
    categoryLabel: category.label,
    categoryLabelFa: category.labelFa,
    name,
    description,
    status,
    availability,
    dependencies,
    testStatus,
  };
});

export const REGISTRY_HEALTH = {
  expected: EXPECTED_FEATURE_COUNT,
  actual: FEATURES.length,
  complete: FEATURES.length === EXPECTED_FEATURE_COUNT,
  duplicateIds: FEATURES.length - new Set(FEATURES.map((feature) => feature.id)).size,
};

export function featureStats() {
  const byStatus: Record<string, number> = {};
  for (const feature of FEATURES) {
    byStatus[feature.status] = (byStatus[feature.status] ?? 0) + 1;
  }
  const shipped = (byStatus.tested ?? 0) + (byStatus.implemented ?? 0);
  return {
    total: FEATURES.length,
    byStatus,
    shipped,
    partial: byStatus.partial ?? 0,
    unsupported: byStatus.unsupported ?? 0,
    completion: FEATURES.length ? Math.round((shipped / FEATURES.length) * 100) : 0,
  };
}

export function featuresByCategory(categoryId: string): Feature[] {
  return FEATURES.filter((feature) => feature.category === categoryId);
}

export const STATUS_LABELS: Record<FeatureStatus, string> = {
  tested: "Tested",
  implemented: "Implemented",
  partial: "Partially implemented",
  unsupported: "Unsupported by engine",
  blocked: "Blocked",
  planned: "Planned",
};

export const STATUS_LABELS_FA: Record<FeatureStatus, string> = {
  tested: "تست‌شده",
  implemented: "پیاده‌سازی شده",
  partial: "ناقص",
  unsupported: "پشتیبانی نمی‌شود",
  blocked: "مسدود",
  planned: "برنامه‌ریزی‌شده",
};
