import { describe, expect, it } from "vitest";
import {
  ASPECT_PRESETS,
  NEGATIVE_DEFAULTS,
  QUALITY_PRESETS,
  analyzePrompt,
  applyTemplate,
  buildPrompt,
  detectLanguage,
  templateVariables,
} from "@aria/prompt-engine";

describe("prompt engine", () => {
  it("detects Persian, English and mixed input", () => {
    expect(detectLanguage("یک عکس تبلیغاتی از عطر")).toBe("fa");
    expect(detectLanguage("a studio photo of a bottle")).toBe("en");
    expect(detectLanguage("عطر bottle با نور soft")).toBe("mixed");
  });

  it("scores a detailed prompt higher than a vague one", () => {
    const vague = analyzePrompt("nice thing");
    const detailed = analyzePrompt(
      "Photorealistic studio product photo of a black perfume bottle on marble, soft rim light from the left, centered composition with negative space, 4:5, cinematic",
      "watermark, text",
      "4:5",
    );
    expect(detailed.score).toBeGreaterThan(vague.score);
    expect(detailed.hasLighting).toBe(true);
    expect(detailed.hasAspect).toBe(true);
    expect(vague.ambiguous).toBe(true);
  });

  it("keeps the user's subject verbatim in the structured prompt", () => {
    const built = buildPrompt({ raw: "a ceramic vase on linen", presetId: QUALITY_PRESETS[0].id, aspect: "4:5" });
    expect(built.structured).toContain("ceramic vase on linen");
    expect(built.compact.length).toBeGreaterThan(0);
    expect(built.structured.length).toBeGreaterThan(built.compact.length);
  });

  it("adds explicit negatives without inventing subjects", () => {
    const built = buildPrompt({ raw: "red apple", negative: "watermark" });
    expect(built.structured.toLowerCase()).toContain("watermark");
    expect(built.structured.toLowerCase()).not.toContain("banana");
  });

  it("fills template variables and reports missing ones", () => {
    const body = "{{product}} on a seamless backdrop in {{environment}}";
    expect(templateVariables(body)).toEqual(["product", "environment"]);
    expect(applyTemplate(body, { product: "bottle" })).toBe("bottle on a seamless backdrop in {{environment}}");
  });

  it("ships a coherent preset catalogue", () => {
    expect(QUALITY_PRESETS.length).toBeGreaterThanOrEqual(10);
    expect(NEGATIVE_DEFAULTS).toContain("watermark");
    expect(ASPECT_PRESETS.some((preset) => preset.id === "4:5" || preset.id === "1:1")).toBe(true);
    const ids = QUALITY_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
