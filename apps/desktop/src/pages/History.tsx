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
        title="History"
        description="Every engine call, in order, with its final prompt, duration, exit code and redacted log."
        actions={
          <>
            <Button icon="refresh" onClick={() => { generations.refetch(); jobs.refetch(); }}>Refresh</Button>
            <Button icon="activity" onClick={() => useApp.getState().setRoute("analytics")}>Analytics</Button>
          </>
        }
      />

      <div className="row between" style={{ marginBottom: 12 }}>
        <Tabs
          items={[{ id: "generations", label: "Generations", badge: generations.data?.length ?? 0 }, { id: "jobs", label: "Jobs", badge: jobs.data?.length ?? 0 }]}
          active={tab}
          onChange={setTab}
        />
        <div style={{ width: 190 }}>
          <Select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status"
            options={[{ value: "all", label: "All statuses" }, { value: "succeeded", label: "succeeded" }, { value: "failed", label: "failed" }, { value: "running", label: "running" }, { value: "queued", label: "queued" }, { value: "cancelled", label: "cancelled" }]} />
        </div>
      </div>

      {tab === "generations" ? (
        <Card>
          {generations.isLoading ? <Spinner label="Loading generations…" /> : null}
          {filteredGenerations.length === 0 && !generations.isLoading ? <div className="muted small">No generations recorded yet.</div> : null}
          <div className="list">
            {filteredGenerations.map((generation) => (
              <button key={generation.id} className="history-row" onClick={() => setDetail(generation)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <Badge tone={generation.status === "succeeded" ? "ok" : generation.status === "failed" ? "err" : "info"}>{generation.status}</Badge>
                    <span className="tiny muted">{formatDate(generation.started_at)}</span>
                    <span className="tiny dim">{formatDuration(generation.duration_ms)}</span>
                    <span className="tiny dim">{generation.result_count} image(s)</span>
                  </div>
                  <div className="small truncate" style={{ marginTop: 4 }}>{generation.prompt_original || generation.prompt_final}</div>
                  {generation.error ? <div className="tiny" style={{ color: "#fecaca" }}>{generation.error}</div> : null}
                </div>
                <Icon name="chevronRight" size={13} />
              </button>
            ))}
          </div>
        </Card>
      ) : (
        <Card>
          {jobs.isLoading ? <Spinner label="Loading jobs…" /> : null}
          {jobs.data && jobs.data.length === 0 ? <div className="muted small">No jobs recorded.</div> : null}
          <div className="list">
            {jobs.data?.map((job) => (
              <div className="history-row" key={job.id} style={{ cursor: "default" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <Badge tone={job.status === "succeeded" ? "ok" : job.status === "failed" ? "err" : job.status === "running" ? "info" : "default"}>{job.status}</Badge>
                    <span className="tiny muted">{job.kind}</span>
                    <span className="tiny dim">attempts {job.attempts}/{job.max_attempts}</span>
                    <span className="tiny dim">{formatDate(job.created_at)}</span>
                  </div>
                  <div className="small truncate" style={{ marginTop: 4 }}>{job.prompt}</div>
                  {job.error ? <div className="tiny" style={{ color: "#fecaca" }}>{job.error}</div> : null}
                </div>
                <div className="row" style={{ gap: 4 }}>
                  <Button size="sm" variant="ghost" icon="terminal" onClick={async () => {
                    setEventsJob(job);
                    try { setEvents(await api.jobEvents(job.id)); } catch (error) { toast(errorText(error), "err"); }
                  }}>Events</Button>
                  {job.status === "failed" ? <Button size="sm" variant="ghost" icon="refresh" onClick={async () => {
                    try { await api.jobRetry(job.id); toast("Job re-queued", "ok"); jobs.refetch(); } catch (error) { toast(errorText(error), "err"); }
                  }}>Retry</Button> : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={Boolean(detail)} title="Generation detail" subtitle={detail?.id} onClose={() => setDetail(null)} wide>
        {detail ? (
          <div className="stack">
            <div className="row wrap" style={{ gap: 6 }}>
              <Badge tone={detail.status === "succeeded" ? "ok" : "err"}>{detail.status}</Badge>
              <Badge>{detail.engine}</Badge>
              <Badge>{formatDuration(detail.duration_ms)}</Badge>
              <Badge>{detail.result_count} image(s)</Badge>
              {detail.model_note ? <Badge tone="info">{detail.model_note}</Badge> : null}
            </div>
            <div>
              <div className="tiny muted">Original prompt</div>
              <div className="small" style={{ whiteSpace: "pre-wrap" }}>{detail.prompt_original || "—"}</div>
            </div>
            <div>
              <div className="tiny muted">Final prompt sent</div>
              <div className="mono tiny" style={{ whiteSpace: "pre-wrap", color: "var(--text-soft)" }}>{detail.prompt_final || "—"}</div>
            </div>
            {detail.error ? <div className="banner err"><Icon name="alert" size={14} /><span className="small">{detail.error}</span></div> : null}
            <div className="tiny dim">
              started {formatDate(detail.started_at)} · finished {detail.finished_at ? formatDate(detail.finished_at) : "—"}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(eventsJob)} title="Job events" subtitle={eventsJob?.id} onClose={() => setEventsJob(null)} wide>
        <div className="log-view" style={{ maxHeight: "55vh" }}>
          {events.length === 0 ? "No events." : events.map((event) => `[${event.ts}] ${event.level.toUpperCase()} ${event.message}`).join("\n")}
        </div>
      </Modal>
    </div>
  );
}
