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
  generate: "Generate image",
  upscale: "Upscale (Lanczos)",
  remove_background: "Remove background",
  convert: "Convert format",
};

const STEP_HELP: Record<StepType, string> = {
  generate: "Runs one engine call. Later steps operate on the first output image.",
  upscale: "Local resampling with sharpening — not AI super-resolution.",
  remove_background: "Chroma-key cutout to a transparent PNG; works best on flat backdrops.",
  convert: "Re-encodes the current image into another format with a quality setting.",
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
    if (!name.trim()) { toast("Name the workflow", "err"); return; }
    if (steps.length === 0) { toast("Add at least one step", "err"); return; }
    setSaving(true);
    try {
      const payload = steps.map((step) => ({
        type: step.type,
        params: step.type === "generate" ? { ...step.params, project_id: projectId } : step.params,
      }));
      const result = await api.workflowSave({ id: selectedId ?? undefined, name: name.trim(), steps: payload });
      toast("Workflow saved", "ok");
      setSelectedId(result.id);
      workflows.refetch();
    } catch (error) { toast(errorText(error), "err"); } finally { setSaving(false); }
  };

  const run = async () => {
    if (!selectedId) { toast("Save the workflow before running it", "err"); return; }
    setRunning(true);
    setRunLog([]);
    setRunResult(null);
    setLogOpen(true);
    try {
      const result = await api.workflowRun(selectedId);
      setRunLog(Array.isArray(result.log) ? result.log : []);
      setRunResult({ status: String(result.status), images: Number(result.images ?? 0) });
      toast(`Workflow ${result.status} — ${result.images} image(s) produced`, result.status === "succeeded" ? "ok" : "err");
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
        title="Workflow Builder"
        description="Chain generation with local post-processing. Steps run top to bottom and pass the current image forward."
        actions={
          <>
            <Button icon="plus" onClick={() => { setSelectedId(null); setName(""); setSteps([{ type: "generate", params: { prompt: "", aspect: "4:5", count: 1 } }]); setRunLog([]); }}>New workflow</Button>
            <Button icon="save" loading={saving} onClick={() => void save()}>Save</Button>
            <Button variant="primary" icon="play" loading={running} onClick={() => void run()}>Run</Button>
          </>
        }
      />

      <div className="grid split-left">
        <Card>
          <div className="section-title"><h2>Workflows</h2><span>{workflows.data?.length ?? 0}</span></div>
          {workflows.isLoading ? <Spinner label="Loading…" /> : null}
          <div className="list">
            {workflows.data?.map((workflow) => (
              <button key={workflow.id} className="wf-row" data-active={selectedId === workflow.id ? "true" : "false"} onClick={() => { setSelectedId(workflow.id); setRunLog([]); setRunResult(null); }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="small strong truncate">{workflow.name}</div>
                  <div className="tiny muted">
                    {workflow.last_run_at ? `last run ${formatDate(workflow.last_run_at)}` : "never run"}
                    {workflow.last_status ? ` · ${workflow.last_status}` : ""}
                  </div>
                </div>
                <Badge tone={workflow.last_status === "succeeded" ? "ok" : workflow.last_status === "failed" ? "err" : "default"}>{workflow.last_status || "draft"}</Badge>
              </button>
            ))}
            {workflows.data && workflows.data.length === 0 ? <div className="muted small">No workflows yet. Build one on the right.</div> : null}
          </div>
          {selectedId ? (
            <Button size="sm" variant="danger" icon="trash" style={{ marginTop: 10 }} onClick={async () => {
              try {
                await api.workflowDelete(selectedId);
                toast("Workflow deleted", "ok");
                setSelectedId(null);
                setName("");
                setSteps([]);
                workflows.refetch();
              } catch (error) { toast(errorText(error), "err"); }
            }}>Delete workflow</Button>
          ) : null}
        </Card>

        <div className="stack">
          <Card>
            <div className="section-title"><h2>{selectedId ? "Edit workflow" : "New workflow"}</h2><Badge>{steps.length} step(s)</Badge></div>
            <div className="grid cols-2">
              <div className="field"><span className="field-label">Name</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Product shot pipeline" /></div>
              <div className="field"><span className="field-label">Default project for generate steps</span>
                <Select value={projectId} onChange={(event) => setProjectId(event.target.value)}
                  options={[{ value: "", label: "No project" }, ...(projects.data ?? []).map((project) => ({ value: project.id, label: project.name }))]} />
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
                      aria-label="Step type"
                    />
                    <span className="spacer" />
                    <Button size="sm" variant="ghost" icon="chevronUp" onClick={() => move(index, -1)} aria-label="Move up" />
                    <Button size="sm" variant="ghost" icon="chevronDown" onClick={() => move(index, 1)} aria-label="Move down" />
                    <Button size="sm" variant="ghost" icon="trash" onClick={() => setSteps((current) => current.filter((_, position) => position !== index))} aria-label="Remove step" />
                  </div>
                  <div className="tiny muted" style={{ margin: "6px 0" }}>{STEP_HELP[step.type]}</div>
                  {step.type === "generate" ? (
                    <div className="stack" style={{ gap: 8 }}>
                      <Textarea value={String(step.params.prompt ?? "")} onChange={(event) => updateStep(index, { param: "prompt", value: event.target.value })} placeholder="Prompt for this generation step" style={{ minHeight: 70 }} />
                      <div className="grid cols-3">
                        <Select value={String(step.params.aspect ?? "4:5")} onChange={(event) => updateStep(index, { param: "aspect", value: event.target.value })} aria-label="Aspect"
                          options={["1:1", "4:5", "16:9", "9:16", "3:2"].map((value) => ({ value, label: value }))} />
                        <Select value={String(step.params.count ?? 1)} onChange={(event) => updateStep(index, { param: "count", value: Number(event.target.value) })} aria-label="Count"
                          options={[1, 2, 3, 4].map((value) => ({ value: String(value), label: `${value} image(s)` }))} />
                        <Input value={String(step.params.negative ?? "")} onChange={(event) => updateStep(index, { param: "negative", value: event.target.value })} placeholder="negative" />
                      </div>
                    </div>
                  ) : null}
                  {step.type === "upscale" ? (
                    <div className="row" style={{ gap: 8 }}>
                      <span className="tiny muted">Factor</span>
                      {[1.5, 2, 3, 4].map((factor) => (
                        <button key={factor} className="preset-chip" data-active={Number(step.params.scale ?? 2) === factor ? "true" : "false"} onClick={() => updateStep(index, { param: "scale", value: factor })}>{factor}×</button>
                      ))}
                    </div>
                  ) : null}
                  {step.type === "remove_background" ? (
                    <div className="row" style={{ gap: 8 }}>
                      <span className="tiny muted">Tolerance</span>
                      <Input type="number" value={String(step.params.tolerance ?? 12)} onChange={(event) => updateStep(index, { param: "tolerance", value: Number(event.target.value) })} style={{ width: 90 }} />
                      <span className="tiny dim">2–40; higher removes more shades around the key colour</span>
                    </div>
                  ) : null}
                  {step.type === "convert" ? (
                    <div className="grid cols-2">
                      <Select value={String(step.params.format ?? "webp")} onChange={(event) => updateStep(index, { param: "format", value: event.target.value })} aria-label="Format"
                        options={[{ value: "webp", label: "WebP" }, { value: "png", label: "PNG" }, { value: "jpg", label: "JPEG" }]} />
                      <Select value={String(step.params.quality ?? 90)} onChange={(event) => updateStep(index, { param: "quality", value: Number(event.target.value) })} aria-label="Quality"
                        options={[60, 75, 85, 90, 95, 100].map((value) => ({ value: String(value), label: `quality ${value}` }))} />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <Button icon="plus" variant="outline" style={{ marginTop: 12 }} onClick={() => setSteps((current) => [...current, { type: "upscale", params: { scale: 2 } }])}>Add step</Button>
          </Card>

          {logOpen ? (
            <Card>
              <div className="section-title">
                <h2>Run log</h2>
                {running ? <Spinner label="Running…" /> : runResult ? <Badge tone={runResult.status === "succeeded" ? "ok" : "err"}>{runResult.status} · {runResult.images} image(s)</Badge> : null}
              </div>
              <div className="log-view" style={{ maxHeight: 260 }}>
                {runLog.length === 0 ? (running ? "Starting…" : "No output yet.") : runLog.join("\n")}
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <Button size="sm" variant="ghost" onClick={() => setLogOpen(false)}>Hide</Button>
                <span className="spacer" />
                <span className="dim tiny">Workflow runs are recorded with status and log in the database.</span>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
