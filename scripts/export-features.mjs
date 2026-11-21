#!/usr/bin/env node
/**
 * Compiles the TypeScript feature registry and renders FEATURES-300.md.
 * Usage: node scripts/export-features.mjs [outputPath]
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tsc = join(root, "node_modules", "typescript", "bin", "tsc");
const outDir = mkdtempSync(join(tmpdir(), "aria-registry-"));

const compile = spawnSync(
  process.execPath,
  [tsc, join(root, "packages/feature-registry/src/index.ts"), "--outDir", outDir, "--target", "ES2022", "--module", "ESNext", "--moduleResolution", "bundler", "--skipLibCheck"],
  { stdio: "inherit" },
);
if (compile.status !== 0) process.exit(compile.status ?? 1);

const registry = await import(pathToFileURL(join(outDir, "index.js")).href);
const { FEATURES, CATEGORIES, featureStats, REGISTRY_HEALTH, STATUS_LABELS } = registry;
const stats = featureStats();

const esc = (value) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
const lines = [];

lines.push("# ARIA Image Studio — 300 Feature Registry");
lines.push("");
lines.push("> Generated from `packages/feature-registry/src/index.ts` — the single source of truth that the app also ships and syncs into SQLite.");
lines.push("> Status vocabulary is deliberately conservative: nothing is marked Tested unless it has been exercised end to end.");
lines.push("");
lines.push(`- Registry integrity: **${REGISTRY_HEALTH.actual}/${REGISTRY_HEALTH.expected}** rows, duplicate ids: **${REGISTRY_HEALTH.duplicateIds}**`);
lines.push(`- Implemented + tested: **${stats.shipped}** features (${stats.completion}%)`);
lines.push(`- Partially implemented: **${stats.partial}** · Unsupported by the engine: **${stats.unsupported}**`);
lines.push(`- Categories: **${CATEGORIES.length}** × 10 features`);
lines.push("");
lines.push("## Status summary");
lines.push("");
lines.push("| Status | Count | Meaning |");
lines.push("| --- | --- | --- |");
const meaning = {
  tested: "Built and exercised against a real Codex installation",
  implemented: "Built and wired to a real command; not yet exercised on a signed-in account in CI",
  partial: "Works, but with a documented limitation",
  unsupported: "The Codex engine does not expose this capability",
  blocked: "Cannot be completed until an external dependency changes",
  planned: "Not built yet",
};
for (const [status, count] of Object.entries(stats.byStatus)) {
  lines.push(`| ${STATUS_LABELS[status]} | ${count} | ${meaning[status] ?? ""} |`);
}
lines.push("");

for (const category of CATEGORIES) {
  const rows = FEATURES.filter((feature) => feature.category === category.id);
  lines.push(`## ${category.label} (${rows[0]?.id}–${rows[rows.length - 1]?.id})`);
  lines.push("");
  lines.push(`_${category.labelFa}_`);
  lines.push("");
  lines.push("| # | Feature | Status | Availability | Dependencies | Test state |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const feature of rows) {
    lines.push(`| ${feature.id} | **${esc(feature.name)}** — ${esc(feature.description)} | ${STATUS_LABELS[feature.status]} | ${esc(feature.availability)} | ${esc(feature.dependencies) || "—"} | ${esc(feature.testStatus)} |`);
  }
  lines.push("");
}

lines.push("## How to verify");
lines.push("");
lines.push("1. Open **Diagnostics** inside the app — the same matrix is rendered with live filters, plus installation checks.");
lines.push("2. Run `npm run features` to regenerate this document from source.");
lines.push("3. Export from the app (**Diagnostics → Export markdown**) to compare the shipped DB rows with the source rows.");
lines.push("");

const target = resolve(process.argv[2] ?? join(root, "FEATURES-300.md"));
writeFileSync(target, lines.join("\n"), "utf8");
console.log(`Wrote ${target} (${FEATURES.length} features)`);
