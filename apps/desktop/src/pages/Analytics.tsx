import { faLabel } from "@aria/core";
import { useState } from "react";
import { Badge, Button, Card, Icon, Select, Spinner, Stat, Toggle } from "@aria/ui";
import { api, errorText, formatBytes, formatDuration } from "@aria/core";
import { useApp } from "../store";
import { useAction, useAnalytics, useTimeseries } from "../lib/hooks";
import { PageHeader } from "../components/shell";

export function AnalyticsPage() {
  const toast = useApp((state) => state.toast);
  const summary = useAnalytics();
  const [days, setDays] = useState(14);
  const [showJobs, setShowJobs] = useState(false);
  const timeseries = useTimeseries(days);
  const storage = useAction(() => api.storageUsage(), {});
  const [storageInfo, setStorageInfo] = useState<{ files: number; bytes: number; root: string } | null>(null);

  const data = summary.data;
  const series = timeseries.data?.images ?? [];
  const max = Math.max(1, ...series.map((point) => point.images));
  const jobRows = timeseries.data?.jobs ?? [];

  return (
   <div className="page fade-in">
      <PageHeader
        title="آمار استفاده"
        description="آمار از پایگاه داده همین دستگاه محاسبه می‌شود. چیزی بارگذاری نمی‌شود؛ محل ذخیره خروجی را خودتان انتخاب می‌کنید."
        actions={
          <>
            <Button icon="refresh" onClick={() => { summary.refetch(); timeseries.refetch(); }}>تازه‌سازی</Button>
            <Button icon="download" onClick={async () => {
              try {
                const result = await api.analyticsExport();
                toast(`آمار در ${result.path} ذخیره شد`, "ok");
              } catch (error) { toast(errorText(error), "err"); }
            }}>خروجی گرفتن</Button>
            <Button variant="ghost" icon="database" onClick={async () => {
              try { const result = await api.storageUsage(); setStorageInfo(result); toast(`${result.files} فایل · ${formatBytes(result.bytes)}`, "info"); }
              catch (error) { toast(errorText(error), "err"); }
            }} loading={storage.isPending}>فضای مصرفی</Button>
          </>
        }
      />

      {summary.isLoading ? <Spinner label="در حال محاسبه آمار…" /> : null}

      <div className="grid cols-4">
        <Stat label="تصاویر" value={data?.images ?? 0} sub={`${formatBytes(data?.disk_bytes ?? 0)} در مجموع`} icon="image" />
        <Stat label="درصد موفقیت" value={`${data?.success_rate ?? 0}%`} sub={`${data?.generations_succeeded ?? 0} از ${data?.generations ?? 0} اجرا`} icon="check" />
        <Stat label="تولیدهای ناموفق" value={data?.generations_failed ?? 0} sub={`${data?.jobs_failed ?? 0} کار ناموفق`} icon="alert" />
        <Stat label="میانگین زمان" value={formatDuration(data?.avg_duration_ms ?? 0)} sub="فقط اجراهای موفق" icon="clock" />
      </div>

      <div className="grid split" style={{ marginTop: 16 }}>
        <Card>
          <div className="section-title">
            <h2>تصاویر هر روز</h2>
            <Select value={String(days)} onChange={(event) => setDays(Number(event.target.value))} aria-label="بازه زمانی" style={{ width: 110 }}
              options={[7, 14, 30, 90].map((value) => ({ value: String(value), label: `${value} روز` }))} />
          </div>
          {timeseries.isLoading ? <Spinner label="در حال بارگذاری نمودار…" /> : null}
          {series.length === 0 && !timeseries.isLoading ? <div className="muted small">در این بازه فعالیتی ثبت نشده است.</div> : null}
          <div className="chart" style={{ height: 170 }}>
            {series.map((point) => (
              <div key={point.day} className="chart-col" title={`${point.day}: ${point.images}`}>
                <div className="chart-bar" style={{ height: `${(point.images / max) * 100}%` }} />
                <span className="chart-label">{point.day.slice(5)}</span>
              </div>
            ))}
          </div>
          <div className="row between" style={{ marginTop: 8 }}>
            <span className="tiny muted">بیشترین {max}در روز</span>
            <span className="tiny dim">{series.reduce((total, point) => total + point.images, 0)} تصویر در بازه</span>
          </div>
        </Card>

        <div className="stack">
          <Card>
            <div className="section-title"><h2>کتابخانه</h2></div>
            <div className="stats-mini">
              <div><span>پروژه‌ها</span><strong>{data?.projects ?? 0}</strong></div>
              <div><span>پرامپت‌ها</span><strong>{data?.prompts ?? 0}</strong></div>
              <div><span>علاقه‌مندی‌ها</span><strong>{data?.favorites ?? 0}</strong></div>
              <div><span>کارهای صف</span><strong>{data?.jobs ?? 0}</strong></div>
            </div>
            <div className="divider" style={{ margin: "10px 0" }} />
            <div className="row between">
              <span className="small">قابلیت‌های ثبت‌شده</span>
              <Badge tone="info">{data?.features_registered ?? 0}</Badge>
            </div>
            <div className="row between" style={{ marginTop: 6 }}>
              <span className="small">قابلیت‌های پیاده‌سازی‌شده</span>
              <Badge tone="ok">{data?.features_implemented ?? 0}</Badge>
            </div>
          </Card>

          <Card>
            <div className="section-title"><h2>نتیجه کارها</h2>
              <div className="row" style={{ gap: 8 }}><Toggle checked={showJobs} onChange={setShowJobs} label="نمایش کارها" /><span className="tiny muted">کار</span></div>
            </div>
            {!showJobs ? <div className="muted small">برای دیدن تعداد کارها بر اساس وضعیت، نمایش کارها را فعال کنید.</div> : jobRows.length === 0 ? <div className="muted small">در این بازه کاری ثبت نشده است.</div> : (
              <div className="list">
                {jobRows.map((row, index) => (
                  <div className="list-row" key={index}>
                    <Icon name="workflow" size={13} />
                    <span className="small" style={{ flex: 1 }}>{faLabel(row.status ?? "unknown")}</span>
                    <span className="tiny mono muted">{String(row.count ?? row.total ?? "")}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {storageInfo ? (
            <Card tight>
              <div className="section-title"><h2>فضای ذخیره‌سازی</h2><Badge>{formatBytes(storageInfo.bytes)}</Badge></div>
              <div className="mono-path">{storageInfo.root}</div>
              <div className="tiny muted" style={{ marginTop: 4 }}>{storageInfo.files} فایل روی دیسک ثبت شده است.</div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
