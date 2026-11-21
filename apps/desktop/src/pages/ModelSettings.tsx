import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Icon, Input, Select, Spinner, Slider, ToggleRow } from "@aria/ui";
import { api, errorText, type Settings } from "@aria/core";
import { QUALITY_PRESETS } from "@aria/prompt-engine";
import { useApp } from "../store";
import { PickerField, PageHeader } from "../components/shell";
import { useModels } from "../lib/hooks";

const REASONING = [
  { value: "", label: "پیش‌فرض Codex" },
  { value: "minimal", label: "حداقلی" },
  { value: "low", label: "کم" },
  { value: "medium", label: "متوسط" },
  { value: "high", label: "زیاد" },
];

const VERBOSITY = [
  { value: "", label: "پیش‌فرض Codex" },
  { value: "low", label: "کم" },
  { value: "medium", label: "متوسط" },
  { value: "high", label: "زیاد" },
];

export function ModelsPage() {
  const settings = useApp((state) => state.settings);
  const saveSettings = useApp((state) => state.saveSettings);
  const toast = useApp((state) => state.toast);
  const boot = useApp((state) => state.boot);
  const models = useModels();
  const [draft, setDraft] = useState<Settings>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(settings), [settings]);

  const dirty = useMemo(
    () => (Object.keys(draft) as (keyof Settings)[]).some((key) => draft[key] !== settings[key]),
    [draft, settings],
  );

  const patch = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings(draft);
      toast("تنظیمات موتور ذخیره شد", "ok");
    } catch (error) {
      toast(errorText(error), "err");
    } finally {
      setSaving(false);
    }
  };

  const modelOptions = [
    { value: "", label: "مدل پیش‌فرض Codex" },
    ...(models.data?.models ?? []).map((model) => ({ value: model.id, label: model.label && model.label !== model.id ? `${model.label} · ${model.id}` : model.id })),
  ];

  return (
    <div className="page fade-in">
      <PageHeader
        title="تنظیمات مدل و موتور"
        description="فقط گزینه‌های واقعی Codex نمایش داده می‌شوند؛ تنظیم ساختگی برای تغییر مدل تصویرسازی وجود ندارد."
        actions={
          <>
            <Button icon="refresh" onClick={() => { setDraft(settings); models.refetch(); }}>بازنشانی</Button>
            <Button variant="primary" icon="save" loading={saving} disabled={!dirty} onClick={() => void save()}>ذخیره تنظیمات</Button>
          </>
        }
      />

      <div className="grid split">
        <div className="stack">
          <Card>
            <div className="section-title"><h2>انتخاب مدل</h2>{dirty ? <Badge tone="warn">ذخیره‌نشده</Badge> : <Badge tone="ok">ذخیره‌شده</Badge>}</div>
            <div className="field">
              <span className="field-label">مدل متنی یا عامل</span>
              <Select value={draft.codex_model} onChange={(event) => patch("codex_model", event.target.value)} options={modelOptions} />
              <div className="field-hint">
                فهرست زیر از حافظه محلی Codex خوانده می‌شود. اگر مدل شما نیست، شناسه آن را وارد کنید. برنامه آن را با گزینه
                <span className="mono"> -m &lt;id&gt;</span> بدون تغییر به Codex می‌فرستد.
              </div>
            </div>
            <div className="field" style={{ marginTop: 8 }}>
              <span className="field-label">شناسه دلخواه مدل (اختیاری)</span>
              <Input value={draft.codex_model} onChange={(event) => patch("codex_model", event.target.value)} placeholder="برای نمونه: gpt-5-codex" />
            </div>
            <div className="banner info" style={{ marginTop: 12 }}>
              <Icon name="image" size={14} />
              <div>
                <div className="strong small">مدل تصویرسازی: انتخاب خودکار با Codex</div>
                <div className="tiny">مدل تصویرسازی را ابزار داخلی انتخاب می‌کند. انتخاب مدل تصویر، اندازه دقیق یا بذر تصادفی از این برنامه در دسترس نیست.</div>
              </div>
            </div>
            <div className="row wrap" style={{ marginTop: 10 }}>
              <Badge>{models.data?.source ?? "cache"}</Badge>
              <span className="dim tiny">{models.data?.detail}</span>
            </div>
          </Card>

          <Card>
            <div className="section-title"><h2>اجرای موتور</h2></div>
            <div className="grid cols-2">
              <div className="field">
                <span className="field-label">میزان استدلال</span>
                <Select value={draft.reasoning_effort} onChange={(event) => patch("reasoning_effort", event.target.value)} options={REASONING} />
              </div>
              <div className="field">
                <span className="field-label">میزان توضیحات پاسخ</span>
                <Select value={draft.verbosity} onChange={(event) => patch("verbosity", event.target.value)} options={VERBOSITY} />
              </div>
              <div className="field">
                <span className="field-label">سیاست تأیید دسترسی</span>
                <Select value={draft.approval_policy} onChange={(event) => patch("approval_policy", event.target.value)}
                  options={[{ value: "on-request", label: "هنگام درخواست (پیشنهادی)" }, { value: "on-failure", label: "هنگام خطا" }, { value: "untrusted", label: "برای دستورات نامطمئن" }, { value: "never", label: "هرگز" }]} />
              </div>
              <div className="field">
                <span className="field-label">محدوده دسترسی فایل‌ها</span>
                <Select value={draft.sandbox_mode} onChange={(event) => patch("sandbox_mode", event.target.value)}
                  options={[{ value: "workspace-write", label: "فقط نوشتن در پروژه (پیشنهادی)" }, { value: "read-only", label: "فقط خواندن" }, { value: "danger-full-access", label: "دسترسی کامل (پرخطر)" }]} />
              </div>
            </div>
            {draft.sandbox_mode === "danger-full-access" ? (
              <div className="banner warn" style={{ marginTop: 10 }}>
                <Icon name="alert" size={14} />
                <span className="tiny">دسترسی کامل اجازه نوشتن بیرون از پوشه پروژه را می‌دهد. فقط با آگاهی از خطر از آن استفاده کنید.</span>
              </div>
            ) : null}
            <div className="grid cols-2" style={{ marginTop: 12 }}>
              <Slider label="مهلت تولید (ثانیه)" value={draft.generation_timeout_secs} min={60} max={3600} step={30} onChange={(value) => patch("generation_timeout_secs", value)} />
              <Slider label="حداکثر کارهای هم‌زمان" value={draft.max_concurrent_jobs} min={1} max={4} onChange={(value) => patch("max_concurrent_jobs", value)} />
            </div>
            <ToggleRow label="دسترسی شبکه در محیط محدود اجرا" description="Codex برای ارتباط با مدل به اینترنت نیاز دارد؛ این گزینه برای دسترسی شبکه ابزارهاست. مگر در صورت نیاز آن را خاموش بگذارید." checked={draft.network_access} onChange={(value) => patch("network_access", value)} />
          </Card>

          <Card>
            <div className="section-title"><h2>رفتار خروجی</h2></div>
            <div className="field">
              <span className="field-label">تنظیم آماده کیفیت پیش‌فرض</span>
              <Select value={draft.quality_preset} onChange={(event) => patch("quality_preset", event.target.value)} options={QUALITY_PRESETS.map((preset) => ({ value: preset.id, label: preset.labelFa }))} />
              <div className="field-hint">این گزینه‌ها دستورهای متنی برای نور، لنز و پرداخت تصویرند، نه پارامتر پنهان مدل.</div>
            </div>
            <div className="grid cols-2" style={{ marginTop: 12 }}>
              <Slider label="کیفیت پیش‌نمایش" value={draft.preview_quality} min={40} max={100} onChange={(value) => patch("preview_quality", value)} />
              <Slider label="اندازه تصویر کوچک (پیکسل)" value={draft.thumbnail_size} min={160} max={720} step={20} onChange={(value) => patch("thumbnail_size", value)} />
            </div>
            <div style={{ marginTop: 10 }}>
              <ToggleRow label="حفظ فایل‌های اصلی" description="پردازش تصویر یک فایل جدید می‌سازد و اصل را دست‌نخورده نگه می‌دارد." checked={draft.keep_original} onChange={(value) => patch("keep_original", value)} />
              <ToggleRow label="پردازش خودکار پس از تولید" description="زنجیره تغییرات پیش‌فرض را خودکار اعمال می‌کند. برای قابل پیش‌بینی‌بودن خروجی، پیش‌فرض خاموش است." checked={draft.auto_post_process} onChange={(value) => patch("auto_post_process", value)} />
              <ToggleRow label="حفظ خروجی GIF" description="اگر موتور برای حساب و درخواست شما GIF برگرداند، فایل متحرک حفظ می‌شود و به PNG تبدیل نمی‌شود." checked={draft.enable_gif} onChange={(value) => patch("enable_gif", value)} />
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <div className="section-title"><h2>فایل اجرایی</h2></div>
            <div className="field">
              <span className="field-label">مسیر دستی ابزار Codex</span>
              <PickerField label="" mode="file" value={draft.codex_path} onChange={(value) => patch("codex_path", value)} placeholder="تشخیص خودکار" />
              <div className="field-hint">برای تشخیص خودکار مسیر نصب Codex، این قسمت را خالی بگذارید.</div>
            </div>
            <div className="grid cols-2" style={{ marginTop: 10 }}>
              <div>
                <div className="tiny muted">شناسایی‌شده</div>
                <div className="mono-path">{boot?.codex.path || "پیدا نشد"}</div>
              </div>
              <div>
                <div className="tiny muted">نسخه</div>
                <div className="small">{boot?.codex.version || "—"}</div>
              </div>
            </div>
            <Button size="sm" icon="external" style={{ marginTop: 10 }} onClick={() => void api.openUrl("https://developers.openai.com/codex/cli").catch(() => undefined)}>راهنمای نصب</Button>
          </Card>

          <Card>
            <div className="section-title"><h2>فرمان اجرایی</h2></div>
            <div className="mono-path" style={{ whiteSpace: "pre-wrap" }}>
              {`codex exec --json --skip-git-repo-check\n  -C <work dir>\n  ${draft.codex_model ? `-m ${draft.codex_model}` : "[-m default]"}\n  -s ${draft.sandbox_mode}\n  ${draft.approval_policy ? `--ask-for-approval ${draft.approval_policy}` : ""}\n  ${draft.reasoning_effort ? `-c model_reasoning_effort="${draft.reasoning_effort}"` : ""}\n  ${draft.verbosity ? `-c model_verbosity="${draft.verbosity}"` : ""}\n  -- "<engine instruction + prompt>"`}
            </div>
            <div className="tiny dim" style={{ marginTop: 8 }}>
              در هر اجرا، پوشه اختصاصی حساب ARIA به‌عنوان CODEX_HOME تعیین می‌شود.
            </div>
          </Card>

          <Card>
            <div className="section-title"><h2>محیط اجرا</h2></div>
            {models.isLoading ? <Spinner label="در حال خواندن فهرست محلی مدل‌ها…" /> : null}
            <div className="list">
              <div className="list-row"><Icon name="cpu" size={13} /><span className="small" style={{ flex: 1 }}>مدل‌های حافظه محلی</span><Badge>{models.data?.models.length ?? 0}</Badge></div>
              <div className="list-row"><Icon name="image" size={13} /><span className="small" style={{ flex: 1 }}>ابزار تصویرسازی</span><Badge tone="accent">image_gen</Badge></div>
              <div className="list-row"><Icon name="key" size={13} /><span className="small" style={{ flex: 1 }}>نیاز به کلید API</span><Badge tone="ok">خیر</Badge></div>
            </div>
          </Card>
        </div>
      </div>

      {dirty ? (
        <div className="banner" style={{ position: "sticky", bottom: 12, marginTop: 16 }}>
          <Icon name="alert" size={14} />
          <span className="small" style={{ flex: 1 }}>تغییرات تنظیمات موتور هنوز ذخیره نشده است.</span>
          <Button size="sm" variant="ghost" onClick={() => setDraft(settings)}>نادیده‌گرفتن</Button>
          <Button size="sm" variant="primary" loading={saving} onClick={() => void save()}>ذخیره</Button>
        </div>
      ) : null}
    </div>
  );
}
