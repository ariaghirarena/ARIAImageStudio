import { faLabel } from "@aria/core";
import { useState } from "react";
import { Badge, Button, Card, Icon, Modal, Select, Spinner, Tabs } from "@aria/ui";
import { api, errorText, formatDate, formatDuration, type Generation, type Job } from "@aria/core";
import { useApp } from "../store";
import { useGenerations, useJobs } from "../lib/hooks";
import { PageHeader } from "../components/shell";

export function HistoryPage() {
  const toast = useApp((state) => state.toast);
  const [tab, setTab] = useState("generations");
  const [status, setStatus] = useState("all");
  const generations = useGenerations();
  const jobs = useJobs(status);
  const [detail, setDetail] = useState<Generation | null>(null);
  const [eventsJob, setEventsJob] = useState<Job | null>(null);
  const [events, setEvents] = useState<{ id: number; ts: string; level: string; message: string }[]>([]);

  const filteredGenerations = (generations.data ?? []).filter((item) => status === "all" || item.status === status);

  return (
    <div className="page fade-in">
      <PageHeader
        title="تاریخچه"
        description="همه اجراهای موتور به‌ترتیب، همراه با توضیح نهایی، مدت، کد خروج و گزارش بدون اطلاعات حساس."
        actions={
          <>
            <Button icon="refresh" onClick={() => { generations.refetch(); jobs.refetch(); }}>تازه‌سازی</Button>
            <Button icon="activity" onClick={() => useApp.getState().setRoute("analytics")}>آمار استفاده</Button>
          </>
        }
      />

      <div className="row between" style={{ marginBottom: 12 }}>
        <Tabs
          items={[{ id: "generations", label: "تولید تصاویر", badge: generations.data?.length ?? 0 }, { id: "jobs", label: "کارهای صف", badge: jobs.data?.length ?? 0 }]}
          active={tab}
          onChange={setTab}
        />
        <div style={{ width: 190 }}>
          <Select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="وضعیت"
            options={[{ value: "all", label: "همه وضعیت‌ها" }, { value: "succeeded", label: "موفق" }, { value: "failed", label: "ناموفق" }, { value: "running", label: "در حال اجرا" }, { value: "queued", label: "در صف" }, { value: "cancelled", label: "لغوشده" }]} />
        </div>
      </div>

      {tab === "generations" ? (
        <Card>
          {generations.isLoading ? <Spinner label="در حال بارگذاری تاریخچه…" /> : null}
          {filteredGenerations.length === 0 && !generations.isLoading ? <div className="muted small">هنوز تولیدی ثبت نشده است.</div> : null}
          <div className="list">
            {filteredGenerations.map((generation) => (
              <button key={generation.id} className="history-row" onClick={() => setDetail(generation)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <Badge tone={generation.status === "succeeded" ? "ok" : generation.status === "failed" ? "err" : "info"}>{faLabel(generation.status)}</Badge>
                    <span className="tiny muted">{formatDate(generation.started_at)}</span>
                    <span className="tiny dim">{formatDuration(generation.duration_ms)}</span>
                    <span className="tiny dim">{generation.result_count} تصویر</span>
                  </div>
                  <div className="small truncate" style={{ marginTop: 4 }}>{generation.prompt_original || generation.prompt_final}</div>
                  {generation.error ? <div className="tiny" style={{ color: "var(--err)" }}>{generation.error}</div> : null}
                </div>
                <Icon name="chevronRight" size={13} />
              </button>
            ))}
          </div>
        </Card>
      ) : (
        <Card>
          {jobs.isLoading ? <Spinner label="در حال بارگذاری کارها…" /> : null}
          {jobs.data && jobs.data.length === 0 ? <div className="muted small">کاری ثبت نشده است.</div> : null}
          <div className="list">
            {jobs.data?.map((job) => (
              <div className="history-row" key={job.id} style={{ cursor: "default" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <Badge tone={job.status === "succeeded" ? "ok" : job.status === "failed" ? "err" : job.status === "running" ? "info" : "default"}>{faLabel(job.status)}</Badge>
                    <span className="tiny muted">{job.kind}</span>
                    <span className="tiny dim">دفعات تلاش {job.attempts}/{job.max_attempts}</span>
                    <span className="tiny dim">{formatDate(job.created_at)}</span>
                  </div>
                  <div className="small truncate" style={{ marginTop: 4 }}>{job.prompt}</div>
                  {job.error ? <div className="tiny" style={{ color: "var(--err)" }}>{job.error}</div> : null}
                </div>
                <div className="row" style={{ gap: 4 }}>
                  <Button size="sm" variant="ghost" icon="terminal" onClick={async () => {
                    setEventsJob(job);
                    try { setEvents(await api.jobEvents(job.id)); } catch (error) { toast(errorText(error), "err"); }
                  }}>رویدادها</Button>
                  {job.status === "failed" ? <Button size="sm" variant="ghost" icon="refresh" onClick={async () => {
                    try { await api.jobRetry(job.id); toast("کار دوباره به صف اضافه شد", "ok"); jobs.refetch(); } catch (error) { toast(errorText(error), "err"); }
                  }}>تلاش مجدد</Button> : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={Boolean(detail)} title="جزئیات تولید" subtitle={detail?.id} onClose={() => setDetail(null)} wide>
        {detail ? (
          <div className="stack">
            <div className="row wrap" style={{ gap: 6 }}>
              <Badge tone={detail.status === "succeeded" ? "ok" : "err"}>{faLabel(detail.status)}</Badge>
              <Badge>{detail.engine}</Badge>
              <Badge>{formatDuration(detail.duration_ms)}</Badge>
              <Badge>{detail.result_count} تصویر</Badge>
              {detail.model_note ? <Badge tone="info">{faLabel(detail.model_note)}</Badge> : null}
            </div>
            <div>
              <div className="tiny muted">توضیح اصلی</div>
              <div className="small" style={{ whiteSpace: "pre-wrap" }}>{detail.prompt_original || "—"}</div>
            </div>
            <div>
              <div className="tiny muted">توضیح نهایی ارسال‌شده</div>
              <div className="mono tiny" style={{ whiteSpace: "pre-wrap", color: "var(--text-soft)" }}>{detail.prompt_final || "—"}</div>
            </div>
            {detail.error ? <div className="banner err"><Icon name="alert" size={14} /><span className="small">{detail.error}</span></div> : null}
            <div className="tiny dim">
              شروع {formatDate(detail.started_at)} · پایان {detail.finished_at ? formatDate(detail.finished_at) : "—"}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(eventsJob)} title="رویدادهای کار" subtitle={eventsJob?.id} onClose={() => setEventsJob(null)} wide>
        <div className="log-view" style={{ maxHeight: "55vh" }}>
          {events.length === 0 ? "رویدادی نیست." : events.map((event) => `[${event.ts}] ${event.level.toUpperCase()} ${event.message}`).join("\n")}
        </div>
      </Modal>
    </div>
  );
}
