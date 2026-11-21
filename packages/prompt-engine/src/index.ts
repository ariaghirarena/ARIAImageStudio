/**
 * @aria/prompt-engine — ARIA Prompt Intelligence.
 *
 * Deterministic prompt shaping: it never invents subjects or brand names, it
 * only structures what the user already asked for and adds production
 * vocabulary (composition, lighting, materials) from explicit presets.
 * Model-specific parameters are never fabricated here.
 */

export type PromptLanguage = "auto" | "fa" | "en";

export interface Preset {
  id: string;
  label: string;
  labelFa: string;
  note: string;
  directive: string;
  tags?: string[];
}

export interface PromptInput {
  raw: string;
  presetId?: string;
  styleId?: string;
  lightingId?: string;
  cameraId?: string;
  compositionId?: string;
  aspect?: string;
  negative?: string;
  intendedUse?: string;
  requiredElements?: string[];
  forbiddenElements?: string[];
  referenceRoles?: string[];
  language?: PromptLanguage;
  includeStructure?: boolean;
}

export interface BuiltPrompt {
  structured: string;
  compact: string;
  sections: { label: string; value: string }[];
  language: "fa" | "en" | "mixed";
  preservedUserIntent: string;
  notes: string[];
  needsTranslation: boolean;
}

export const QUALITY_PRESETS: Preset[] = [
  {
    id: "aria-best-quality",
    label: "ARIA Best Quality",
    labelFa: "بهترین کیفیت ARIA",
    note: "Balanced top quality for any subject with explicit invariants.",
    directive:
      "Photorealistic or best-fit medium for the subject, ultra-detailed textures, clean edges, intentional composition, professional lighting, no watermark, no logo, no text unless requested, no extra subject.",
  },
  {
    id: "photorealistic",
    label: "Photorealistic",
    labelFa: "واقع‌گرا",
    note: "Natural camera look with believable materials.",
    directive:
      "Photorealistic photograph, natural materials and micro-texture, realistic skin or surface detail, accurate perspective, true-to-life color response, no illustration stylization.",
  },
  {
    id: "ultra-detailed",
    label: "Ultra Detailed",
    labelFa: "فوق‌پرجزئیات",
    note: "Maximum micro-detail without changing the subject.",
    directive:
      "Extremely detailed rendering, crisp micro-texture, layered depth, controlled highlights, disciplined negative space, no clutter beyond the requested subject.",
  },
  {
    id: "cinematic",
    label: "Cinematic",
    labelFa: "سینمایی",
    note: "Filmic contrast, motivated light, restrained palette.",
    directive:
      "Cinematic still frame, anamorphic feel, motivated key light, deep controlled shadows, filmic color grade, subtle grain, wide tonal range.",
  },
  {
    id: "luxury-commercial",
    label: "Luxury Commercial",
    labelFa: "تبلیغاتی لوکس",
    note: "Premium advertising look, restrained and expensive.",
    directive:
      "Luxury advertising still, premium finish, soft directional studio light, elegant reflections, refined minimal set, sophisticated restraint, no cheap effects.",
  },
  {
    id: "product-photography",
    label: "Product Photography",
    labelFa: "عکاسی محصول",
    note: "Catalog-grade product fidelity.",
    directive:
      "Professional product photograph, exact product shape and proportions preserved, clean edge light, controlled specular highlights, realistic reflections, seamless background, no distortion.",
  },
  {
    id: "professional-portrait",
    label: "Professional Portrait",
    labelFa: "پرتره حرفه‌ای",
    note: "Natural skin, flattering light, identity preserved.",
    directive:
      "Professional portrait, natural skin texture, flattering soft key light with subtle rim, accurate eye detail, identity and facial structure preserved exactly.",
  },
  {
    id: "editorial",
    label: "Editorial",
    labelFa: "ادیتوریال",
    note: "Magazine still, deliberate styling.",
    directive:
      "Editorial magazine still, intentional styling, strong graphic composition, tasteful color story, refined negative space, high-end print finish.",
  },
  {
    id: "e-commerce",
    label: "E-Commerce",
    labelFa: "فروشگاهی",
    note: "Marketplace-ready clarity.",
    directive:
      "E-commerce ready image, product fully in frame, faithful color, clean neutral background, even illumination, no props that hide the product, sharp focus front to back.",
  },
  {
    id: "minimal",
    label: "Minimal",
    labelFa: "مینیمال",
    note: "Few elements, strong hierarchy.",
    directive:
      "Minimal composition, one clear focal subject, generous negative space, restrained palette, soft even light, no decorative noise.",
  },
  {
    id: "creative-art",
    label: "Creative Art",
    labelFa: "هنری خلاق",
    note: "Concept-led, stylistically bold.",
    directive:
      "Conceptual art piece, expressive composition, deliberate stylization, cohesive palette, strong focal hierarchy, gallery-quality finish.",
  },
  {
    id: "architectural",
    label: "Architectural Visualization",
    labelFa: "معماری",
    note: "Accurate perspective, believable light.",
    directive:
      "Architectural visualization, physically plausible perspective, accurate verticals, natural daylight bounce, believable materials, realistic scale cues.",
  },
  {
    id: "fashion-campaign",
    label: "Fashion Campaign",
    labelFa: "کمپین مد",
    note: "Campaign energy, garment fidelity.",
    directive:
      "Fashion campaign image, garment construction and drape preserved, confident pose, directional studio or location light, editorial color grade.",
  },
  {
    id: "food-photography",
    label: "Food Photography",
    labelFa: "عکاسی غذا",
    note: "Appetite appeal, honest texture.",
    directive:
      "Food photography, fresh believable texture, controlled specular highlights, soft side light, natural steam or crumb detail, appetizing color without oversaturation.",
  },
  {
    id: "jewelry-photography",
    label: "Jewelry Photography",
    labelFa: "عکاسی جواهرات",
    note: "Tiny detail, controlled sparkle.",
    directive:
      "Jewelry macro photograph, precise metal and stone detail, controlled sparkle, gradient background, no blown highlights, exact gemstone color.",
  },
];

