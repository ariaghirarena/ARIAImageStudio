import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Card, CodeBlock, Icon, Input, Spinner, Textarea } from "@aria/ui";
import { api, errorText, formatDate } from "@aria/core";
import { useApp } from "../store";
import { useAction } from "../lib/hooks";
import { PageHeader } from "../components/shell";

export function EnginePage() {
  const boot = useApp((state) => state.boot);
  const refresh = useApp((state) => state.refresh);
  const toast = useApp((state) => state.toast);
  const [testPrompt, setTestPrompt] = useState("فقط بنویس: موتور آریا آماده است");
  const [testOutput, setTestOutput] = useState("");
  const [testing, setTesting] = useState(false);
  const health = useQuery({ queryKey: ["health"], queryFn: api.codexHealth, refetchInterval: 20000 });

  const installSkill = useAction(() => api.codexInstallSkill(), {
    success: "مهارت تصویرسازی در پوشه اختصاصی ARIA نصب شد",
    onDone: () => { void refresh(); health.refetch(); },
  });

  const models = useQuery({ queryKey: ["models"], queryFn: api.codexModels });

  const runTest = async () => {
    setTesting(true);
    setTestOutput("");
    try {
      const result = await api.codexComplete(testPrompt);
      setTestOutput(result.text.trim() || "(پاسخ خالی)");
      toast("Codex پاسخ داد؛ ارتباط با موتور برقرار است", "ok");
    } catch (error) {
      setTestOutput(errorText(error));
      toast("آزمایش موتور ناموفق بود", "err");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="page fade-in">
      <PageHeader
        title="موتور هوش مصنوعی"
        description="برنامه مدل جداگانه‌ای ندارد؛ ابزار رسمی Codex و موتور داخلی تصویرسازی آن را اجرا می‌کند. نیازی به کلید API یا سرویس دیگری نیست."
        actions={
          <>
            <Button icon="refresh" onClick={() => { health.refetch(); void refresh(); }}>بررسی دوباره</Button>
            <Button variant="primary" icon="download" loading={installSkill.isPending} onClick={() => installSkill.mutate([])}>نصب مهارت تصویرسازی</Button>
          </>
        }
      />

      <div className="grid split">
        <div className="stack">
          <Card>
            <div className="section-title"><h2>نصب</h2>
              <Badge tone={health.data?.codex.found ? "ok" : "err"}>{health.data?.codex.found ? "شناسایی‌شده" : "پیدا نشد"}</Badge>
            </div>
            <div className="list">
              <div className="list-row"><Icon name="terminal" size={14} /><div style={{ flex: 1 }}><div className="small">فایل اجرایی</div><div className="mono-path">{health.data?.codex.path || "—"}</div></div></div>
              <div className="list-row"><Icon name="info" size={14} /><div style={{ flex: 1 }}><div className="small">نسخه</div><div className="mono-path">{health.data?.codex.version || "نامشخص"}</div></div></div>
              <div className="list-row"><Icon name="key" size={14} /><div style={{ flex: 1 }}><div className="small">نشست حساب</div><div className="tiny muted">{health.data?.login?.detail || "بررسی نشده"}</div></div>
                <Badge tone={health.data?.login?.authenticated ? "ok" : "warn"}>{health.data?.login?.authenticated ? "وارد شده" : "تأیید نشده"}</Badge>
              </div>
              <div className="list-row"><Icon name="sparkles" size={14} /><div style={{ flex: 1 }}><div className="small">مهارت تصویرسازی</div><div className="tiny muted">این مهارت به عامل یاد می‌دهد چگونه ابزار داخلی تصویرسازی را اجرا کند.</div></div>
                <Badge tone={health.data?.codex.skill_present ? "ok" : "warn"}>{health.data?.codex.skill_present ? "نصب‌شده" : "نصب نیست"}</Badge>
              </div>
            </div>
            {!health.data?.codex.found ? (
              <div className="banner warn" style={{ marginTop: 12 }}>
                <Icon name="alert" size={14} />
                <div>
                  <div className="strong small">ابزار Codex نصب نشده است</div>
                  <div className="tiny">آن را از مسیر رسمی نصب کنید، سپس «بررسی دوباره» را بزنید:</div>
                  <div className="mono tiny" style={{ marginTop: 4 }}>npm install -g @openai/codex</div>
                </div>
                <Button size="sm" icon="external" onClick={() => void api.openUrl("https://developers.openai.com/codex/cli").catch(() => undefined)}>راهنما</Button>
              </div>
            ) : null}
          </Card>

          <Card>
            <div className="section-title"><h2>شناسایی مدل‌ها</h2>
              <Badge tone="warn">بخشی آماده</Badge>
            </div>
            <p className="muted tiny" style={{ marginTop: 0 }}>
              Codex فهرست کامل مدل‌ها را در اختیار برنامه‌های جانبی نمی‌گذارد. ARIA فایل محلی
              <span className="mono"> models_cache.json</span> را می‌خواند؛ همچنین می‌توانید شناسه مدل را وارد کنید. انتخاب مدل تصویرسازی با خود Codex است.
            </p>
            {models.isLoading ? <Spinner label="در حال خواندن فهرست محلی…" /> : null}
            <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
              {models.data?.models.length === 0 ? <span className="dim tiny">مدلی در حافظه محلی نیست. برای استفاده از مدل پیش‌فرض Codex این قسمت را خالی بگذارید.</span> : null}
              {models.data?.models.map((model) => <Badge key={model.id} tone="info">{model.label || model.id}</Badge>)}
            </div>
            <div className="tiny dim" style={{ marginTop: 8 }}>{models.data?.detail}</div>
            <Button size="sm" variant="ghost" icon="cpu" style={{ marginTop: 10 }} onClick={() => useApp.getState().setRoute("models")}>تنظیمات مدل</Button>
          </Card>

          <Card>
            <div className="section-title"><h2>آزمایش ارتباط با موتور</h2><span>ارسال و دریافت یک پیام کوتاه از Codex</span></div>
            <Input value={testPrompt} onChange={(event) => setTestPrompt(event.target.value)} />
            <div className="row" style={{ marginTop: 8 }}>
              <Button size="sm" icon="play" loading={testing} onClick={() => void runTest()} disabled={!testPrompt.trim()}>اجرای آزمایش</Button>
              <span className="dim tiny">این آزمایش یک پیام متنی کوتاه می‌فرستد و ممکن است از سهمیه حساب استفاده کند.</span>
            </div>
            {testOutput ? <div className="log-view" style={{ marginTop: 8, maxHeight: 140 }}>{testOutput}</div> : null}
          </Card>
        </div>

        <div className="stack">
          <Card>
            <div className="section-title"><h2>ساختار پوشه‌های موتور</h2></div>
            <CodeBlock text={`CODEX_HOME=${boot?.paths.codex_home ?? ""}

برنامه تنظیمات شخصی ~/.codex شما را تغییر نمی‌دهد.
پوشه هر حساب جداست.`} maxHeight={110} />
            <div className="row wrap" style={{ marginTop: 10 }}>
              <Button size="sm" icon="folder" onClick={() => { if (boot?.paths.codex_home) void api.openPath(boot.paths.codex_home).catch(() => undefined); }}>بازکردن پوشه اختصاصی Codex</Button>
              <Button size="sm" variant="ghost" icon="settings" onClick={() => useApp.getState().setRoute("codex")}>config.toml</Button>
            </div>
          </Card>

          <Card>
            <div className="section-title"><h2>چرا کلید API نمی‌خواهیم؟</h2></div>
            <ul className="small muted" style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.8 }}>
              <li>دسترسی تصویرسازی به امکانات حساب Codex شما بستگی دارد.</li>
              <li>کلید API مربوط به سرویس و صورتحساب دیگری است.</li>
              <li>این برنامه برای استفاده از حساب شخصی ChatGPT یا Codex طراحی شده است.</li>
              <li>هیچ سرویس جایگزینی در صورت خطا استفاده نمی‌شود.</li>
            </ul>
          </Card>

          <Card>
            <div className="section-title"><h2>وضعیت قابلیت‌ها</h2></div>
            <div className="list">
              <div className="list-row"><Badge tone="ok">پشتیبانی‌شده</Badge><span className="small" style={{ flex: 1 }}>ساخت تصویر، ویرایش با توضیح متنی، ساخت نسخه و تغییرات محلی</span></div>
              <div className="list-row"><Badge tone="warn">بخشی آماده</Badge><span className="small" style={{ flex: 1 }}>فهرست مدل‌ها فقط از حافظه محلی؛ شفافیت تصویر وابسته به موتور</span></div>
              <div className="list-row"><Badge tone="err">پشتیبانی‌نشده</Badge><span className="small" style={{ flex: 1 }}>ویرایش با ماسک، تعیین بذر تصادفی و انتخاب اندازه دقیق در دسترس نیست</span></div>
            </div>
            <Button size="sm" variant="ghost" icon="list" style={{ marginTop: 10 }} onClick={() => useApp.getState().setRoute("diagnostics")}>فهرست قابلیت‌ها</Button>
          </Card>

          <Card tight>
            <div className="tiny muted">آخرین بررسی سلامت</div>
            <div className="small">{health.dataUpdatedAt ? formatDate(new Date(health.dataUpdatedAt).toISOString()) : "—"}</div>
          </Card>
        </div>
      </div>

      <Card style={{ marginTop: 16 }}>
        <div className="section-title"><h2>پیش‌نمایش دستور موتور</h2><span>متنی که به Codex فرستاده می‌شود</span></div>
        <Textarea
          readOnly
          value={`Use your built-in image generation tool (image_gen) to create the requested image.
Do not write or run scripts, do not call any API, do not ask for an API key.
Produce the image(s) and finish.

PROMPT:
<final prompt from Prompt Intelligence>`}
          style={{ minHeight: 120, fontFamily: "var(--mono)", fontSize: 11.5 }}
        />
      </Card>
    </div>
  );
}
