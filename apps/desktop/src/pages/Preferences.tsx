import { faLabel } from "@aria/core";
import { useEffect, useState } from "react";
import { Badge, Button, Card, CodeBlock, Icon, Select, Slider, Spinner, ToggleRow } from "@aria/ui";
import { api, errorText, formatDate, type Settings } from "@aria/core";
import { useApp } from "../store";
import { PickerField, PageHeader } from "../components/shell";

export function PreferencesPage() {
  const boot = useApp((state) => state.boot);
  const settings = useApp((state) => state.settings);
  const saveSettings = useApp((state) => state.saveSettings);
  const toast = useApp((state) => state.toast);
  const [draft, setDraft] = useState<Settings>(settings);
  const [update, setUpdate] = useState<{ status: string; current: string; latest?: string; detail?: string; release_url?: string; auto_install?: boolean } | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => setDraft(settings), [settings]);

  const patch = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    void saveSettings({ [key]: value } as Partial<Settings>);
  };

  const checkUpdates = async () => {
    setChecking(true);
    try {
      const result = await api.updatesCheck();
      setUpdate(result);
      toast(result.status === "available" ? `نسخه ${result.latest} منتشر شده است` : "نسخه شما به‌روز است", result.status === "available" ? "info" : "ok");
    } catch (error) {
      toast(errorText(error), "err");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="page fade-in">
      <PageHeader
        title="تنظیمات برنامه"
        description="ظاهر، محل ذخیره‌سازی و حریم خصوصی. تغییر گزینه‌ها بلافاصله ذخیره می‌شود."
        actions={<Button icon="refresh" loading={checking} onClick={() => void checkUpdates()}>بررسی به‌روزرسانی</Button>}
      />

      <div className="grid split">
        <div className="stack">
          <Card>
            <div className="section-title"><h2>ظاهر برنامه</h2></div>
            <div className="grid cols-2">
              <div className="field">
                <span className="field-label">زبان</span>
                <Select value={draft.language} onChange={(event) => patch("language", event.target.value)} options={[{ value: "fa", label: "فارسی" }]} />
              </div>
              <div className="field">
                <span className="field-label">جهت نوشتار</span>
                <Select value={draft.locale_direction} onChange={(event) => patch("locale_direction", event.target.value)} options={[{ value: "rtl", label: "راست به چپ" }]} />
              </div>
              <div className="field">
                <span className="field-label">پوسته</span>
                <Select value={draft.theme} onChange={(event) => patch("theme", event.target.value)} options={[{ value: "light", label: "روشن" }]} />
              </div>
              <div className="field">
                <span className="field-label">تنظیم آماده کیفیت پیش‌فرض</span>
                <Select value={draft.quality_preset} onChange={(event) => patch("quality_preset", event.target.value)}
                  options={[{ value: "aria-best-quality", label: "بهترین کیفیت ARIA" }, { value: "photorealistic", label: "عکس طبیعی" }, { value: "product-photography", label: "عکاسی محصول" }]} />
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <ToggleRow label="ذخیره خودکار پیش‌نویس پرامپت" description="تنظیم ذخیره پیش‌نویس ویرایشگر پرامپت." checked={draft.autosave} onChange={(value) => patch("autosave", value)} />
              <ToggleRow label="اعلان‌های دسکتاپ" description="تنظیم اعلان پایان کارهای صف." checked={draft.notifications} onChange={(value) => patch("notifications", value)} />
              <ToggleRow label="تأیید پیش از حذف" description="پیش از حذف تصویر، حساب یا پروژه تأیید بخواه؛ روشن‌ماندن این گزینه پیشنهاد می‌شود." checked={draft.confirm_destructive} onChange={(value) => patch("confirm_destructive", value)} />
              <ToggleRow label="بهبود پیش‌فرض پرامپت" description="ساختاردهی توضیح تصویر با تنظیم آماده پیش‌فرض." checked={draft.prompt_enhance_default} onChange={(value) => patch("prompt_enhance_default", value)} />
            </div>
          </Card>

          <Card>
            <div className="section-title"><h2>فضای ذخیره‌سازی</h2></div>
            <PickerField label="پوشه اصلی خروجی" mode="dir" value={draft.output_root} onChange={(value) => patch("output_root", value)} placeholder={boot?.paths.projects ?? "پیش‌فرض: پوشه پروژه‌های ARIA"} />
            <div className="grid cols-2" style={{ marginTop: 12 }}>
              <Slider label="حداکثر سوابق تاریخچه" value={draft.history_limit} min={200} max={20000} step={200} onChange={(value) => patch("history_limit", value)} />
              <Slider label="حافظه تصاویر کوچک (مگابایت)" value={draft.cache_limit_mb} min={64} max={4096} step={64} onChange={(value) => patch("cache_limit_mb", value)} />
            </div>
            <div className="row wrap" style={{ marginTop: 12 }}>
              <Button size="sm" icon="folder" onClick={() => { if (boot?.paths.root) void api.openPath(boot.paths.root).catch(() => undefined); }}>بازکردن پوشه داده‌ها</Button>
              <Button size="sm" variant="ghost" icon="folder" onClick={() => { if (boot?.paths.backups) void api.openPath(boot.paths.backups).catch(() => undefined); }}>بازکردن پشتیبان‌ها</Button>
              <Button size="sm" variant="ghost" icon="folder" onClick={() => { if (boot?.paths.logs) void api.openPath(boot.paths.logs).catch(() => undefined); }}>بازکردن گزارش‌ها</Button>
            </div>
          </Card>

          <Card>
            <div className="section-title"><h2>محل داده‌ها</h2></div>
            <CodeBlock text={`root        ${boot?.paths.root ?? ""}
codex_home  ${boot?.paths.codex_home ?? ""}
projects    ${boot?.paths.projects ?? ""}
gallery     ${boot?.paths.gallery ?? ""}
backups     ${boot?.paths.backups ?? ""}
database    ${boot?.paths.database ?? ""}`} maxHeight={170} />
          </Card>
        </div>

        <div className="stack">
          <Card>
            <div className="section-title"><h2>درباره برنامه</h2><Badge tone="accent">v{boot?.version ?? "1.1.0"}</Badge></div>
            <div className="stack" style={{ gap: 6 }}>
              <div className="row between"><span className="small">محصول</span><span className="small strong">ARIA Image Studio</span></div>
              <div className="row between"><span className="small">سیستم‌عامل</span><span className="mono tiny">{boot?.platform}</span></div>
              <div className="row between"><span className="small">موتور</span><span className="small">ابزار Codex و تصویرسازی داخلی</span></div>
              <div className="row between"><span className="small">مجوز</span><span className="small">اختصاصی؛ پوشه LICENSES را بخوانید</span></div>
            </div>
            <div className="divider" style={{ margin: "12px 0" }} />
            <div className="row wrap">
              <Button size="sm" icon="external" onClick={() => void api.openUrl("https://github.com/ariaghirarena/ARIAImageStudio").catch(() => undefined)}>مخزن کد</Button>
              <Button size="sm" variant="ghost" icon="activity" onClick={() => useApp.getState().setRoute("diagnostics")}>عیب‌یابی</Button>
            </div>
          </Card>

          <Card>
            <div className="section-title"><h2>به‌روزرسانی‌ها</h2>{update ? <Badge tone={update.status === "available" ? "info" : "ok"}>{faLabel(update.status)}</Badge> : null}</div>
            {checking ? <Spinner label="در حال بررسی انتشارهای GitHub…" /> : null}
            {update ? (
              <div className="stack" style={{ gap: 6 }}>
                <div className="row between"><span className="small">نسخه فعلی</span><span className="mono tiny">{update.current}</span></div>
                {update.latest ? <div className="row between"><span className="small">آخرین نسخه</span><span className="mono tiny">{update.latest}</span></div> : null}
                {update.detail ? <div className="tiny muted">{update.detail}</div> : null}
                <div className="tiny dim">{update.auto_install ? "نصب خودکار در دسترس است." : "به‌روزرسانی از صفحه انتشار دانلود می‌شود؛ برنامه نصب‌کننده تأییدنشده را خودکار اجرا نمی‌کند."}</div>
                {update.release_url ? <Button size="sm" icon="external" onClick={() => void api.openUrl(update.release_url!).catch(() => undefined)}>بازکردن صفحه انتشار</Button> : null}
              </div>
            ) : <div className="muted small">برای دیدن آخرین نسخه منتشرشده، بررسی به‌روزرسانی را اجرا کنید.</div>}
            <div className="tiny dim" style={{ marginTop: 8 }}>بررسی‌شده در {formatDate(new Date().toISOString())}</div>
          </Card>

          <Card>
            <div className="section-title"><h2>میانبرهای صفحه‌کلید</h2></div>
            <div className="list">
              {[
                ["Ctrl / Cmd + K", "جستجوی فرمان‌ها"],
                ["Ctrl / Cmd + Enter", "ساخت تصویر در صفحه ساخت"],
                ["Ctrl / Cmd + S", "ذخیره پرامپت"],
                ["Ctrl / Cmd + 1…5", "رفتن به فضای کار"],
                ["Shift + ?", "میانبرها و راهنما"],
                ["Esc", "بستن پنجره‌ها"],
              ].map(([keys, action]) => (
                <div className="list-row" key={keys}>
                  <span className="kbd">{keys}</span>
                  <span className="spacer" />
                  <span className="small muted">{action}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="row" style={{ gap: 8 }}>
              <Icon name="info" size={14} />
              <span className="tiny muted">
                برنامه کلید API نمی‌خواهد، به سرویس دیگری متصل نمی‌شود و گزینه ساختگی برای موتور نمایش نمی‌دهد.
              </span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
