import { featureNameFa } from "../lib/feature-names.fa";
import { faLabel } from "@aria/core";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Card, Icon, Input, Select, Spinner, Stat } from "@aria/ui";
import { api, errorText, formatDate } from "@aria/core";
import { CATEGORIES, FEATURES, REGISTRY_HEALTH, STATUS_LABELS_FA, featureStats, type FeatureStatus } from "@aria/feature-registry";
import { useApp } from "../store";
import { useAction, useRegistrySummary } from "../lib/hooks";
import { PageHeader } from "../components/shell";

export function DiagnosticsPage() {
  const boot = useApp((state) => state.boot);
  const toast = useApp((state) => state.toast);
  const saveSettings = useApp((state) => state.saveSettings);
  const report = useQuery({ queryKey: ["diagnostics"], queryFn: api.diagnosticsRun });
  const registry = useRegistrySummary();
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const stats = useMemo(() => featureStats(), []);

  const sync = useAction(() => api.registrySync(FEATURES.map((feature) => ({
    id: feature.id,
    category: feature.category,
    category_label: feature.categoryLabel,
    name: feature.name,
    description: feature.description,
    status: feature.status,
    availability: feature.availability,
    dependencies: feature.dependencies,
    test_status: feature.testStatus,
  }))), {
    success: (result) => `${result.synced} قابلیت در پایگاه داده همگام شد`,
    onDone: () => registry.refetch(),
  });

  const exportReport = useAction(() => api.diagnosticsExport(), {
    success: (result) => `در ${result.dir} ذخیره شد`,
  });

  const features = useMemo(() => FEATURES.filter((feature) => {
    if (statusFilter !== "all" && feature.status !== statusFilter) return false;
    if (categoryFilter !== "all" && feature.category !== categoryFilter) return false;
    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      return `${feature.id} ${featureNameFa(feature.id)} ${feature.description}`.toLowerCase().includes(needle);
    }
    return true;
  }), [statusFilter, categoryFilter, search]);

  const data = report.data;

  return (
    <div className="page fade-in">
      <PageHeader
        title="عیب‌یابی و فهرست قابلیت‌ها"
        description="بررسی زنده نصب و جدول ۳۰۰ قابلیت. وضعیت‌ها بیانگر امکانات کد هستند، نه وعده توسعه؛ آزمون ساخت به معنی آزمون عملی همه قابلیت‌ها نیست."
        actions={
          <>
            <Button icon="refresh" onClick={() => report.refetch()}>اجرای بررسی‌ها</Button>
            <Button icon="download" loading={exportReport.isPending} onClick={() => exportReport.mutate([])}>خروجی گزارش</Button>
            <Button variant="primary" icon="list" loading={sync.isPending} onClick={() => sync.mutate([])}>همگام‌سازی فهرست</Button>
          </>
        }
      />

      <div className="grid cols-4">
        <Stat label="فهرست قابلیت‌ها" value={`${stats.total}/300`} sub={REGISTRY_HEALTH.complete ? "جدول کامل" : "ناقص"} icon="list" />
        <Stat label="پیاده‌سازی‌شده یا آزموده‌شده" value={stats.shipped} sub={`${stats.completion}٪ قابلیت‌ها`} icon="check" />
        <Stat label="بخشی آماده" value={stats.partial} sub="با محدودیت کار می‌کند" icon="alert" />
        <Stat label="پشتیبانی‌نشده" value={stats.unsupported} sub="در موتور در دسترس نیست" icon="close" />
      </div>

      <div className="grid split" style={{ marginTop: 16 }}>
        <Card>
          <div className="section-title">
            <h2>بررسی نصب</h2>
            {report.isLoading ? <Spinner label="در حال اجرا…" /> : data ? <Badge tone={data.overall === "ok" ? "ok" : data.overall === "warn" ? "warn" : "err"}>{faLabel(data.overall)}</Badge> : null}
          </div>
          {data ? (
            <>
              <div className="list">
                {data.checks.map((check) => (
                  <div className="list-row" key={check.id} style={{ alignItems: "flex-start", paddingBlock: 10 }}>
                    <span style={{ color: check.status === "ok" ? "var(--ok)" : check.status === "warn" ? "var(--warn)" : "var(--err)", marginTop: 2 }}>
                      <Icon name={check.status === "ok" ? "check" : "alert"} size={13} />
                    </span>
                    <div style={{ flex: 1 }}>
                      <div className="small strong">{check.label}</div>
                      <div className="tiny muted">{check.detail}</div>
                      {check.hint ? <div className="tiny dim" style={{ marginTop: 2 }}>{check.hint}</div> : null}
                    </div>
                    <Badge tone={check.status === "ok" ? "ok" : check.status === "warn" ? "warn" : "err"}>{faLabel(check.status)}</Badge>
                  </div>
                ))}
              </div>
              <div className="row between" style={{ marginTop: 10 }}>
                <span className="tiny dim">ساخته‌شده {formatDate(data.generated_at)}</span>
                <span className="tiny dim">{data.errors} خطا · {data.warnings} هشدار</span>
              </div>
            </>
          ) : null}
        </Card>

        <div className="stack">
          <Card>
            <div className="section-title"><h2>محیط اجرا</h2></div>
            <div className="list">
              <div className="list-row"><Icon name="cpu" size={13} /><span className="small" style={{ flex: 1 }}>سیستم‌عامل</span><span className="mono tiny">{boot?.platform}</span></div>
              <div className="list-row"><Icon name="terminal" size={13} /><span className="small" style={{ flex: 1 }}>Codex</span><span className="mono tiny truncate" style={{ maxWidth: 200 }}>{boot?.codex.path || "missing"}</span></div>
              <div className="list-row"><Icon name="database" size={13} /><span className="small" style={{ flex: 1 }}>تصاویر ثبت‌شده</span><span className="mono tiny">{boot?.counts.images ?? 0}</span></div>
              <div className="list-row"><Icon name="list" size={13} /><span className="small" style={{ flex: 1 }}>قابلیت‌های پایگاه داده</span><span className="mono tiny">{boot?.counts.features ?? 0}</span></div>
            </div>
            <div className="row wrap" style={{ marginTop: 10 }}>
              <Button size="sm" icon="folder" onClick={() => { if (boot?.paths.logs) void api.openPath(boot.paths.logs).catch(() => undefined); }}>بازکردن گزارش‌ها</Button>
              <Button size="sm" variant="ghost" icon="folder" onClick={() => { if (boot?.paths.exports) void api.openPath(boot.paths.exports).catch(() => undefined); }}>بازکردن خروجی‌ها</Button>
            </div>
          </Card>

          <Card>
            <div className="section-title"><h2>اقدامات رفع مشکل</h2></div>
            <div className="row wrap">
              <Button size="sm" icon="key" onClick={() => useApp.getState().setRoute("auth")}>بررسی اطلاعات ورود</Button>
              <Button size="sm" icon="download" onClick={async () => {
                try { await api.codexInstallSkill(); toast("مهارت دوباره نصب شد", "ok"); report.refetch(); }
                catch (error) { toast(errorText(error), "err"); }
              }}>ترمیم مهارت</Button>
              <Button size="sm" variant="ghost" icon="save" onClick={async () => {
                try { await saveSettings({}); toast("تنظیمات دوباره ذخیره و بررسی شد", "ok"); }
                catch (error) { toast(errorText(error), "err"); }
              }}>ذخیره دوباره تنظیمات</Button>
            </div>
            <div className="divider" style={{ margin: "10px 0" }} />
            <div className="tiny muted">سلامت فهرست قابلیت‌ها: {REGISTRY_HEALTH.actual} ردیف · تکراری {REGISTRY_HEALTH.duplicateIds} · تعداد مورد انتظار {REGISTRY_HEALTH.expected}</div>
            <div className="tiny muted">ردیف‌های پایگاه داده: {registry.data?.total ?? 0}</div>
          </Card>
        </div>
      </div>

      <Card style={{ marginTop: 16 }}>
        <div className="section-title">
          <h2>جدول قابلیت‌ها (۳۰۰)</h2>
          <div className="row wrap" style={{ gap: 6 }}>
            <div style={{ width: 190 }}>
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جستجو در قابلیت‌ها…" />
            </div>
            <div style={{ width: 170 }}>
              <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="وضعیت"
                options={[{ value: "all", label: "همه وضعیت‌ها" }, ...Object.entries(STATUS_LABELS_FA).map(([value, label]) => ({ value, label }))]} />
            </div>
            <div style={{ width: 210 }}>
              <Select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="دسته‌بندی"
                options={[{ value: "all", label: "همه دسته‌ها" }, ...CATEGORIES.map((category) => ({ value: category.id, label: category.labelFa }))]} />
            </div>
          </div>
        </div>
        <div className="tiny muted" style={{ marginBottom: 8 }}>{features.length} قابلیت نمایش داده می‌شود</div>
        <div style={{ maxHeight: 460, overflow: "auto" }}>
          <table className="table">
            <thead>
              <tr><th>#</th><th>قابلیت</th><th>دسته‌بندی</th><th>وضعیت</th><th>دسترسی</th><th>آزمون</th></tr>
            </thead>
            <tbody>
              {features.map((feature) => (
                <tr key={feature.id}>
                  <td className="mono tiny">{feature.id}</td>
                  <td>
                    <div className="small">{featureNameFa(feature.id)}</div>
                  </td>
                  <td className="tiny muted">{feature.categoryLabelFa}</td>
                  <td><Badge tone={feature.status === "tested" || feature.status === "implemented" ? "ok" : feature.status === "partial" ? "warn" : feature.status === "unsupported" || feature.status === "blocked" ? "err" : "default"}>{STATUS_LABELS_FA[feature.status as FeatureStatus]}</Badge></td>
                  <td className="tiny muted">{faLabel(feature.availability)}</td>
                  <td className="tiny dim">{faLabel(feature.testStatus)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row wrap" style={{ marginTop: 10 }}>
          <Button size="sm" icon="download" onClick={async () => {
            try { const result = await api.registryExport(); toast(`گزارش متنی در ${result.path} ذخیره شد`, "ok"); }
            catch (error) { toast(errorText(error), "err"); }
          }}>خروجی Markdown</Button>
          <span className="dim tiny">همین اطلاعات برای ساخت فایل FEATURES-300.md انتشار استفاده می‌شود.</span>
        </div>
      </Card>
    </div>
  );
}
