import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Card, CodeBlock, Icon, Modal, Spinner, Textarea } from "@aria/ui";
import { api, errorText, formatDate } from "@aria/core";
import { useApp } from "../store";
import { useAction } from "../lib/hooks";
import { PageHeader } from "../components/shell";

const TEMPLATE = `# ARIA Image Studio — per-profile Codex configuration
# This file belongs to the ARIA profile, not to your personal ~/.codex.
# Keep it minimal: ARIA passes model, sandbox and effort per call.

# model = "gpt-5-codex"
# approval_policy = "on-request"
# sandbox_mode = "workspace-write"
`;

export function CodexSettingsPage() {
  const boot = useApp((state) => state.boot);
  const toast = useApp((state) => state.toast);
  const refresh = useApp((state) => state.refresh);
  const config = useQuery({ queryKey: ["codex-config"], queryFn: api.codexConfigRead });
  const [content, setContent] = useState("");
  const [loadedPath, setLoadedPath] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (config.data) {
      setContent(config.data.content);
      setLoadedPath(config.data.path);
    }
  }, [config.data]);

  const installSkill = useAction(() => api.codexInstallSkill(), {
    success: "مهارت تصویرسازی نصب شد",
    onDone: () => void refresh(),
  });

  const save = async () => {
    try {
      const result = await api.codexConfigWrite(content);
      toast(`تنظیمات ذخیره شد (${result.path})`, "ok");
      setConfirmOpen(false);
      config.refetch();
    } catch (error) {
      toast(errorText(error), "err");
    }
  };

  const dirty = config.data ? content !== config.data.content : content.trim().length > 0;

  return (
    <div className="page fade-in">
      <PageHeader
        title="تنظیمات Codex"
        description="هر حساب فایل تنظیمات جدا دارد. قبل از ذخیره، پشتیبان گرفته می‌شود و تنظیمات شخصی Codex شما تغییر نمی‌کند."
        actions={
          <>
            <Button icon="refresh" onClick={() => config.refetch()}>خواندن دوباره</Button>
            <Button icon="file" onClick={() => setContent((current) => (current.trim() ? current : TEMPLATE))}>درج نمونه تنظیمات</Button>
            <Button variant="primary" icon="save" disabled={!dirty} onClick={() => setConfirmOpen(true)}>ذخیره فایل config.toml</Button>
          </>
        }
      />

      <div className="grid split">
        <Card>
          <div className="section-title">
            <h2>config.toml</h2>
            <Badge tone={config.data?.exists ? "ok" : "warn"}>{config.data?.exists ? "موجود است" : "هنوز ساخته نشده"}</Badge>
          </div>
          {config.isLoading ? <Spinner label="در حال خواندن تنظیمات…" /> : null}
          {config.isError ? <div className="banner err"><Icon name="alert" size={14} /><span>{errorText(config.error)}</span></div> : null}
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            spellCheck={false}
            placeholder={TEMPLATE}
            style={{ minHeight: 360, fontFamily: "var(--mono)", fontSize: 12 }}
          />
          <div className="row wrap" style={{ marginTop: 10 }}>
            <span className="mono-path">{loadedPath || boot?.paths.codex_home}</span>
            <span className="spacer" />
            {dirty ? <Badge tone="warn">تغییرات ذخیره‌نشده</Badge> : <Badge tone="ok">ذخیره‌شده</Badge>}
          </div>
        </Card>

        <div className="stack">
          <Card>
            <div className="section-title"><h2>ایمنی</h2></div>
            <ul className="small muted" style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.8 }}>
              <li>پیش از هر ذخیره، نسخه قبلی در <span className="mono">Backups/</span> کپی می‌شود.</li>
              <li>فایل ابتدا موقت نوشته و سپس جایگزین می‌شود.</li>
              <li>توضیحات و کلیدهای ناشناخته همان‌طور که نوشته‌اید حفظ می‌شوند.</li>
              <li>اگر ساختار TOML اشتباه باشد، Codex در اجرای بعد خطا می‌دهد.</li>
            </ul>
          </Card>

          <Card>
            <div className="section-title"><h2>مهارت‌ها</h2><Badge tone={boot?.codex.skill_present ? "ok" : "warn"}>{boot?.codex.skill_present ? "نصب‌شده" : "نصب نیست"}</Badge></div>
            <p className="muted tiny" style={{ marginTop: 0 }}>
              برنامه مهارت <span className="mono">imagegen</span> را در پوشه مهارت‌های حساب نصب می‌کند تا عامل از موتور داخلی تصویرسازی استفاده کند، نه اسکریپت یا کلید API.
            </p>
            <Button size="sm" icon="download" loading={installSkill.isPending} onClick={() => installSkill.mutate([])}>نصب یا ترمیم مهارت</Button>
            <div className="mono-path" style={{ marginTop: 8 }}>{boot?.paths.codex_home}\skills</div>
          </Card>

          <Card>
            <div className="section-title"><h2>پوشه حساب</h2></div>
            <div className="row wrap">
              <Button size="sm" icon="folder" onClick={() => { if (boot?.paths.codex_home) void api.openPath(boot.paths.codex_home).catch(() => undefined); }}>بازکردن پوشه</Button>
              <Button size="sm" variant="ghost" icon="terminal" onClick={() => useApp.getState().setRoute("engine")}>موتور هوش مصنوعی</Button>
            </div>
            <div className="divider" style={{ margin: "10px 0" }} />
            <div className="tiny muted">ساختار</div>
            <CodeBlock text={`${boot?.paths.codex_home ?? "<CODEX_HOME>"}
  auth.json          session tokens (user-only ACL)
  auth.vault         DPAPI backup
  config.toml        this file
  skills/            imagegen + ARIA skills
  generated_images/  built-in tool output
  sessions/          run transcripts`} maxHeight={150} />
          </Card>
        </div>
      </div>

      <Modal open={confirmOpen} title="ذخیره فایل config.toml" subtitle="ابتدا نسخه پشتیبان ساخته می‌شود" onClose={() => setConfirmOpen(false)}
        footer={<>
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>لغو</Button>
          <Button variant="primary" icon="save" onClick={() => void save()}>ذخیره فایل</Button>
        </>}
      >
        <div className="stack">
          <div className="mono-path">{loadedPath}</div>
          <div className="log-view" style={{ maxHeight: 220 }}>{content.slice(0, 2000)}{content.length > 2000 ? "\n…" : ""}</div>
          <div className="tiny dim">این تغییر فقط برای حساب فعال است و نشست‌های قبلی را تغییر نمی‌دهد.</div>
          {config.data?.exists ? <div className="tiny muted">آخرین خواندن {formatDate(new Date().toISOString())}</div> : null}
        </div>
      </Modal>
    </div>
  );
}
