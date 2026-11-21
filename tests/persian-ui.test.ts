import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { FEATURE_NAMES_FA, featureNameFa } from "../apps/desktop/src/lib/feature-names.fa";
import { faLabel, ERROR_MESSAGES_FA } from "../packages/core/src/locale";
import { ASPECT_PRESETS, analyzePrompt } from "@aria/prompt-engine";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const persian = /[\u0600-\u06ff]/;

describe("Persian light interface regression checks", () => {
  it("has a Persian name for every stable feature ID", () => {
    expect(FEATURE_NAMES_FA).toHaveLength(300);
    for (let i = 1; i <= 300; i++) expect(featureNameFa(String(i))).toMatch(persian);
  });
  it("uses Persian page headings on all 20 pages", () => {
    const pages = readdirSync(resolve(root, "apps/desktop/src/pages"));
    expect(pages).toHaveLength(20);
    for (const page of pages) {
      const source = read(`apps/desktop/src/pages/${page}`);
      const heading = source.match(/<PageHeader[\s\S]*?title="([^"]+)"/);
      if (heading) expect(heading[1], page).toMatch(persian);
      else if (page === "Dashboard.tsx") {
        expect(source).toContain("title={greeting}");
        expect(source).toContain("صبح بخیر");
      } else expect(source, page).toMatch(/<h1[ >]/);
    }
  });
  it("ships RTL metadata, a light default, and the requested local fonts", () => {
    expect(read("apps/desktop/index.html")).toContain('lang="fa" dir="rtl"');
    expect(read("apps/desktop/src/store.ts")).toContain('theme: "light"');
    const css = read("packages/ui/src/theme.css");
    for (const weight of ["Medium", "Bold", "Black"]) {
      const name = `PeydaFaNum-${weight}.ttf`;
      expect(css).toContain(name);
      expect(existsSync(resolve(root, `packages/ui/src/fonts/${name}`))).toBe(true);
    }
    const settings = read("apps/desktop/src-tauri/src/settings.rs");
    expect(settings).toContain('settings.theme = "light"');
    expect(settings).toContain('settings.language = "fa"');
    expect(settings).toContain('settings.locale_direction = "rtl"');
  });
  it("presents statuses and actionable app errors in Persian without changing IDs", () => {
    for (const status of ["queued", "running", "failed", "succeeded", "authenticated", "manual-pending"])
      expect(faLabel(status)).toMatch(persian);
    expect(faLabel("gpt-5-codex")).toBe("gpt-5-codex");
    for (const text of Object.values(ERROR_MESSAGES_FA)) expect(text).toMatch(persian);
  });
  it("presents aspect names and analysis advice in Persian", () => {
    for (const aspect of ASPECT_PRESETS) expect(aspect.label).toMatch(persian);
    for (const tip of analyzePrompt("a").tips) expect(tip).toMatch(persian);
  });
  it("routes every production child-process constructor through no-window policy", () => {
    const directory = "apps/desktop/src-tauri/src";
    for (const file of readdirSync(resolve(root, directory)).filter((name) => name.endsWith(".rs") && name !== "sysproc.rs")) {
      expect(read(`${directory}/${file}`), file).not.toMatch(/\bCommand::new\s*\(/);
    }
    expect(read(`${directory}/sysproc.rs`)).toContain("cmd.creation_flags(CREATE_NO_WINDOW)");
    expect(read(`${directory}/main.rs`)).toContain('windows_subsystem = "windows"');
  });
});
