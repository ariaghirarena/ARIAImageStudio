import { describe, expect, it } from "vitest";
import { CATEGORIES, FEATURES, REGISTRY_HEALTH, STATUS_LABELS, featureStats } from "@aria/feature-registry";

describe("feature registry", () => {
  it("contains exactly 300 features with no duplicates", () => {
    expect(FEATURES).toHaveLength(300);
    expect(REGISTRY_HEALTH.complete).toBe(true);
    expect(REGISTRY_HEALTH.duplicateIds).toBe(0);
  });

  it("covers 30 categories of 10 features each", () => {
    expect(CATEGORIES).toHaveLength(30);
    for (const category of CATEGORIES) {
      expect(FEATURES.filter((feature) => feature.category === category.id)).toHaveLength(10);
    }
  });

  it("uses only the documented status vocabulary", () => {
    const allowed = new Set(Object.keys(STATUS_LABELS));
    for (const feature of FEATURES) {
      expect(allowed.has(feature.status)).toBe(true);
      expect(feature.name.trim().length).toBeGreaterThan(1);
      expect(feature.description.length).toBeGreaterThan(10);
    }
  });

  it("reports totals that add up", () => {
    const stats = featureStats();
    const sum = Object.values(stats.byStatus).reduce((total, value) => total + value, 0);
    expect(sum).toBe(300);
    expect(stats.shipped + stats.partial + stats.unsupported).toBe(300);
  });
});
