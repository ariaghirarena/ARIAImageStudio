import { faLabel } from "@aria/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, CodeBlock, EmptyState, Icon, Input, Modal, Spinner } from "@aria/ui";
import { api, errorText, formatDate, isDesktopRuntime, onEvent, type Profile } from "@aria/core";
import { useApp } from "../store";
import { useAction, useProfiles } from "../lib/hooks";
import { PageHeader, PickerField } from "../components/shell";

export function AuthPage() {
  const boot = useApp((state) => state.boot);
  const refresh = useApp((state) => state.refresh);
  const toast = useApp((state) => state.toast);
  const profiles = useProfiles();

  const [sourcePath, setSourcePath] = useState("");
  const [profileName, setProfileName] = useState("");
  const [loginLog, setLoginLog] = useState<string[]>([]);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginDevice, setLoginDevice] = useState(false);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null);
  const [replaceFor, setReplaceFor] = useState<Profile | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const logRef = useRef<HTMLDivElement | null>(null);

  const activeProfileId = boot?.settings.active_profile_id ?? "";

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [loginLog]);

  useEffect(() => {
    let unlistenLine: (() => void) | undefined;
    let unlistenDone: (() => void) | undefined;
    void (async () => {
      unlistenLine = await onEvent<{ text: string }>("aria://login-line", (payload) => {
        setLoginLog((lines) => [...lines, payload.text].slice(-300));
      });
      unlistenDone = await onEvent<{ exit_code: number | null; status: { authenticated?: boolean; detail?: string } }>(
        "aria://login-finished",
        (payload) => {
          setLoginBusy(false);
          const ok = Boolean(payload.status?.authenticated);
          toast(ok ? "حساب Codex متصل شد" : `ورود بدون اتصال حساب پایان یافت — ${payload.status?.detail ?? "گزارش را بررسی کنید"}`, ok ? "ok" : "err");
          void refresh();
          profiles.refetch();
        },
      );
    })();
    return () => {
      unlistenLine?.();
      unlistenDone?.();
    };
  }, [profiles, refresh, toast]);

  const importAction = useAction(
    (path: string, name: string) => api.authImport(path, name),
    {
      success: "فایل auth.json در حساب جداگانه ARIA وارد شد",
      onDone: () => { setSourcePath(""); setProfileName(""); void refresh(); profiles.refetch(); },
    },
  );

  const replaceAction = useAction(
    (profileId: string, path: string) => api.authReplace(profileId, path),
    { success: "اطلاعات ورود جایگزین و نسخه پشتیبان رمزگذاری‌شده تازه شد", onDone: () => { setReplaceFor(null); setSourcePath(""); profiles.refetch(); } },
  );

  useEffect(() => {
    if (!isDesktopRuntime()) return;
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/webview").then(async ({ getCurrentWebview }) => {
      unlisten = await getCurrentWebview().onDragDropEvent((event) => {
        if (event.payload.type !== "drop") return;
        const candidate = event.payload.paths.find((path) => path.toLowerCase().endsWith(".json"));
        if (candidate) {
          setSourcePath(candidate);
          toast(`فایل ورود پیدا شد: ${candidate}`, "info");
        }
      });
    }).catch(() => undefined);
    return () => unlisten?.();
  }, [toast]);

  const checkStatus = async (profile: Profile) => {
    try {
      const result = await api.authStatus(profile.id);
      setStatusMap((map) => ({ ...map, [profile.id]: `${result.authenticated ? "وارد شده‌اید" : "وارد نشده‌اید"} · ${result.detail || "جزئیاتی ثبت نشده"}` }));
      profiles.refetch();
      void refresh();
    } catch (error) {
      setStatusMap((map) => ({ ...map, [profile.id]: errorText(error) }));
    }
  };

  const startLogin = async () => {
    setLoginBusy(true);
    setLoginLog([]);
    try {
      await api.authLoginStart(activeProfileId, loginDevice);
    } catch (error) {
      setLoginBusy(false);
      toast(errorText(error), "err");
    }
  };

  const activeProfile = useMemo(
    () => profiles.data?.find((profile) => profile.id === activeProfileId),
    [profiles.data, activeProfileId],
  );

  return (
    <div className="page fade-in">
      <PageHeader
        title="ورود به حساب"
        description="برنامه از پوشه اختصاصی هر حساب با Codex ارتباط می‌گیرد. فایل auth.json موجود را وارد کنید یا از ورود رسمی ChatGPT استفاده کنید؛ توکن‌ها نمایش داده نمی‌شوند و در گزارش یا پایگاه داده ذخیره نمی‌شوند."
        actions={
          <>
            <Button icon="refresh" onClick={() => { profiles.refetch(); void refresh(); }}>بررسی مجدد</Button>
            <Button variant="ghost" icon="activity" onClick={() => setAdvancedOpen(true)}>روش کار</Button>
          </>
        }
      />

      <div className="grid split">
        <div className="stack">
          <Card highlight>
            <div className="section-title">
              <h2>اتصال حساب Codex</h2>
              {activeProfile ? <Badge tone="ok">فعال · {activeProfile.name}</Badge> : <Badge tone="warn">حساب فعالی نیست</Badge>}
            </div>

            <div className="grid cols-2">
              <div className="stack">
                <PickerField
                  label="فایل اطلاعات ورود (auth.json)"
                  mode="file"
                  value={sourcePath}
                  onChange={setSourcePath}
                  placeholder="C:\\Users\\you\\Downloads\\auth.json"
                  filter={(entry) => !entry.is_dir && entry.name.toLowerCase().endsWith(".json")}
                />
                <div className="field">
                  <span className="field-label">نام حساب (اختیاری)</span>
                  <Input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="حساب شخصی ChatGPT" />
                </div>
                <Button
                  variant="primary"
                  icon="key"
                  loading={importAction.isPending}
                  disabled={!sourcePath.trim()}
                  onClick={() => importAction.mutate([sourcePath, profileName])}
                >
                  واردکردن فایل ورود
                </Button>
                <div className="field-hint">
                  ساختار فایل بررسی می‌شود، سپس در پوشه اختصاصی حساب کپی و با دسترسی محدود و رمزگذاری ویندوز محافظت می‌شود. می‌توانید فایل JSON را روی این صفحه بکشید و رها کنید.
                </div>
              </div>

              <div className="stack">
                <div className="card tight" style={{ background: "rgba(125,211,252,.04)" }}>
                  <div className="strong small" style={{ marginBottom: 4 }}>ورود با ChatGPT</div>
                  <p className="muted tiny" style={{ marginTop: 0 }}>
                    دستور <span className="mono">codex login</span> با پوشه اختصاصی ARIA اجرا می‌شود؛ تنظیمات شخصی Codex شما تغییر نمی‌کند.
                  </p>
                  <div className="row wrap">
                    <Button variant="primary" icon="external" loading={loginBusy && !loginDevice} disabled={loginBusy} onClick={() => { setLoginDevice(false); void startLogin(); }}>
                      ورود با ChatGPT
                    </Button>
                    <Button icon="key" loading={loginBusy && loginDevice} disabled={loginBusy} onClick={() => { setLoginDevice(true); void startLogin(); }}>
                      ورود با کد دستگاه
                    </Button>
                  </div>
                </div>
                <div className="log-view" ref={logRef} style={{ minHeight: 120 }}>
                  {loginLog.length === 0 ? "گزارش ورود بدون اطلاعات حساس اینجا نمایش داده می‌شود." : loginLog.join("\n")}
                </div>
                {loginBusy ? <Spinner label="در انتظار پایان ورود به Codex…" /> : null}
              </div>
            </div>
          </Card>

          <Card>
            <div className="section-title">
              <h2>حساب‌های Codex</h2>
              <span>{profiles.data?.length ?? 0} حساب؛ هرکدام با پوشه اختصاصی</span>
            </div>
            {profiles.isLoading ? <Spinner label="در حال بارگذاری حساب‌ها…" /> : null}
            {profiles.data && profiles.data.length === 0 ? (
              <EmptyState
                icon="key"
                title="هنوز حساب Codex ندارید"
                description="فایل auth.json را وارد کنید یا با ChatGPT وارد شوید. برنامه مقدار توکن‌ها را در پایگاه داده ذخیره نمی‌کند."
              />
            ) : null}
            <div className="list">
              {profiles.data?.map((profile) => (
                <div className="list-row" key={profile.id} style={{ alignItems: "flex-start", paddingBlock: 12 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                    <Icon name="user" size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row wrap" style={{ gap: 8 }}>
                      <span className="strong small">{profile.name}</span>
                      {profile.id === activeProfileId ? <Badge tone="accent">فعال</Badge> : null}
                      <Badge tone={profile.status === "authenticated" ? "ok" : profile.status === "credentials_present" ? "warn" : "default"}>
                        {faLabel(profile.status)}
                      </Badge>
                      <Badge>{faLabel(profile.auth_mode || "unknown")}</Badge>
                    </div>
                    <div className="muted tiny" style={{ marginTop: 4 }}>
                      آخرین بررسی: {formatDate(profile.last_checked)} · ساخته‌شده در {formatDate(profile.created_at)}
                    </div>
                    {statusMap[profile.id] ? <div className="tiny" style={{ marginTop: 4, color: "var(--text-soft)" }}>{statusMap[profile.id]}</div> : null}
                    {profile.last_error ? <div className="tiny" style={{ marginTop: 4, color: "var(--err)" }}>{profile.last_error}</div> : null}
                  </div>
                  <div className="row wrap" style={{ justifyContent: "flex-end", gap: 6 }}>
                    <Button size="sm" icon="activity" onClick={() => void checkStatus(profile)}>بررسی</Button>
                    {profile.id !== activeProfileId ? (
                      <Button size="sm" icon="check" onClick={async () => { await api.authSetActive(profile.id); await refresh(); profiles.refetch(); }}>استفاده</Button>
                    ) : null}
                    <Button size="sm" icon="refresh" onClick={() => { setReplaceFor(profile); setSourcePath(""); }}>جایگزینی</Button>
                    <Button size="sm" icon="key" onClick={async () => {
                      try {
                        await api.authRestoreVault(profile.id);
                        toast("اطلاعات ورود از پشتیبان رمزگذاری‌شده ویندوز بازیابی شد", "ok");
                        profiles.refetch();
                      } catch (error) { toast(errorText(error), "err"); }
                    }}>بازیابی</Button>
                    <Button size="sm" icon="trash" variant="danger" onClick={() => setConfirmDelete(profile)}>حذف</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="section-title"><h2>نشست فعال</h2></div>
            <div className="grid cols-3">
              <div>
                <div className="tiny muted">وضعیت ورود</div>
                <div className="small strong">{faLabel(activeProfile?.status ?? "بدون حساب")}</div>
              </div>
              <div>
                <div className="tiny muted">روش ورود</div>
                <div className="small strong">{activeProfile?.auth_mode ?? "—"}</div>
              </div>
              <div>
                <div className="tiny muted">آخرین تأیید</div>
                <div className="small strong">{formatDate(activeProfile?.last_checked)}</div>
              </div>
            </div>
            <div className="row wrap" style={{ marginTop: 14 }}>
              <Button
                size="sm"
                variant="danger"
                icon="trash"
                disabled={!activeProfile}
                onClick={async () => {
                  if (!activeProfile) return;
                  try {
                    await api.authLogout(activeProfile.id);
                    toast("خروج انجام شد و اطلاعات ورود محلی پاک شد", "ok");
                    profiles.refetch();
                    void refresh();
                  } catch (error) { toast(errorText(error), "err"); }
                }}
              >
                خروج از حساب
              </Button>
              <Button size="sm" variant="ghost" icon="terminal" onClick={() => setAdvancedOpen(true)}>نمایش ساختار پوشه Codex</Button>
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <div className="section-title"><h2>پیش‌نیازهای موتور</h2></div>
            <div className="list">
              {[
                { label: "نصب ابزار Codex", ok: Boolean(boot?.codex.found), detail: boot?.codex.version || "شناسایی نشد" },
                { label: "وجود اطلاعات ورود", ok: Boolean(boot?.codex.auth_present), detail: boot?.paths.codex_home ?? "" },
                { label: "مهارت تصویرسازی در پوشه Codex", ok: Boolean(boot?.codex.skill_present), detail: boot?.codex.skill_present ? "installed" : "از بخش موتور هوش مصنوعی نصب کنید" },
              ].map((check) => (
                <div className="list-row" key={check.label}>
                  <span style={{ color: check.ok ? "var(--ok)" : "var(--warn)" }}><Icon name={check.ok ? "check" : "alert"} size={13} /></span>
                  <div style={{ flex: 1 }}>
                    <div className="small">{check.label}</div>
                    <div className="mono-path dim">{check.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="section-title"><h2>مدل امنیتی</h2></div>
            <ul className="small muted" style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.8 }}>
              <li>توکن‌ها برای نمایش خوانده نمی‌شوند و وارد پایگاه داده نمی‌شوند.</li>
              <li>فایل auth.json در پوشه اختصاصی ARIA با دسترسی محدود به کاربر ذخیره می‌شود.</li>
              <li>نسخه پشتیبان رمزگذاری‌شده ویندوز امکان بازیابی پس از خرابی را می‌دهد.</li>
              <li>خروج از حساب نسخه محلی اطلاعات ورود را با بازنویسی فایل پاک می‌کند.</li>
              <li>سطح دسترسی اجرای موتور را در تنظیمات بررسی کنید؛ حالت پیشنهادی فقط نوشتن در پوشه پروژه است.</li>
            </ul>
          </Card>

          <Card tight>
            <div className="strong small" style={{ marginBottom: 6 }}>مستندات رسمی</div>
            <div className="row wrap">
              <Button size="sm" icon="external" onClick={() => void api.openUrl("https://developers.openai.com/codex/auth").catch(() => undefined)}>راهنمای ورود Codex</Button>
              <Button size="sm" icon="external" onClick={() => void api.openUrl("https://github.com/openai/codex").catch(() => undefined)}>مخزن Codex</Button>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={advancedOpen}
        title="برنامه چگونه از اطلاعات ورود استفاده می‌کند؟"
        subtitle="بدون کلید API و بدون سرویس غیررسمی"
        onClose={() => setAdvancedOpen(false)}
      >
        <div className="stack">
          <p className="muted small" style={{ margin: 0 }}>
            ابزار رسمی با پوشه اختصاصی اجرا می‌شود. این پوشه شامل اطلاعات ورود، تنظیمات، نشست‌ها و پوشه
            <span className="mono"> generated_images</span> برای دریافت تصاویر ساخته‌شده است.
          </p>
          <CodeBlock text={`%LOCALAPPDATA%\\ARIA\\ImageStudio\\
  profiles\\<profile-id>\\
    codex\\
      auth.json          (user-only ACL, never logged)
      auth.vault         (DPAPI-encrypted backup)
      config.toml        (per-profile Codex configuration)
      skills\\            (ARIA + imagegen skills)
      generated_images\\  (built-in tool output, imported by ARIA)
      sessions\\          (audit trail of runs)`} />
          <p className="muted small" style={{ margin: 0 }}>
            وضعیت ورود با دستور <span className="mono">codex login status</span>بررسی می‌شود؛ اطلاعات حساس گزارش حذف می‌شود و فقط وضعیت نشست ثبت می‌شود.
          </p>
        </div>
      </Modal>

      <Modal
        open={Boolean(replaceFor)}
        title="جایگزینی اطلاعات ورود"
        subtitle={replaceFor?.name}
        onClose={() => setReplaceFor(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReplaceFor(null)}>لغو</Button>
            <Button
              variant="primary"
              loading={replaceAction.isPending}
              disabled={!sourcePath.trim()}
              onClick={() => { if (replaceFor) replaceAction.mutate([replaceFor.id, sourcePath]); }}
            >
              جایگزینی فایل auth.json
            </Button>
          </>
        }
      >
        <PickerField
          label="فایل auth.json جدید"
          mode="file"
          value={sourcePath}
          onChange={setSourcePath}
          filter={(entry) => !entry.is_dir && entry.name.toLowerCase().endsWith(".json")}
        />
        <p className="muted tiny" style={{ marginTop: 10 }}>
          قبل از جایگزینی، اطلاعات ورود قبلی با حفاظت ویندوز پشتیبان‌گیری می‌شود؛ سپس فایل جدید بررسی و دسترسی آن محدود می‌شود.
        </p>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        title="حذف حساب Codex"
        subtitle="این کار قابل بازگشت نیست"
        onClose={() => setConfirmDelete(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>لغو</Button>
            <Button
              variant="danger"
              icon="trash"
              onClick={async () => {
                if (!confirmDelete) return;
                try {
                  await api.authDelete(confirmDelete.id, true);
                  toast("حساب و اطلاعات ورود آن پاک شد", "ok");
                  setConfirmDelete(null);
                  profiles.refetch();
                  void refresh();
                } catch (error) { toast(errorText(error), "err"); }
              }}
            >
              حذف دائمی
            </Button>
          </>
        }
      >
        <p className="small muted">
          این کار دستور <span className="mono">codex logout</span>را اجرا و اطلاعات ورود، نسخه پشتیبان رمزگذاری‌شده و پوشه حساب را پاک می‌کند. تصاویر و پرامپت‌ها حذف نمی‌شوند.
        </p>
      </Modal>
    </div>
  );
}
