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
        title="Analytics"
        description="Local metrics computed from SQLite. Nothing is uploaded; exports are plain files you choose."
        actions={
          <>
            <Button icon="refresh" onClick={() => { summary.refetch(); timeseries.refetch(); }}>Refresh</Button>
            <Button icon="download" onClick={async () => {
              try {
                const result = await api.analyticsExport();
                toast(`Analytics exported to ${result.path}`, "ok");
              } catch (error) { toast(errorText(error), "err"); }
            }}>Export</Button>
            <Button variant="ghost" icon="database" onClick={async () => {
              try { const result = await api.storageUsage(); setStorageInfo(result); toast(`${result.files} files · ${formatBytes(result.bytes)}`, "info"); }
              catch (error) { toast(errorText(error), "err"); }
            }} loading={storage.isPending}>Storage usage</Button>
          </>
        }
      />

      {summary.isLoading ? <Spinner label="Computing metrics…" /> : null}

      <div className="grid cols-4">
        <Stat label="Images" value={data?.images ?? 0} sub={`${formatBytes(data?.disk_bytes ?? 0)} total`} icon="image" />
        <Stat label="Success rate" value={`${data?.success_rate ?? 0}%`} sub={`${data?.generations_succeeded ?? 0} of ${data?.generations ?? 0} runs`} icon="check" />
        <Stat label="Failed generations" value={data?.generations_failed ?? 0} sub={`${data?.jobs_failed ?? 0} failed job(s)`} icon="alert" />
        <Stat label="Average duration" value={formatDuration(data?.avg_duration_ms ?? 0)} sub="successful runs only" icon="clock" />
      </div>

      <div className="grid split" style={{ marginTop: 16 }}>
        <Card>
          <div className="section-title">
            <h2>Images per day</h2>
            <Select value={String(days)} onChange={(event) => setDays(Number(event.target.value))} aria-label="Range" style={{ width: 110 }}
              options={[7, 14, 30, 90].map((value) => ({ value: String(value), label: `${value} days` }))} />
          </div>
          {timeseries.isLoading ? <Spinner label="Loading series…" /> : null}
          {series.length === 0 && !timeseries.isLoading ? <div className="muted small">No activity in this range.</div> : null}
          <div className="chart" style={{ height: 170 }}>
            {series.map((point) => (
              <div key={point.day} className="chart-col" title={`${point.day}: ${point.images}`}>
                <div className="chart-bar" style={{ height: `${(point.images / max) * 100}%` }} />
                <span className="chart-label">{point.day.slice(5)}</span>
              </div>
            ))}
          </div>
          <div className="row between" style={{ marginTop: 8 }}>
            <span className="tiny muted">max {max}/day</span>
            <span className="tiny dim">{series.reduce((total, point) => total + point.images, 0)} images in range</span>
          </div>
        </Card>

        <div className="stack">
          <Card>
            <div className="section-title"><h2>Library</h2></div>
            <div className="stats-mini">
              <div><span>Projects</span><strong>{data?.projects ?? 0}</strong></div>
              <div><span>Prompts</span><strong>{data?.prompts ?? 0}</strong></div>
              <div><span>Favourites</span><strong>{data?.favorites ?? 0}</strong></div>
              <div><span>Jobs</span><strong>{data?.jobs ?? 0}</strong></div>
            </div>
            <div className="divider" style={{ margin: "10px 0" }} />
            <div className="row between">
              <span className="small">Features registered</span>
              <Badge tone="info">{data?.features_registered ?? 0}</Badge>
            </div>
            <div className="row between" style={{ marginTop: 6 }}>
              <span className="small">Features implemented</span>
              <Badge tone="ok">{data?.features_implemented ?? 0}</Badge>
            </div>
          </Card>

          <Card>
            <div className="section-title"><h2>Job outcomes</h2>
              <div className="row" style={{ gap: 8 }}><Toggle checked={showJobs} onChange={setShowJobs} label="Show jobs" /><span className="tiny muted">jobs</span></div>
            </div>
            {!showJobs ? <div className="muted small">Enable “jobs” to see per-status counts stored in the database.</div> : jobRows.length === 0 ? <div className="muted small">No job rows in this range.</div> : (
              <div className="list">
                {jobRows.map((row, index) => (
                  <div className="list-row" key={index}>
                    <Icon name="workflow" size={13} />
                    <span className="small" style={{ flex: 1 }}>{String(row.status ?? "unknown")}</span>
                    <span className="tiny mono muted">{String(row.count ?? row.total ?? "")}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {storageInfo ? (
            <Card tight>
              <div className="section-title"><h2>Storage</h2><Badge>{formatBytes(storageInfo.bytes)}</Badge></div>
              <div className="mono-path">{storageInfo.root}</div>
              <div className="tiny muted" style={{ marginTop: 4 }}>{storageInfo.files} files indexed on disk.</div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