export const STYLE_PRESETS: Preset[] = [
  { id: "photoreal", label: "Photorealistic", labelFa: "واقع‌گرا", note: "", directive: "photorealistic finish" },
  { id: "cinematic", label: "Cinematic", labelFa: "سینمایی", note: "", directive: "cinematic color grade, filmic contrast" },
  { id: "minimal", label: "Minimalist", labelFa: "مینیمال", note: "", directive: "minimalist composition" },
  { id: "surreal", label: "Surrealism", labelFa: "سورئال", note: "", directive: "surreal dreamlike logic" },
  { id: "cyberpunk", label: "Cyberpunk", labelFa: "سایبرپانک", note: "", directive: "cyberpunk neon palette" },
  { id: "vintage", label: "Vintage", labelFa: "وینتیج", note: "", directive: "vintage analog character, gentle halation" },
  { id: "editorial", label: "Editorial", labelFa: "ادیتوریال", note: "", directive: "editorial print styling" },
  { id: "render3d", label: "3D Render", labelFa: "رندر سه‌بعدی", note: "", directive: "clean 3D render, physically based materials" },
  { id: "illustration", label: "Illustration", labelFa: "تصویرسازی", note: "", directive: "crafted illustration with deliberate line work" },
];

export const LIGHTING_PRESETS: Preset[] = [
  { id: "natural", label: "Natural", labelFa: "طبیعی", note: "", directive: "soft natural daylight" },
  { id: "studio", label: "Studio", labelFa: "استودیویی", note: "", directive: "controlled studio lighting with reflective fill" },
  { id: "cinematic", label: "Cinematic", labelFa: "سینمایی", note: "", directive: "motivated cinematic key with deep falloff" },
  { id: "soft", label: "Soft", labelFa: "نرم", note: "", directive: "large soft source, gentle shadow transition" },
  { id: "hard", label: "Hard", labelFa: "سخت", note: "", directive: "hard directional light with crisp shadow edges" },
  { id: "backlit", label: "Backlit", labelFa: "نور پشت", note: "", directive: "backlight with luminous rim separation" },
  { id: "rim", label: "Rim Light", labelFa: "نور لبه", note: "", directive: "thin rim light separating subject from background" },
];

