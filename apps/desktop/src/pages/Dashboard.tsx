import { faLabel } from "@aria/core";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Card, Icon, Spinner, Stat } from "@aria/ui";
import { api, formatBytes, formatDate, formatDuration } from "@aria/core";
import { useApp } from "../store";
import { useAnalytics, useGallery, useProfiles, useQueueState, useRegistrySummary } from "../lib/hooks";
import { ImageThumb, PageHeader } from "../components/shell";

export function DashboardPage() {
  const boot = useApp((state) => state.boot);
  const setRoute = useApp((state) => state.setRoute);
  const analytics = useAnalytics();
  const queue = useQueueState();
  const registry = useRegistrySummary();
  const profiles = useProfiles();
  const recent = useGallery({ limit: 8, sort: "newest" });
  const health = useQuery({ queryKey: ["health"], queryFn: api.codexHealth, refetchInterval: 15000 });

  const summary = analytics.data;
  const activeProfile = profiles.data?.find((profile) => profile.id === boot?.settings.active_profile_id);
  const engineOk = Boolean(boot?.codex.found && boot.codex.auth_present);
  const shipped = registry.data?.by_status
    .filter((row) => row.status === "implemented" || row.status === "tested")
    .reduce((total, row) => total + Number(row.count), 0) ?? 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "صبح بخیر" : hour < 18 ? "ظهر بخیر" : "شب بخیر";

  return (
    <div className="page fade-in">
      <PageHeader
        title={greeting}
        description="همه اطلاعات اینجا از پایگاه داده محلی، نصب Codex و صف تولید خوانده می‌شود."
        actions={
          <>
            <Button icon="refresh" onClick={() => { void analytics.refetch(); queue.refetch(); health.refetch(); }}>تازه‌سازی</Button>
            <Button variant="primary" icon="sparkles" onClick={() => setRoute("create")}>تصویر جدید</Button>
          </>
        }
      />

      <div className="grid cols-4">
        <Stat label="تصاویر" value={summary?.images ?? boot?.counts.images ?? 0} sub={`${formatBytes(summary?.disk_bytes ?? 0)} روی دیسک`} icon="image" />
        <Stat label="تولیدها" value={summary?.generations ?? 0} sub={`${summary?.success_rate ?? 0}٪ موفق`} icon="sparkles" />
        <Stat label="میانگین زمان تولید" value={formatDuration(summary?.avg_duration_ms ?? 0)} sub="اجراهای موفق" icon="clock" />
        <Stat label="صف تولید" value={queue.data ? queue.data.queued + queue.data.running : 0} sub={queue.data?.paused ? "متوقف است" : "فعال است"} icon="workflow" />
      </div>

      <div className="grid split" style={{ marginTop: 16 }}>
        <Card>
          <div className="section-title">
            <h2>وضعیت موتور</h2>
            <Badge tone={engineOk ? "ok" : "warn"}>{engineOk ? "آماده" : "نیاز به بررسی"}</Badge>
          </div>
          {health.isLoading ? <Spinner label="در حال بررسی Codex…" /> : null}
          <div className="list">
            <div className="list-row">
              <Icon name="terminal" size={15} />
              <div style={{ flex: 1 }}>
                <div className="small strong">ابزار Codex</div>
                <div className="mono-path dim">{health.data?.codex.path || "پیدا نشد"}</div>
              </div>
              <Badge tone={health.data?.codex.found ? "ok" : "err"}>{health.data?.codex.version || "نصب نیست"}</Badge>
            </div>
            <div className="list-row">
              <Icon name="key" size={15} />
              <div style={{ flex: 1 }}>
                <div className="small strong">ورود به حساب</div>
                <div className="tiny muted truncate">{health.data?.login?.detail || (health.data?.codex.auth_present ? "اطلاعات ورود موجود است" : "اطلاعات ورود نیست")}</div>
              </div>
              <Badge tone={health.data?.login?.authenticated ? "ok" : health.data?.codex.auth_present ? "warn" : "err"}>
                {health.data?.login?.authenticated ? "وارد شده" : health.data?.codex.auth_present ? "نیاز به تأیید" : "هیچ‌کدام"}
              </Badge>
            </div>
            <div className="list-row">
              <Icon name="sparkles" size={15} />
              <div style={{ flex: 1 }}>
                <div className="small strong">مهارت تصویرسازی</div>
                <div className="tiny muted">ابزار داخلی image_gen از Codex می‌آید؛ مهارت به عامل یاد می‌دهد چطور از آن استفاده کند.</div>
              </div>
              <Badge tone={health.data?.codex.skill_present ? "ok" : "warn"}>{health.data?.codex.skill_present ? "نصب است" : "نصب نیست"}</Badge>
            </div>
            <div className="list-row">
              <Icon name="alert" size={15} />
              <div style={{ flex: 1 }}>
                <div className="small strong">خطاهای اخیر</div>
                <div className="tiny muted">تولیدهای ناموفق در ۲۴ ساعت گذشته</div>
              </div>
              <Badge tone={(health.data?.recent_failures ?? 0) > 0 ? "warn" : "ok"}>{health.data?.recent_failures ?? 0}</Badge>
            </div>
          </div>
          <div className="row wrap" style={{ marginTop: 12 }}>
            <Button size="sm" icon="key" onClick={() => setRoute("auth")}>مدیریت حساب</Button>
            <Button size="sm" icon="activity" onClick={() => setRoute("diagnostics")}>عیب‌یابی</Button>
            <Button size="sm" variant="ghost" icon="cpu" onClick={() => setRoute("engine")}>موتور هوش مصنوعی</Button>
          </div>
        </Card>

        <div className="stack">
          <Card>
            <div className="section-title"><h2>حساب فعال</h2></div>
            {activeProfile ? (
              <div className="stack" style={{ gap: 6 }}>
                <div className="row"><Icon name="user" size={14} /><span className="strong small">{activeProfile.name}</span></div>
                <div className="tiny muted">{faLabel(activeProfile.auth_mode)} · {faLabel(activeProfile.status)}</div>
                <div className="tiny dim">آخرین بررسی: {formatDate(activeProfile.last_checked)}</div>
              </div>
            ) : (
              <div className="muted small">حسابی انتخاب نشده است. برای ساخت تصویر، حساب را وصل کنید.</div>
            )}
            <div className="divider" style={{ margin: "12px 0" }} />
            <div className="tiny muted">پوشه اختصاصی Codex</div>
            <div className="mono-path">{boot?.paths.codex_home ?? "—"}</div>
          </Card>

          <Card>
            <div className="section-title"><h2>قابلیت‌های برنامه</h2><span>{registry.data?.total ?? 0}/۳۰۰</span></div>
            <div className="split-progress"><div style={{ width: `${registry.data?.total ? (shipped / registry.data.total) * 100 : 0}%` }} /></div>
            <div className="tiny muted" style={{ marginTop: 8 }}>
              {shipped} قابلیت ساخته یا تست شده است؛ وضعیت واقعی هر قابلیت مشخص است.
            </div>
            <Button size="sm" variant="ghost" icon="list" onClick={() => setRoute("diagnostics")} style={{ marginTop: 10 }}>مشاهده فهرست قابلیت‌ها</Button>
          </Card>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 22 }}>
        <h2>کارهای اخیر</h2>
        <Button size="sm" variant="ghost" icon="chevronLeft" onClick={() => setRoute("gallery")}>بازکردن گالری</Button>
      </div>
      {recent.isLoading ? <Spinner label="در حال بارگذاری گالری…" /> : null}
      {recent.data && recent.data.items.length === 0 ? (
        <Card>
          <div className="row between">
            <div>
              <div className="strong small">هنوز تصویری ساخته نشده</div>
              <div className="muted tiny">اولین تصویر را بسازید؛ برنامه آن را وارد کتابخانه می‌کند و پرامپتش را ذخیره می‌کند.</div>
            </div>
            <Button variant="primary" icon="sparkles" onClick={() => setRoute("create")}>ساخت تصویر</Button>
          </div>
        </Card>
      ) : null}
      <div className="gallery-grid" style={{ marginTop: 10 }}>
        {recent.data?.items.map((image) => (
          <ImageThumb key={image.id} record={image} onClick={() => { useApp.getState().setHandoff({ imageId: image.id, imagePath: image.path }); setRoute("edit"); }} />
        ))}
      </div>

      <div className="grid cols-3" style={{ marginTop: 22 }}>
        {[
          { title: "ساخت تصویر با کمک پرامپت", body: "ایده فارسی یا انگلیسی را به پرامپت حرفه‌ای تبدیل کنید و تصویر بسازید.", route: "create" as const, icon: "sparkles" as const },
          { title: "صف تولید گروهی", body: "چند پرامپت را در صف بگذارید و برنامه یکی‌یکی با امکان لغو آن‌ها را می‌سازد.", route: "batch" as const, icon: "grid" as const },
          { title: "گردش‌کار", body: "ساخت تصویر را با بزرگ‌نمایی، حذف پس‌زمینه و تغییر فرمت ترکیب کنید.", route: "workflows" as const, icon: "workflow" as const },
        ].map((card) => (
          <Card key={card.title} className="fade-in">
            <div className="row" style={{ gap: 10, marginBottom: 8 }}>
              <span style={{ color: "var(--accent)" }}><Icon name={card.icon} size={16} /></span>
              <span className="strong small">{card.title}</span>
            </div>
            <p className="muted tiny" style={{ margin: 0 }}>{card.body}</p>
            <Button size="sm" variant="ghost" icon="chevronLeft" style={{ marginTop: 10, paddingInline: 0 }} onClick={() => setRoute(card.route)}>بازکردن</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
