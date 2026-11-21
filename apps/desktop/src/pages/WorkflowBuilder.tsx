import { faLabel } from "@aria/core";
import { useEffect, useState } from "react";
import { Badge, Button, Card, Input, Select, Spinner, Textarea } from "@aria/ui";
import { api, errorText, formatDate } from "@aria/core";
import { useApp } from "../store";
import { useProjects, useWorkflows } from "../lib/hooks";
import { PageHeader } from "../components/shell";

type StepType = "generate" | "upscale" | "remove_background" | "convert";

interface Step {
  type: StepType;
  params: Record<string, unknown>;
}

const STEP_LABELS: Record<StepType, string> = {
  generate: "ساخت تصویر",
  upscale: "بزرگ‌نمایی (روش Lanczos)",
  remove_background: "حذف پس‌زمینه",
  convert: "تبدیل فرمت",
};

const STEP_HELP: Record<StepType, string> = {
  generate: "موتور یک بار اجرا می‌شود. مرحله‌های بعد روی اولین تصویر خروجی کار می‌کنند.",
  upscale: "بزرگ‌نمایی محلی همراه افزایش وضوح؛ از هوش مصنوعی استفاده نمی‌کند.",
  remove_background: "حذف یک طیف رنگ از پس‌زمینه و ذخیره PNG شفاف؛ مناسب زمینه‌های یکدست.",
  convert: "تصویر فعلی را با کیفیت انتخابی به فرمت دیگری تبدیل می‌کند.",
};

