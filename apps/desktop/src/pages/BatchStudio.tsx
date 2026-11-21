import { faLabel } from "@aria/core";
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
  const [negative, setNegative] = useState("واترمارک، متن، تاری");
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
      toast("حداقل یک خط توضیح تصویر بنویسید", "err");
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
    toast(failed === 0 ? `${ok} کار به صف اضافه شد` : `${ok} کار در صف؛ ${failed} کار پذیرفته نشد`, failed === 0 ? "ok" : "warn");
  };

  const pause = useAction((value: boolean) => api.queuePause(value), { success: "وضعیت صف به‌روز شد" });

  return (
    <div className="page fade-in">
      <PageHeader
        title="ساخت گروهی تصاویر"
        description="هر خط یک توضیح تصویر است و به یک کار ذخیره‌شده در صف تبدیل می‌شود. کارها پس از بستن برنامه باقی می‌مانند و قابل تکرار، اولویت‌بندی و لغو هستند."
        actions={
          <>
            <Button icon={queue.data?.paused ? "play" : "pause"} onClick={() => pause.mutate([!queue.data?.paused])}>
              {queue.data?.paused ? "ادامه صف" : "توقف موقت صف"}
            </Button>
            <Button variant="primary" icon="grid" loading={enqueueing} onClick={() => void enqueueAll()}>
              افزودن به صف {prompts.length} کار
            </Button>
          </>
        }
      />

      <div className="grid split">
        <div className="stack">
          <Card>
            <div className="section-title"><h2>پرامپت‌ها</h2><Badge>{prompts.length} خط</Badge></div>
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={"بطری عطر لوکس روی مرمر سیاه، نور نرم از لبه\nظرف کرم روی پس‌زمینه بژ گرم و ساده\nعکس استودیویی گلدان سرامیکی روی زمینه کتان"}
              style={{ minHeight: 200, fontFamily: "var(--mono)", fontSize: 12 }}
            />
            <div className="field-hint">خطوط خالی نادیده گرفته می‌شوند. هر خط بدون تغییر به‌عنوان توضیح اصلی ثبت می‌شود.</div>
            <div className="grid cols-2" style={{ marginTop: 12 }}>
              <div className="field"><span className="field-label">پروژه</span>
                <Select value={projectId} onChange={(event) => setProjectId(event.target.value)}
                  options={[{ value: "", label: "بدون پروژه" }, ...(projects.data ?? []).map((project) => ({ value: project.id, label: project.name }))]} />
              </div>
              <div className="field"><span className="field-label">تنظیم آماده کیفیت</span>
                <Select value={presetId} onChange={(event) => setPresetId(event.target.value)} options={QUALITY_PRESETS.map((preset) => ({ value: preset.id, label: preset.labelFa }))} />
              </div>
              <div className="field"><span className="field-label">نسبت ابعاد</span>
                <Select value={aspect} onChange={(event) => setAspect(event.target.value)} options={["1:1", "4:5", "3:4", "16:9", "9:16", "3:2", "2:3"].map((value) => ({ value, label: value }))} />
              </div>
              <div className="field"><span className="field-label">تعداد نسخه برای هر توضیح</span>
                <Select value={String(count)} onChange={(event) => setCount(Number(event.target.value))} options={[1, 2, 3, 4].map((value) => ({ value: String(value), label: String(value) }))} />
              </div>
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <span className="field-label">موارد ممنوعه (برای همه کارها)</span>
              <Input value={negative} onChange={(event) => setNegative(event.target.value)} />
            </div>
          </Card>

          <Card>
            <div className="section-title">
              <h2>افزودن به صف</h2>
              <div className="row" style={{ gap: 6 }}>
                <Badge tone={queue.data?.paused ? "warn" : "ok"}>{queue.data?.paused ? "متوقف‌شده" : "در حال اجرا"}</Badge>
                <Badge>{queue.data?.queued ?? 0} در صف</Badge>
                <Badge tone="info">{queue.data?.running ?? 0} در حال اجرا</Badge>
                {(queue.data?.failed ?? 0) > 0 ? <Badge tone="err">{queue.data?.failed} ناموفق</Badge> : null}
              </div>
            </div>
            {jobs.isLoading ? <Spinner label="در حال بارگذاری کارها…" /> : null}
            {jobs.data && jobs.data.length === 0 ? <div className="muted small">صف خالی است. توضیح تصاویر را بالا وارد کنید.</div> : null}
            <div className="list">
              {jobs.data?.map((job) => (
                <div className="list-row" key={job.id} style={{ alignItems: "flex-start", paddingBlock: 9 }}>
                  <StatusDot status={faLabel(job.status)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="small truncate">{job.prompt || job.kind}</div>
                    <div className="tiny muted">
                      {formatDate(job.created_at)} · دفعات تلاش {job.attempts}/{job.max_attempts} · اولویت {job.priority}
                      {job.started_at ? ` · شروع ${formatDate(job.started_at)}` : ""}
                    </div>
                    {job.error ? <div className="tiny" style={{ color: "var(--err)", marginTop: 2 }}>{job.error}</div> : null}
                  </div>
                  <div className="row" style={{ gap: 4 }}>
                    <Badge tone={job.status === "succeeded" ? "ok" : job.status === "failed" ? "err" : job.status === "running" ? "info" : "default"}>{faLabel(job.status)}</Badge>
                    <Button size="sm" variant="ghost" icon="terminal" onClick={() => setEventsJob(job)}>رویدادها</Button>
                    {job.status === "failed" ? <Button size="sm" variant="ghost" icon="refresh" onClick={async () => { try { await api.jobRetry(job.id); toast("کار دوباره به صف اضافه شد", "ok"); jobs.refetch(); } catch (error) { toast(errorText(error), "err"); } }}>تلاش مجدد</Button> : null}
                    {job.status === "queued" || job.status === "running" ? <Button size="sm" variant="ghost" icon="close" onClick={async () => { try { await api.jobCancel(job.id); toast("درخواست لغو ثبت شد", "info"); jobs.refetch(); } catch (error) { toast(errorText(error), "err"); } }}>لغو</Button> : null}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <div className="section-title"><h2>صف چگونه کار می‌کند؟</h2></div>
            <ul className="small muted" style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.8 }}>
              <li>کارها در پایگاه داده ذخیره می‌شوند و با بستن برنامه از بین نمی‌روند.</li>
              <li>حداکثر {settings.max_concurrent_jobs} درخواست Codex هم‌زمان اجرا می‌شود.</li>
              <li>کارهای قطع‌شده در اجرای بعدی شناسایی و برای تلاش مجدد علامت‌گذاری می‌شوند.</li>
              <li>نتیجه هر تلاش و گزارش بدون اطلاعات حساس ثبت می‌شود.</li>
              <li>لغو کار، فرایند Codex و فرایندهای وابسته را متوقف می‌کند.</li>
            </ul>
          </Card>
          <Card>
            <div className="section-title"><h2>محدودیت‌های موتور</h2></div>
            <p className="muted tiny" style={{ margin: 0 }}>
              Codex محدودیت استفاده خودش را دارد. برنامه آن را دور نمی‌زند؛ اگر حساب محدود شود، خطا ثبت می‌شود و بعداً می‌توانید دوباره تلاش کنید.
            </p>
            <div className="divider" style={{ margin: "10px 0" }} />
            <div className="stats-mini">
              <div><span>تعداد اجرای هم‌زمان</span><strong>{settings.max_concurrent_jobs}</strong></div>
              <div><span>مهلت اجرا</span><strong>{formatDuration(settings.generation_timeout_secs * 1000)}</strong></div>
            </div>
          </Card>
        </div>
      </div>

      <Modal open={Boolean(eventsJob)} title="رویدادهای کار" subtitle={eventsJob?.prompt?.slice(0, 80)} onClose={() => setEventsJob(null)} wide>
        {events.length === 0 ? <div className="muted small">برای این کار رویدادی ثبت نشده است.</div> : (
          <div className="log-view" style={{ maxHeight: "50vh" }}>
            {events.map((event) => `[${event.ts}] ${event.level.toUpperCase()} ${event.message}`).join("\n")}
          </div>
        )}
        <div className="row" style={{ marginTop: 10 }}>
          <Icon name="info" size={13} />
          <span className="dim tiny">توکن‌ها و اطلاعات ورود پیش از ثبت گزارش حذف می‌شوند.</span>
        </div>
      </Modal>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = status === "succeeded" ? "var(--ok)" : status === "failed" ? "var(--err)" : status === "running" ? "var(--accent)" : "var(--dim)";
  return <span style={{ width: 8, height: 8, borderRadius: 99, background: color, marginTop: 5, flex: "0 0 auto" }} />;
}