export const CAMERA_PRESETS: Preset[] = [
  { id: "wide", label: "Wide 24mm", labelFa: "واید ۲۴", note: "environmental context", directive: "24mm wide perspective, deep environment" },
  { id: "standard", label: "Standard 50mm", labelFa: "استاندارد ۵۰", note: "natural perspective", directive: "50mm natural perspective" },
  { id: "portrait", label: "Portrait 85mm", labelFa: "پرتره ۸۵", note: "flattering compression", directive: "85mm portrait compression, shallow depth of field" },
  { id: "macro", label: "Macro 100mm", labelFa: "ماکرو ۱۰۰", note: "extreme detail", directive: "100mm macro, razor focus on the subject detail" },
  { id: "tele", label: "Telephoto 200mm", labelFa: "تله ۲۰۰", note: "compressed background", directive: "200mm telephoto compression, isolated subject" },
  { id: "topdown", label: "Top-down", labelFa: "از بالا", note: "flat lay", directive: "top-down flat lay view" },
  { id: "isometric", label: "Isometric", labelFa: "ایزومتریک", note: "diagram-like", directive: "isometric three-quarter view" },
];

export const COMPOSITION_PRESETS: Preset[] = [
  { id: "centered", label: "Centered", labelFa: "مرکزگرا", note: "", directive: "subject centered with balanced margins" },
  { id: "rule-thirds", label: "Rule of Thirds", labelFa: "قانون یک‌سوم", note: "", directive: "subject placed on a third line" },
  { id: "negative-space", label: "Negative Space", labelFa: "فضای منفی", note: "", directive: "generous negative space for copy" },
  { id: "close-up", label: "Close-up", labelFa: "نمای نزدیک", note: "", directive: "tight close-up framing" },
  { id: "medium", label: "Medium Shot", labelFa: "نمای متوسط", note: "", directive: "medium shot framing" },
  { id: "full", label: "Full Shot", labelFa: "نمای باز", note: "", directive: "full shot with headroom and floor" },
  { id: "symmetry", label: "Symmetry", labelFa: "تقارن", note: "", directive: "symmetrical composition" },
];

export const ASPECT_PRESETS = [
  { id: "1:1", label: "۱:۱ مربع" },
  { id: "4:5", label: "۴:۵ عمودی" },
  { id: "3:4", label: "۳:۴ عمودی" },
  { id: "2:3", label: "۲:۳ پوستر" },
  { id: "16:9", label: "۱۶:۹ افقی" },
  { id: "9:16", label: "۹:۱۶ استوری" },
  { id: "21:9", label: "۲۱:۹ سینمایی" },
  { id: "3:2", label: "۳:۲ عکس" },
];

export const PROMPT_TEMPLATES = [
  {
    id: "product-white",
    title: "Product on white",
    titleFa: "محصول روی پس‌زمینه سفید",
    body: "{{product}} on a seamless white background, centered, soft studio light from the upper left, subtle contact shadow, exact color and proportions, no props, no text, intended for an online store listing",
    category: "product",
  },
  {
    id: "lifestyle",
    title: "Lifestyle scene",
    titleFa: "صحنه لایف‌استایل",
    body: "{{product}} used naturally in a real {{environment}}, hands interacting with it, soft window light, believable depth of field, authentic moment, no staged perfection",
    category: "marketing",
  },
  {
    id: "portrait",
    title: "Portrait",
    titleFa: "پرتره",
    body: "Portrait of {{subject}}, 85mm, natural skin texture, soft key light with a subtle rim, shallow depth of field, neutral background, identity preserved",
    category: "portrait",
  },
  {
    id: "hero",
    title: "Website hero",
    titleFa: "هیرو وب‌سایت",
    body: "Wide hero image for a {{industry}} website, {{subject}} on the right third, generous negative space on the left for headlines, cinematic lighting, cohesive brand palette",
    category: "design",
  },
  {
    id: "social",
    title: "Social post",
    titleFa: "پست شبکه اجتماعی",
    body: "Square social post featuring {{subject}}, bold graphic composition, high contrast, one clear focal point, space at the top for a short caption",
    category: "social",
  },
];

