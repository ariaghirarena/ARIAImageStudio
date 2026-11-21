import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Icon, Input, Modal, Select, Spinner, Textarea } from "@aria/ui";
import { api, errorText, formatDate, formatDuration, onEvent, type Job } from "@aria/core";
import { QUALITY_PRESETS } from "@aria/prompt-engine";
import { useApp } from "../store";
import { useAction, useJobs, useProjects, useQueueState } from "../lib/hooks";
import { PageHeader } from "../components/shell";

export function BatchPage() {
  const settings = useApp((state) => state.settings);
  const toast = useApp((state) => state.toast);
  const projects = useProjects();
  const queue = useQueueState();
  const jobs = useJobs("all");

  const [text, setText] = useState("");
  const [projectId, setProjectId] = useState(settings.active_project_id);
  const [presetId, setPresetId] = useState(settings.quality_preset || "aria-best-quality");
  const [aspect, setAspect] = useState("1:1");
  const [count, setCount] = useState(1);
  const [negative, setNegative] = useState("watermark, text, blurry");
  const [enqueueing, setEnqueueing] = useState(false);
  const [eventsJob, setEventsJob] = useState<Job | null>(null);
  const [events, setEvents] = useState<{ id: number; ts: string; level: string; message: string }[]>([]);

  const prompts = useMemo(
    () => text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    [text],
  );

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void onEvent("aria://queue-changed", () => { queue.refetch(); jobs.refetch(); }).then((fn) => { unlisten = fn; }).catch(() => undefined);
    return () => unlisten?.();
  }, [jobs, queue]);

  useEffect(() => {
    if (!eventsJob) return;
    let alive = true;
    api.jobEvents(eventsJob.id).then((list) => { if (alive) setEvents(list); }).catch(() => undefined);
    return () => { alive = false; };
  }, [eventsJob]);

  const enqueueAll = async () => {
    if (prompts.length === 0) {
      toast("Add at least one prompt line", "err");
      return;
    }
    setEnqueueing(true);
    let ok = 0;
    let failed = 0;
    for (const prompt of prompts) {
      try {
        await api.generateQueue({
          project_id: projectId,
          profile_id: settings.active_profile_id,
          prompt_original: prompt,
          prompt_final: prompt,
          negative,
          aspect,
          count,
          model: settings.codex_model,
          reasoning_effort: settings.reasoning_effort,
          verbosity: settings.verbosity,
          sandbox_mode: settings.sandbox_mode,
          timeout_secs: settings.generation_timeout_secs,
          quality_preset: presetId,
        });
        ok += 1;
      } catch {
        failed += 1;
      }
    }
    setEnqueueing(false);
    queue.refetch();
    jobs.refetch();
    toast(failed === 0 ? `${ok} job(s) queued` : `${ok} queued, ${failed} rejected`, failed === 0 ? "ok" : "warn");
  };

  const pause = useAction((value: boolean) => api.queuePause(value), { success: "Queue state updated" });

  return (
    <div className="page fade-in">
      <PageHeader
        title="Batch Studio"
        description="One prompt per line. Every line becomes a durable SQLite job that survives restarts, with retry, priority and cancellation."
        actions={
          <>
            <Button icon={queue.data?.paused ? "play" : "pause"} onClick={() => pause.mutate([!queue.data?.paused])}>
              {queue.data?.paused ? "Resume queue" : "Pause queue"}
            </Button>
            <Button variant="primary" icon="grid" loading={enqueueing} onClick={() => void enqueueAll()}>
              Queue {prompts.length} job(s)
            </Button>
          </>
        }
      />

      <div className="grid split">
        <div className="stack">
          <Card>
            <div className="section-title"><h2>Prompts</h2><Badge>{prompts.length} line(s)</Badge></div>
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={"Luxury perfume bottle on black marble, soft rim light\nMinimal skincare jar on warm beige backdrop, negative space\nStudio portrait of a ceramic vase, linen background"}
              style={{ minHeight: 200, fontFamily: "var(--mono)", fontSize: 12 }}
            />
            <div className="field-hint">Blank lines are ignored. Each line is sent verbatim as the original prompt.</div>
            <div className="grid cols-2" style={{ marginTop: 12 }}>
              <div className="field"><span className="field-label">Project</span>
                <Select value={projectId} onChange={(event) => setProjectId(event.target.value)}
                  options={[{ value: "", label: "No project" }, ...(projects.data ?? []).map((project) => ({ value: project.id, label: project.name }))]} />
              </div>
              <div className="field"><span className="field-label">Quality preset</span>
                <Select value={presetId} onChange={(event) => setPresetId(event.target.value)} options={QUALITY_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))} />
              </div>
              <div className="field"><span className="field-label">Aspect</span>
                <Select value={aspect} onChange={(event) => setAspect(event.target.value)} options={["1:1", "4:5", "3:4", "16:9", "9:16", "3:2", "2:3"].map((value) => ({ value, label: value }))} />
              </div>
              <div className="field"><span className="field-label">Variants per prompt</span>
                <Select value={String(count)} onChange={(event) => setCount(Number(event.target.value))} options={[1, 2, 3, 4].map((value) => ({ value: String(value), label: String(value) }))} />
              </div>
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <span className="field-label">Negative constraints (applied to every job)</span>
              <Input value={negative} onChange={(event) => setNegative(event.target.value)} />
            </div>
          </Card>

          <Card>
            <div className="section-title">
              <h2>Queue</h2>
              <div className="row" style={{ gap: 6 }}>
                <Badge tone={queue.data?.paused ? "warn" : "ok"}>{queue.data?.paused ? "paused" : "running"}</Badge>
                <Badge>{queue.data?.queued ?? 0} queued</Badge>
                <Badge tone="info">{queue.data?.running ?? 0} running</Badge>
                {(queue.data?.failed ?? 0) > 0 ? <Badge tone="err">{queue.data?.failed} failed</Badge> : null}
              </div>
            </div>
            {jobs.isLoading ? <Spinner label="Loading jobs…" /> : null}
            {jobs.data && jobs.data.length === 0 ? <div className="muted small">The queue is empty. Add prompts above.</div> : null}
            <div className="list">
              {jobs.data?.map((job) => (
                <div className="list-row" key={job.id} style={{ alignItems: "flex-start", paddingBlock: 9 }}>
                  <StatusDot status={job.status} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="small truncate">{job.prompt || job.kind}</div>
                    <div className="tiny muted">
                      {formatDate(job.created_at)} · attempts {job.attempts}/{job.max_attempts} · priority {job.priority}
                      {job.started_at ? ` · started ${formatDate(job.started_at)}` : ""}
                    </div>
                    {job.error ? <div className="tiny" style={{ color: "#fecaca", marginTop: 2 }}>{job.error}</div> : null}
                  </div>
                  <div className="row" style={{ gap: 4 }}>
                    <Badge tone={job.status === "succeeded" ? "ok" : job.status === "failed" ? "err" : job.status === "running" ? "info" : "default"}>{job.status}</Badge>
                    <Button size="sm" variant="ghost" icon="terminal" onClick={() => setEventsJob(job)}>Events</Button>
                    {job.status === "failed" ? <Button size="sm" variant="ghost" icon="refresh" onClick={async () => { try { await api.jobRetry(job.id); toast("Job re-queued", "ok"); jobs.refetch(); } catch (error) { toast(errorText(error), "err"); } }}>Retry</Button> : null}
                    {job.status === "queued" || job.status === "running" ? <Button size="sm" variant="ghost" icon="close" onClick={async () => { try { await api.jobCancel(job.id); toast("Cancel requested", "info"); jobs.refetch(); } catch (error) { toast(errorText(error), "err"); } }}>Cancel</Button> : null}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <div className="section-title"><h2>How the queue works</h2></div>
            <ul className="small muted" style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.8 }}>
              <li>Jobs are rows in SQLite — closing the app never loses work.</li>
              <li>A worker pool runs at most {settings.max_concurrent_jobs} Codex call(s) at once.</li>
              <li>Interrupted runs are recovered on next start and marked for retry.</li>
              <li>Each attempt writes a generation record and redacted event log.</li>
              <li>Cancel terminates the Codex process tree, not just the promise.</li>
            </ul>
          </Card>
          <Card>
            <div className="section-title"><h2>Engine limits</h2></div>
            <p className="muted tiny" style={{ margin: 0 }}>
              Codex applies its own rate limits. ARIA spaces jobs through the worker pool and never tries to bypass them —
              if the account is throttled, the job records the error and can be retried later.
            </p>
            <div className="divider" style={{ margin: "10px 0" }} />
            <div className="stats-mini">
              <div><span>Concurrency</span><strong>{settings.max_concurrent_jobs}</strong></div>
              <div><span>Timeout</span><strong>{formatDuration(settings.generation_timeout_secs * 1000)}</strong></div>
            </div>
          </Card>
        </div>
      </div>

      <Modal open={Boolean(eventsJob)} title="Job events" subtitle={eventsJob?.prompt?.slice(0, 80)} onClose={() => setEventsJob(null)} wide>
        {events.length === 0 ? <div className="muted small">No events recorded for this job.</div> : (
          <div className="log-view" style={{ maxHeight: "50vh" }}>
            {events.map((event) => `[${event.ts}] ${event.level.toUpperCase()} ${event.message}`).join("\n")}
          </div>
        )}
        <div className="row" style={{ marginTop: 10 }}>
          <Icon name="info" size={13} />
          <span className="dim tiny">Tokens and auth values are redacted before they reach the event log.</span>
        </div>
      </Modal>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = status === "succeeded" ? "var(--ok)" : status === "failed" ? "var(--err)" : status === "running" ? "var(--accent)" : "var(--dim)";
  return <span style={{ width: 8, height: 8, borderRadius: 99, background: color, marginTop: 5, flex: "0 0 auto" }} />;
}
