import { useMemo } from "react";
import { Badge, Button, Card, Icon } from "@aria/ui";
import { api } from "@aria/core";
import { useApp } from "../store";
import { useProfiles } from "../lib/hooks";

export function WelcomePage() {
  const boot = useApp((state) => state.boot);
  const setRoute = useApp((state) => state.setRoute);
  const saveSettings = useApp((state) => state.saveSettings);
  const profiles = useProfiles();

  type Step = { title: string; body: string; done: boolean; action: () => void; cta: string };

  const steps: Step[] = useMemo(() => [
    {
      title: "نصب ابزار رسمی Codex",
      body: boot?.codex.found
        ? `${boot.codex.version || "Codex"} شناسایی شد`
        : "برنامه از ابزار رسمی Codex استفاده می‌کند؛ آن را نصب کنید تا موتور تصویرسازی کار کند.",
      done: Boolean(boot?.codex.found),
      action: () => setRoute("engine"),
      cta: boot?.codex.found ? "مشاهده موتور" : "راهنمای نصب",
    },
    {
      title: "وصل‌کردن حساب Codex",
      body: boot?.codex.auth_present
        ? "اطلاعات ورود شما در پوشه اختصاصی ARIA موجود است."
        : "فایل auth.json را وارد کنید یا با ChatGPT وارد شوید. هیچ‌وقت کلید API لازم نیست.",
      done: Boolean(boot?.codex.auth_present) || (profiles.data?.length ?? 0) > 0,
      action: () => setRoute("auth"),
      cta: "بازکردن ورود",
    },
    {
      title: "ساختن اولین پروژه",
      body: boot && boot.counts.projects > 0
        ? `${boot.counts.projects} پروژه آماده است.`
        : "پروژه‌ها پرامپت‌ها، عکس‌های مرجع و خروجی‌ها را برای هر موضوع جدا نگه می‌دارند.",
      done: Boolean(boot && boot.counts.projects > 0),
      action: () => setRoute("projects"),
      cta: "مدیریت پروژه‌ها",
    },
    {
      title: "ساخت و بررسی تصویر",
      body: boot && boot.counts.images > 0
        ? `${boot.counts.images} تصویر در کتابخانه شما هست.`
        : "توضیح تصویر را بنویسید، موتور پرامپت آن را مرتب می‌کند، بعد تصویر ساخته می‌شود.",
      done: Boolean(boot && boot.counts.images > 0),
      action: () => setRoute("create"),
      cta: "ساخت تصویر",
    },
  ], [boot, profiles.data, setRoute]);

  const doneCount = steps.filter((step) => step.done).length;

  return (
    <div className="page fade-in">
      <div className="hero">
        <div className="hero-grid">
          <div>
            <div className="row" style={{ gap: 8, marginBottom: 14 }}>
              <Badge tone="accent">نسخه {boot?.version ?? "1.1.0"}</Badge>
              <Badge tone="info">موتور داخلی image_gen در Codex</Badge>
              <Badge>بدون کلید API</Badge>
            </div>
            <h1>ساخت تصویر، ساده و فارسی<br />با حساب Codex شما</h1>
            <p style={{ fontSize: 15, marginTop: 12 }}>
              ARIA Image Studio یک استودیوی ویندوزی برای ساخت، ویرایش و مرتب‌کردن تصاویر است که از موتور داخلی
              تصویرسازی Codex استفاده می‌کند. هر کاری که در برنامه می‌بینید واقعاً به موتور وصل است؛ چیزی که موتور
              نمی‌تواند، شفاف نوشته شده است.
            </p>
            <div className="row wrap" style={{ marginTop: 22 }}>
              <Button variant="primary" size="lg" icon="sparkles" onClick={() => setRoute("create")}>شروع ساخت تصویر</Button>
              <Button size="lg" icon="key" onClick={() => setRoute("auth")}>وصل‌کردن حساب</Button>
              <Button size="lg" variant="ghost" icon="activity" onClick={() => setRoute("diagnostics")}>بررسی وضعیت سیستم</Button>
            </div>
          </div>
          <div className="stack">
            <Card tight>
              <div className="row between" style={{ marginBottom: 8 }}>
                <span className="tiny muted">وضعیت محیط</span>
                <span className="mono tiny dim">{boot?.platform}</span>
              </div>
              <div className="list">
                {[
                  ["ابزار Codex", boot?.codex.found ? (boot.codex.version || "نصب است") : "پیدا نشد", Boolean(boot?.codex.found)],
                  ["اطلاعات ورود", boot?.codex.auth_present ? "موجود است" : "وجود ندارد", Boolean(boot?.codex.auth_present)],
                  ["مهارت تصویرسازی", boot?.codex.skill_present ? "نصب است" : "نصب نیست", Boolean(boot?.codex.skill_present)],
                  ["کتابخانه تصاویر", `${boot?.counts.images ?? 0} تصویر`, true],
                ].map(([label, value, ok]) => (
                  <div className="list-row" key={String(label)} style={{ padding: "8px 0" }}>
                    <span style={{ color: ok ? "var(--ok)" : "var(--warn)" }}><Icon name={ok ? "check" : "alert"} size={13} /></span>
                    <span className="small">{label}</span>
                    <span className="spacer" />
                    <span className="mono tiny muted truncate" style={{ maxWidth: 150 }}>{value}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card tight>
              <div className="tiny muted" style={{ marginBottom: 8 }}>پیشرفت راه‌اندازی</div>
              <div className="row between">
                <span className="strong" style={{ fontSize: 20 }}>{doneCount}/۴</span>
                <span className="muted tiny">مرحله انجام شده</span>
              </div>
              <div className="split-progress" style={{ marginTop: 10 }}>
                <div style={{ width: `${(doneCount / 4) * 100}%` }} />
              </div>
            </Card>
          </div>
        </div>
      </div>

      <div className="grid split" style={{ marginTop: 18 }}>
        <Card>
          <div className="section-title"><h2>چک‌لیست شروع</h2><span>{doneCount} از ۴ مرحله انجام شده</span></div>
          <div className="step-list">
            {steps.map((step, index) => (
              <div className="step" key={step.title} data-done={step.done ? "true" : "false"}>
                <div className="step-index">{step.done ? <Icon name="check" size={12} /> : index + 1}</div>
                <div>
                  <div className="strong small">{step.title}</div>
                  <div className="muted tiny" style={{ marginTop: 2 }}>{step.body}</div>
                </div>
                <Button size="sm" variant={step.done ? "ghost" : "outline"} onClick={step.action}>{step.cta}</Button>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="section-title"><h2>فایل‌های برنامه کجا هستند؟</h2></div>
          <div className="stack" style={{ gap: 10 }}>
            <div>
              <div className="tiny muted">پوشه داده‌های ARIA</div>
              <div className="mono-path">{boot?.paths.root ?? "—"}</div>
            </div>
            <div>
              <div className="tiny muted">پوشه اختصاصی Codex</div>
              <div className="mono-path">{boot?.paths.codex_home ?? "—"}</div>
            </div>
            <div>
              <div className="tiny muted">پوشه پروژه‌ها</div>
              <div className="mono-path">{boot?.paths.projects ?? "—"}</div>
            </div>
            <Button size="sm" icon="folder" onClick={() => { if (boot?.paths.root) void api.openPath(boot.paths.root).catch(() => undefined); }}>
              بازکردن پوشه داده‌ها
            </Button>
          </div>
        </Card>
      </div>

      <div className="row wrap" style={{ marginTop: 18, justifyContent: "space-between" }}>
        <span className="dim tiny">
          اطلاعات ورود شما فقط روی همین کامپیوتر می‌ماند و هیچ‌وقت به سروری ارسال نمی‌شود.
        </span>
        <Button variant="primary" icon="check" onClick={async () => { await saveSettings({ onboarded: true }); setRoute("dashboard"); }}>
          تمام‌کردن راه‌اندازی
        </Button>
      </div>
    </div>
  );
}