export const NEGATIVE_DEFAULTS = [
  "watermark",
  "logo",
  "signature",
  "blurry",
  "overexposed",
  "distorted proportions",
  "extra fingers",
  "duplicate subject",
  "garbled text",
  "clutter",
];

function normalize(text: string): string {
  return text
    .replace(/[\u200c]/g, " ")
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/\s+/g, " ")
    .trim();
}

export function detectLanguage(text: string): "fa" | "en" | "mixed" {
  const persian = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  if (persian > 0 && latin > 0) return persian > latin ? "fa" : "mixed";
  if (persian > 0) return "fa";
  return "en";
}

export function findPreset(id: string | undefined, list: Preset[]): Preset | undefined {
  if (!id) return undefined;
  return list.find((preset) => preset.id === id);
}

export interface PromptAnalysis {
  language: "fa" | "en" | "mixed";
  words: number;
  score: number;
  hasSubject: boolean;
  hasStyle: boolean;
  hasLighting: boolean;
  hasComposition: boolean;
  hasAspect: boolean;
  hasNegative: boolean;
  ambiguous: boolean;
  tips: string[];
}

export function analyzePrompt(raw: string, negative = "", aspect = ""): PromptAnalysis {
  const text = normalize(raw);
  const words = text ? text.split(" ").length : 0;
  const lower = text.toLowerCase();
  const hasStyle = /(photo|realistic|cinematic|minimal|surreal|cyberpunk|vintage|illustration|render|هنری|واقع|سینمایی|مینیمال|سورئال)/.test(lower);
  const hasLighting = /(light|lighting|shadow|golden hour|studio|backlit|rim|نور|سایه)/.test(lower);
  const hasComposition = /(close-?up|wide|medium shot|centered|third|negative space|نمای|کادر|ترکیب)/.test(lower);
  const hasAspect = Boolean(aspect) || /\b\d{1,2}:\d{1,2}\b/.test(text);
  const hasNegative = negative.trim().split(",").filter(Boolean).length > 0;
  const hasSubject = words >= 3;
  const ambiguous = words < 4 || /^(something|anything|nice|good|whatever|یه چیزی|چیزی|قشنگ)$/i.test(text);
  let score = 20;
  if (hasSubject) score += 16;
  if (words >= 8) score += 12;
  if (words >= 16) score += 8;
  if (hasStyle) score += 12;
  if (hasLighting) score += 10;
  if (hasComposition) score += 10;
  if (hasAspect) score += 6;
  if (hasNegative) score += 6;
  const tips: string[] = [];
  if (!hasSubject) tips.push("موضوع اصلی تصویر را با چند کلمه مشخص کنید.");
  if (words < 8) tips.push("یک جزئیات مشخص مثل جنس، محیط یا حس تصویر اضافه کنید.");
  if (!hasLighting) tips.push("برای مشخص‌شدن نور، یک تنظیم آماده نور انتخاب کنید.");
  if (!hasComposition) tips.push("برای مشخص‌شدن کادر، یک ترکیب‌بندی انتخاب کنید.");
  if (!hasAspect) tips.push("نسبت ابعاد مناسب محل استفاده تصویر را مشخص کنید.");
  if (!hasNegative) tips.push("برای جلوگیری از واترمارک و شلوغی، موارد ممنوعه را بنویسید.");
  return {
    language: detectLanguage(text),
    words,
    score: Math.min(100, score),
    hasSubject,
    hasStyle,
    hasLighting,
    hasComposition,
    hasAspect,
    hasNegative,
    ambiguous,
    tips,
  };
}

function push(sections: { label: string; value: string }[], label: string, value: string | undefined) {
  const clean = (value ?? "").trim();
  if (clean) sections.push({ label, value: clean });
}

/**
 * Build a structured prompt. The user's own wording is always the primary
 * request; preset directives only describe production technique.
 */
