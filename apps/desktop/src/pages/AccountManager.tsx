import { faLabel } from "@aria/core";
import { useState } from "react";
import { Badge, Button, Card, EmptyState, Icon, Modal, Spinner, ToggleRow } from "@aria/ui";
import { api, errorText, formatDate, type Profile } from "@aria/core";
import { useApp } from "../store";
import { useProfiles, useAction } from "../lib/hooks";
import { PageHeader } from "../components/shell";

export function AccountsPage() {
  const boot = useApp((state) => state.boot);
  const refresh = useApp((state) => state.refresh);
  const saveSettings = useApp((state) => state.saveSettings);
  const toast = useApp((state) => state.toast);
  const profiles = useProfiles();
  const [confirm, setConfirm] = useState<Profile | null>(null);

  const setActive = useAction((id: string) => api.authSetActive(id), { success: "حساب فعال تغییر کرد", onDone: () => { void refresh(); profiles.refetch(); } });
  const check = useAction((id: string) => api.authStatus(id), {
    success: (result) => result.authenticated ? "نشست حساب معتبر است" : `وارد حساب نشده‌اید — ${result.detail}`,
    onDone: () => profiles.refetch(),
  });
  const logout = useAction((id: string) => api.authLogout(id), { success: "از حساب خارج شدید؛ اطلاعات ورود محلی پاک شد", onDone: () => { void refresh(); profiles.refetch(); } });

  const activeId = boot?.settings.active_profile_id ?? "";

  return (
    <div className="page fade-in">
      <PageHeader
        title="حساب‌ها"
        description="هر حساب Codex پوشه اختصاصی و جداگانه دارد. هنگام تغییر حساب، اطلاعات ورود بین حساب‌ها کپی نمی‌شود."
        actions={
          <>
            <Button icon="refresh" onClick={() => { profiles.refetch(); void refresh(); }}>بررسی مجدد</Button>
            <Button variant="primary" icon="plus" onClick={() => useApp.getState().setRoute("auth")}>افزودن حساب</Button>
          </>
        }
      />

      {profiles.isLoading ? <Spinner label="در حال بارگذاری حساب‌ها…" /> : null}
      {profiles.data && profiles.data.length === 0 ? (
        <EmptyState icon="user" title="هنوز حسابی متصل نیست" description="برای افزودن اولین حساب، فایل auth.json را وارد کنید یا با ChatGPT وارد شوید."
          action={<Button variant="primary" icon="key" onClick={() => useApp.getState().setRoute("auth")}>اتصال حساب</Button>} />
      ) : null}

      <div className="grid cols-2">
        {profiles.data?.map((profile) => (
          <Card key={profile.id} highlight={profile.id === activeId}>
            <div className="row between" style={{ marginBottom: 10 }}>
              <div className="row" style={{ gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                  <Icon name="user" size={15} />
                </div>
                <div>
                  <div className="strong small">{profile.name}</div>
                  <div className="tiny muted">ساخته‌شده در {formatDate(profile.created_at)}</div>
                </div>
              </div>
              {profile.id === activeId ? <Badge tone="accent">فعال</Badge> : <Button size="sm" loading={setActive.isPending} onClick={() => setActive.mutate([profile.id])}>استفاده</Button>}
            </div>
            <div className="row wrap" style={{ gap: 6 }}>
              <Badge tone={profile.status === "authenticated" ? "ok" : profile.status === "credentials_present" ? "warn" : "err"}>{faLabel(profile.status)}</Badge>
              <Badge>{faLabel(profile.auth_mode || "روش نامشخص")}</Badge>
              <Badge>پوشه اختصاصی</Badge>
            </div>
            <div className="mono-path" style={{ marginTop: 8 }}>{boot?.paths.profiles ?? ""}\{profile.id}\codex</div>
            <div className="tiny muted" style={{ marginTop: 6 }}>آخرین بررسی {formatDate(profile.last_checked)}</div>
            {profile.last_error ? <div className="tiny" style={{ color: "var(--err)", marginTop: 4 }}>{profile.last_error}</div> : null}
            <div className="row wrap" style={{ marginTop: 10, gap: 6 }}>
              <Button size="sm" icon="activity" loading={check.isPending} onClick={() => check.mutate([profile.id])}>بررسی اعتبار</Button>
              <Button size="sm" variant="ghost" icon="key" onClick={async () => {
                try { await api.authRestoreVault(profile.id); toast("اطلاعات ورود از نسخه پشتیبان رمزگذاری‌شده ویندوز بازیابی شد", "ok"); }
                catch (error) { toast(errorText(error), "err"); }
              }}>بازیابی</Button>
              <Button size="sm" variant="ghost" icon="trash" onClick={() => setConfirm(profile)}>حذف</Button>
            </div>
            {profile.id === activeId ? (
              <div className="row" style={{ marginTop: 8 }}>
                <Button size="sm" variant="danger" icon="close" loading={logout.isPending} onClick={() => logout.mutate([profile.id])}>خروج از این حساب</Button>
              </div>
            ) : null}
          </Card>
        ))}
      </div>

      <div className="grid split" style={{ marginTop: 18 }}>
        <Card>
          <div className="section-title"><h2>نگهداری اطلاعات ورود</h2></div>
          <ToggleRow
            label="نگهداری نسخه پشتیبان رمزگذاری‌شده با حفاظت ویندوز (DPAPI)"
            description="در صورت فعال‌بودن، نسخه رمزگذاری‌شده auth.json ذخیره می‌شود تا در صورت خرابی قابل بازیابی باشد. توکن‌ها وارد پایگاه داده نمی‌شوند."
            checked={boot?.settings.store_credentials_in_keyring ?? false}
            onChange={async (value) => {
              try { await saveSettings({ store_credentials_in_keyring: value }); toast(value ? "پشتیبان رمزگذاری‌شده فعال شد" : "پشتیبان رمزگذاری‌شده غیرفعال شد", "ok"); }
              catch (error) { toast(errorText(error), "err"); }
            }}
          />
          <div className="divider" style={{ margin: "10px 0" }} />
          <ul className="small muted" style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.8 }}>
            <li>برای هر حساب یک پوشه جدا در <span className="mono">profiles/</span>.</li>
            <li>حذف حساب، خروج از حساب و پاک‌کردن فایل‌ها و پوشه آن را انجام می‌دهد.</li>
            <li>اطلاعات محرمانه ورود هرگز نمایش داده نمی‌شود و در گزارش‌ها یا خروجی‌ها قرار نمی‌گیرد.</li>
          </ul>
        </Card>
        <Card>
          <div className="section-title"><h2>حریم خصوصی</h2></div>
          <p className="muted small" style={{ marginTop: 0 }}>
            برنامه اطلاعات آماری شما را به سروری ارسال نمی‌کند. گزارش‌های بررسی روی همین دستگاه می‌مانند مگر خودتان خروجی بگیرید. درخواست‌های Codex با نشست حساب شما مستقیم به OpenAI می‌روند.
          </p>
          <div className="row wrap">
            <Button size="sm" icon="activity" onClick={() => useApp.getState().setRoute("diagnostics")}>عیب‌یابی</Button>
            <Button size="sm" variant="ghost" icon="lock" onClick={() => useApp.getState().setRoute("auth")}>مدل امنیتی</Button>
          </div>
        </Card>
      </div>

      <Modal open={Boolean(confirm)} title="حذف حساب" subtitle="اطلاعات ورود پاک می‌شود" onClose={() => setConfirm(null)}
        footer={<>
          <Button variant="ghost" onClick={() => setConfirm(null)}>لغو</Button>
          <Button variant="danger" icon="trash" onClick={async () => {
            if (!confirm) return;
            try {
              await api.authDelete(confirm.id, true);
              toast("حساب حذف شد", "ok");
              setConfirm(null);
              profiles.refetch();
              void refresh();
            } catch (error) { toast(errorText(error), "err"); }
          }}>حذف دائمی</Button>
        </>}
      >
        <p className="small muted">
          برنامه دستور <span className="mono">codex logout</span>را اجرا می‌کند، اطلاعات ورود و نسخه پشتیبان را پاک و پوشه حساب را حذف می‌کند. تصاویر پروژه‌ها باقی می‌مانند.
        </p>
      </Modal>
    </div>
  );
}