export function WorkflowPage() {
  const toast = useApp((state) => state.toast);
  const projects = useProjects();
  const workflows = useWorkflows();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<Step[]>([{ type: "generate", params: { prompt: "", aspect: "4:5", count: 1 } }]);
  const [running, setRunning] = useState(false);
  const [runLog, setRunLog] = useState<string[]>([]);
  const [runResult, setRunResult] = useState<{ status: string; images: number } | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedId || !workflows.data) return;
    const workflow = workflows.data.find((entry) => entry.id === selectedId);
    if (!workflow) return;
    setName(workflow.name);
    try {
      const parsed = JSON.parse(workflow.steps_json || "[]");
      setSteps(Array.isArray(parsed) ? parsed.map((step: Step) => ({ type: step.type, params: step.params ?? {} })) : []);
    } catch {
      setSteps([]);
    }
  }, [selectedId, workflows.data]);

  const updateStep = (index: number, patch: Partial<Step> | { param: string; value: unknown }) => {
    setSteps((current) => current.map((step, position) => {
      if (position !== index) return step;
      if ("param" in patch) return { ...step, params: { ...step.params, [patch.param]: patch.value } };
      return { ...step, ...patch };
    }));
  };

  const move = (index: number, delta: number) => {
    setSteps((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const save = async () => {
    if (!name.trim()) { toast("برای گردش کار نام بنویسید", "err"); return; }
    if (steps.length === 0) { toast("حداقل یک مرحله اضافه کنید", "err"); return; }
    setSaving(true);
    try {
      const payload = steps.map((step) => ({
        type: step.type,
        params: step.type === "generate" ? { ...step.params, project_id: projectId } : step.params,
      }));
      const result = await api.workflowSave({ id: selectedId ?? undefined, name: name.trim(), steps: payload });
      toast("گردش کار ذخیره شد", "ok");
      setSelectedId(result.id);
      workflows.refetch();
    } catch (error) { toast(errorText(error), "err"); } finally { setSaving(false); }
  };

  const run = async () => {
    if (!selectedId) { toast("قبل از اجرا، گردش کار را ذخیره کنید", "err"); return; }
    setRunning(true);
    setRunLog([]);
    setRunResult(null);
    setLogOpen(true);
    try {
      const result = await api.workflowRun(selectedId);
      setRunLog(Array.isArray(result.log) ? result.log : []);
      setRunResult({ status: String(result.status), images: Number(result.images ?? 0) });
      toast(`گردش کار: ${faLabel(result.status)} — ${result.images} تصویر ساخته شد`, result.status === "succeeded" ? "ok" : "err");
      workflows.refetch();
    } catch (error) {
      setRunLog([errorText(error)]);
      toast(errorText(error), "err");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="page fade-in">
      <PageHeader
        title="طراحی گردش کار"
        description="تولید تصویر و پردازش محلی را به هم وصل کنید. مرحله‌ها از بالا به پایین اجرا و تصویر به مرحله بعد داده می‌شود."
        actions={
          <>
            <Button icon="plus" onClick={() => { setSelectedId(null); setName(""); setSteps([{ type: "generate", params: { prompt: "", aspect: "4:5", count: 1 } }]); setRunLog([]); }}>گردش کار جدید</Button>
            <Button icon="save" loading={saving} onClick={() => void save()}>ذخیره</Button>
            <Button variant="primary" icon="play" loading={running} onClick={() => void run()}>اجرا</Button>
          </>
        }
      />

      <div className="grid split-left">
        <Card>
          <div className="section-title"><h2>گردش کارها</h2><span>{workflows.data?.length ?? 0}</span></div>
          {workflows.isLoading ? <Spinner label="در حال بارگذاری…" /> : null}
          <div className="list">
            {workflows.data?.map((workflow) => (
              <button key={workflow.id} className="wf-row" data-active={selectedId === workflow.id ? "true" : "false"} onClick={() => { setSelectedId(workflow.id); setRunLog([]); setRunResult(null); }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="small strong truncate">{workflow.name}</div>
                  <div className="tiny muted">
                    {workflow.last_run_at ? `آخرین اجرا ${formatDate(workflow.last_run_at)}` : "هنوز اجرا نشده"}
                    {workflow.last_status ? ` · ${faLabel(workflow.last_status)}` : ""}
                  </div>
                </div>
                <Badge tone={workflow.last_status === "succeeded" ? "ok" : workflow.last_status === "failed" ? "err" : "default"}>{faLabel(workflow.last_status || "draft")}</Badge>
              </button>
            ))}
            {workflows.data && workflows.data.length === 0 ? <div className="muted small">هنوز گردش کاری نیست. یکی بسازید.</div> : null}
          </div>
          {selectedId ? (
            <Button size="sm" variant="danger" icon="trash" style={{ marginTop: 10 }} onClick={async () => {
              try {
                await api.workflowDelete(selectedId);
                toast("گردش کار حذف شد", "ok");
                setSelectedId(null);
                setName("");
                setSteps([]);
                workflows.refetch();
              } catch (error) { toast(errorText(error), "err"); }
            }}>حذف گردش کار</Button>
          ) : null}
        </Card>

        <div className="stack">
          <Card>
            <div className="section-title"><h2>{selectedId ? "ویرایش گردش کار" : "گردش کار جدید"}</h2><Badge>{steps.length} مرحله</Badge></div>
            <div className="grid cols-2">
              <div className="field"><span className="field-label">نام</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="مراحل آماده‌سازی عکس محصول" /></div>
              <div className="field"><span className="field-label">پروژه پیش‌فرض مرحله‌های تولید</span>
                <Select value={projectId} onChange={(event) => setProjectId(event.target.value)}
                  options={[{ value: "", label: "بدون پروژه" }, ...(projects.data ?? []).map((project) => ({ value: project.id, label: project.name }))]} />
              </div>
            </div>

            <div className="stack" style={{ marginTop: 14 }}>
              {steps.map((step, index) => (
                <div className="wf-step" key={`${step.type}-${index}`}>
                  <div className="wf-step-head">
                    <span className="step-index">{index + 1}</span>
                    <Select
                      value={step.type}
                      onChange={(event) => updateStep(index, { type: event.target.value as StepType, params: event.target.value === "generate" ? { prompt: String(step.params.prompt ?? ""), aspect: "4:5", count: 1 } : event.target.value === "upscale" ? { scale: 2 } : event.target.value === "remove_background" ? { tolerance: 12 } : { format: "webp", quality: 90 } })}
                      options={(Object.keys(STEP_LABELS) as StepType[]).map((type) => ({ value: type, label: STEP_LABELS[type] }))}
                      aria-label="نوع مرحله"
                    />
                    <span className="spacer" />
                    <Button size="sm" variant="ghost" icon="chevronUp" onClick={() => move(index, -1)} aria-label="جابجایی به بالا" />
                    <Button size="sm" variant="ghost" icon="chevronDown" onClick={() => move(index, 1)} aria-label="جابجایی به پایین" />
                    <Button size="sm" variant="ghost" icon="trash" onClick={() => setSteps((current) => current.filter((_, position) => position !== index))} aria-label="حذف مرحله" />
                  </div>
                  <div className="tiny muted" style={{ margin: "6px 0" }}>{STEP_HELP[step.type]}</div>
                  {step.type === "generate" ? (
                    <div className="stack" style={{ gap: 8 }}>
                      <Textarea value={String(step.params.prompt ?? "")} onChange={(event) => updateStep(index, { param: "prompt", value: event.target.value })} placeholder="توضیح تصویر این مرحله" style={{ minHeight: 70 }} />
                      <div className="grid cols-3">
                        <Select value={String(step.params.aspect ?? "4:5")} onChange={(event) => updateStep(index, { param: "aspect", value: event.target.value })} aria-label="نسبت ابعاد"
                          options={["1:1", "4:5", "16:9", "9:16", "3:2"].map((value) => ({ value, label: value }))} />
                        <Select value={String(step.params.count ?? 1)} onChange={(event) => updateStep(index, { param: "count", value: Number(event.target.value) })} aria-label="تعداد"
                          options={[1, 2, 3, 4].map((value) => ({ value: String(value), label: `${value} تصویر` }))} />
                        <Input value={String(step.params.negative ?? "")} onChange={(event) => updateStep(index, { param: "negative", value: event.target.value })} placeholder="موارد ممنوعه" />
                      </div>
                    </div>
                  ) : null}
                  {step.type === "upscale" ? (
                    <div className="row" style={{ gap: 8 }}>
                      <span className="tiny muted">ضریب بزرگ‌نمایی</span>
                      {[1.5, 2, 3, 4].map((factor) => (
                        <button key={factor} className="preset-chip" data-active={Number(step.params.scale ?? 2) === factor ? "true" : "false"} onClick={() => updateStep(index, { param: "scale", value: factor })}>{factor}×</button>
                      ))}
                    </div>
                  ) : null}
                  {step.type === "remove_background" ? (
                    <div className="row" style={{ gap: 8 }}>
                      <span className="tiny muted">حساسیت حذف</span>
                      <Input type="number" value={String(step.params.tolerance ?? 12)} onChange={(event) => updateStep(index, { param: "tolerance", value: Number(event.target.value) })} style={{ width: 90 }} />
                      <span className="tiny dim">۲ تا ۴۰؛ عدد بالاتر طیف بیشتری از رنگ پس‌زمینه را حذف می‌کند</span>
                    </div>
                  ) : null}
                  {step.type === "convert" ? (
                    <div className="grid cols-2">
                      <Select value={String(step.params.format ?? "webp")} onChange={(event) => updateStep(index, { param: "format", value: event.target.value })} aria-label="فرمت"
                        options={[{ value: "webp", label: "WebP" }, { value: "png", label: "PNG" }, { value: "jpg", label: "JPEG" }]} />
                      <Select value={String(step.params.quality ?? 90)} onChange={(event) => updateStep(index, { param: "quality", value: Number(event.target.value) })} aria-label="کیفیت"
                        options={[60, 75, 85, 90, 95, 100].map((value) => ({ value: String(value), label: `کیفیت ${value}` }))} />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <Button icon="plus" variant="outline" style={{ marginTop: 12 }} onClick={() => setSteps((current) => [...current, { type: "upscale", params: { scale: 2 } }])}>افزودن مرحله</Button>
          </Card>

          {logOpen ? (
            <Card>
              <div className="section-title">
                <h2>گزارش اجرا</h2>
                {running ? <Spinner label="در حال اجرا…" /> : runResult ? <Badge tone={runResult.status === "succeeded" ? "ok" : "err"}>{faLabel(runResult.status)} · {runResult.images} تصویر</Badge> : null}
              </div>
              <div className="log-view" style={{ maxHeight: 260 }}>
                {runLog.length === 0 ? (running ? "در حال شروع…" : "هنوز خروجی ندارد.") : runLog.join("\n")}
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <Button size="sm" variant="ghost" onClick={() => setLogOpen(false)}>پنهان‌کردن</Button>
                <span className="spacer" />
                <span className="dim tiny">وضعیت و گزارش اجرای گردش کار در پایگاه داده ثبت می‌شود.</span>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