export function buildPrompt(input: PromptInput): BuiltPrompt {
  const raw = normalize(input.raw);
  const notes: string[] = [];
  const language = input.language && input.language !== "auto" ? input.language : detectLanguage(raw);
  const quality = findPreset(input.presetId ?? "aria-best-quality", QUALITY_PRESETS);
  const style = findPreset(input.styleId, STYLE_PRESETS);
  const lighting = findPreset(input.lightingId, LIGHTING_PRESETS);
  const camera = findPreset(input.cameraId, CAMERA_PRESETS);
  const composition = findPreset(input.compositionId, COMPOSITION_PRESETS);
  const useCase = input.intendedUse?.trim() || "general image asset";
  const required = (input.requiredElements ?? []).map((v) => v.trim()).filter(Boolean);
  const forbidden = (input.forbiddenElements ?? []).map((v) => v.trim()).filter(Boolean);
  const negativeParts = normalize(input.negative ?? "")
    .split(/[,،]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const negatives = [...new Set([...negativeParts, ...forbidden])];

  const sections: { label: string; value: string }[] = [];
  push(sections, "Use case", useCase);
  push(sections, "Primary request", raw);
  if (input.referenceRoles?.length) {
    push(sections, "Input images", input.referenceRoles.map((role, i) => `Image ${i + 1}: ${role}`).join("; "));
  }
  if (quality) push(sections, "Quality", quality.directive);
  if (style) push(sections, "Style/medium", style.directive);
  if (composition) push(sections, "Composition", composition.directive);
  if (camera) push(sections, "Camera", camera.directive);
  if (lighting) push(sections, "Lighting/mood", lighting.directive);
  if (input.aspect) push(sections, "Framing note", `compose for ${input.aspect} aspect ratio, keep the subject inside the safe area`);
  if (required.length) push(sections, "Must keep", required.join("; "));
  if (negatives.length) push(sections, "Avoid", negatives.join("; "));
  push(sections, "Deliverable", "one clean final image, no watermark, no extra subject");

  const structured = sections.map((section) => `${section.label}: ${section.value}`).join("\n");
  const compactParts = [
    raw,
    quality?.directive,
    style?.directive,
    composition?.directive,
    camera?.directive,
    lighting?.directive,
    input.aspect ? `compose for ${input.aspect}` : "",
    negatives.length ? `avoid: ${negatives.join(", ")}` : "",
  ].filter(Boolean);
  const compact = compactParts.join(". ").replace(/\.\.+/g, ".") + ".";

  if (language === "fa") {
    notes.push("The request is in Persian; the model is prompted with the original wording so intent is preserved.");
  }
  if (!raw) notes.push("No prompt text was provided.");
  if (quality?.id === "aria-best-quality") notes.push("ARIA Best Quality preset active: invariants are stated explicitly to reduce drift.");
  if (negatives.length === 0) notes.push("No negative constraints were supplied.");

  return {
    structured: input.includeStructure === false && raw ? raw : structured,
    compact,
    sections,
    language: language as "fa" | "en" | "mixed",
    preservedUserIntent: raw,
    notes,
    needsTranslation: language === "fa",
  };
}

export function scorePrompt(raw: string, negative = "", aspect = ""): number {
  return analyzePrompt(raw, negative, aspect).score;
}

export function applyTemplate(body: string, variables: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (_match, key: string) => {
    const value = variables[key];
    return value === undefined || value === "" ? `{{${key}}}` : value;
  });
}

export function templateVariables(body: string): string[] {
  const found = new Set<string>();
  const regex = /\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body)) !== null) found.add(match[1]);
  return [...found];
}

/** Instruction used when Codex is asked to refine a prompt. */
export function refinementInstruction(raw: string, targetLanguage: "en" | "fa"): string {
  return [
    "You are ARIA Prompt Intelligence, a prompt editor for an image generation model.",
    "Rewrite the user's request into one precise, production-ready prompt.",
    "Rules: keep the user's subject and intent exactly, do not invent new objects, brands or text, do not add camera or model parameters unless they are expressed as plain descriptive language, and never mention that you are an AI.",
    targetLanguage === "en" ? "Answer in English only." : "Answer in Persian only.",
    "Answer with the prompt text only — no explanations, no quotes, no markdown.",
    `User request: ${raw}`,
  ].join("\n");
}

export function translationInstruction(raw: string): string {
  return [
    "Translate the following image prompt into natural, precise English for an image model.",
    "Preserve every detail and never add new elements. Answer with the translation only, no commentary.",
    raw,
  ].join("\n");
}
