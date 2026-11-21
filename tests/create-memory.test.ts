import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { readCreateMemory, writeCreateMemory, recoverMessages } from "../apps/desktop/src/lib/create-memory";

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  });
});
describe("Create conversation memory", () => {
  it("restores Persian drafts, settings, references and conversation after recreation", () => {
    const messages = [{ id: "1", role: "user", text: "ماشین رولزرویس" }, { id: "2", role: "ai", text: "تصویر ساخته شد", status: "succeeded", images: [{ path: "C:/images/car.png" }] }];
    expect(writeCreateMemory("messages", messages)).toBe(true);
    expect(readCreateMemory("messages", [])).toEqual(messages);
    writeCreateMemory("raw", "پیش‌نویس بعدی");
    writeCreateMemory("aspect", "16:9");
    writeCreateMemory("selectedRefs", ["C:/personal photo.png"]);
    expect(readCreateMemory("raw", "")).toBe("پیش‌نویس بعدی");
    expect(readCreateMemory("aspect", "4:5")).toBe("16:9");
    expect(readCreateMemory("selectedRefs", [])).toEqual(["C:/personal photo.png"]);
  });
  it("handles corrupted, wrong-shaped or unavailable storage", () => {
    localStorage.setItem("aria:create:v1:messages", "broken");
    expect(readCreateMemory("messages", [])).toEqual([]);
    localStorage.setItem("aria:create:v1:messages", "{}");
    expect(readCreateMemory("messages", [])).toEqual([]);
    vi.stubGlobal("localStorage", { getItem: () => { throw Error(); }, setItem: () => { throw Error(); } });
    expect(readCreateMemory("raw", "")).toBe("");
    expect(writeCreateMemory("raw", "متن")).toBe(false);
  });
  it("never restores an old pending request as still running", () => {
    const old = [{ text: "در حال ساخت", status: "running" }, { text: "خروجی", status: "succeeded" }];
    const recovered = recoverMessages(old);
    expect(recovered[0].status).toBe("interrupted");
    expect(recovered[1]).toEqual(old[1]);
    expect(old[0].status).toBe("running");
  });
  it("keeps Create mounted and binds cancellation to the submitted direct job ID", () => {
    const app = readFileSync(new URL("../apps/desktop/src/App.tsx", import.meta.url), "utf8");
    const create = readFileSync(new URL("../apps/desktop/src/pages/CreateImage.tsx", import.meta.url), "utf8");
    expect(app).toContain('<div hidden={route !== "create"}><CreatePage /></div>');
    expect(create).toContain("api.jobCancel(activeJob.current)");
    expect(create).toContain("job_id: jobId");
    expect(create).toContain('useHotkeys(route === "create" ?');
    expect(create).toContain('outcome.status === "cancelled"');
  });
});
