import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Icon, Input, Select, Spinner, Slider, ToggleRow } from "@aria/ui";
import { api, errorText, type Settings } from "@aria/core";
import { QUALITY_PRESETS } from "@aria/prompt-engine";
import { useApp } from "../store";
import { PickerField, PageHeader } from "../components/shell";
import { useModels } from "../lib/hooks";

const REASONING = [
  { value: "", label: "Codex default" },
  { value: "minimal", label: "minimal" },
  { value: "low", label: "low" },
  { value: "medium", label: "medium" },
  { value: "high", label: "high" },
];

const VERBOSITY = [
  { value: "", label: "Codex default" },
  { value: "low", label: "low" },
  { value: "medium", label: "medium" },
  { value: "high", label: "high" },
];

export function ModelsPage() {
  const settings = useApp((state) => state.settings);
  const saveSettings = useApp((state) => state.saveSettings);
  const toast = useApp((state) => state.toast);
  const boot = useApp((state) => state.boot);
  const models = useModels();
  const [draft, setDraft] = useState<Settings>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(settings), [settings]);

  const dirty = useMemo(
    () => (Object.keys(draft) as (keyof Settings)[]).some((key) => draft[key] !== settings[key]),
    [draft, settings],
  );

  const patch = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings(draft);
      toast("Engine settings saved", "ok");
    } catch (error) {
      toast(errorText(error), "err");
    } finally {
      setSaving(false);
    }
  };

  const modelOptions = [
    { value: "", label: "Codex default model" },
    ...(models.data?.models ?? []).map((model) => ({ value: model.id, label: model.label && model.label !== model.id ? `${model.label} · ${model.id}` : model.id })),
  ];

  return (
    <div className="page fade-in">
      <PageHeader
        title="Model & Engine Settings"
        description="Only options Codex actually exposes are offered. There is no fake quality slider that pretends to change the image model."
        actions={
          <>
            <Button icon="refresh" onClick={() => { setDraft(settings); models.refetch(); }}>Reset</Button>
            <Button variant="primary" icon="save" loading={saving} disabled={!dirty} onClick={() => void save()}>Save settings</Button>
          </>
        }
      />

      <div className="grid split">
        <div className="stack">
          <Card>
            <div className="section-title"><h2>Model selection</h2>{dirty ? <Badge tone="warn">unsaved</Badge> : <Badge tone="ok">saved</Badge>}</div>
            <div className="field">
              <span className="field-label">Text / agent model</span>
              <Select value={draft.codex_model} onChange={(event) => patch("codex_model", event.target.value)} options={modelOptions} />
              <div className="field-hint">
                The dropdown lists models found in the local Codex cache. If your model is missing, type its id below — ARIA passes
                <span className="mono"> -m &lt;id&gt;</span> to Codex verbatim.
              </div>
            </div>
            <div className="field" style={{ marginTop: 8 }}>
              <span className="field-label">Custom model id (optional)</span>
              <Input value={draft.codex_model} onChange={(event) => patch("codex_model", event.target.value)} placeholder="e.g. gpt-5-codex" />
            </div>
            <div className="banner info" style={{ marginTop: 12 }}>
              <Icon name="image" size={14} />
              <div>
                <div className="strong small">Image model: Managed by Codex</div>
                <div className="tiny">The built-in image_gen tool chooses its own image model. It cannot be selected, sized or seeded from a wrapper — so ARIA shows it as managed rather than inventing options.</div>
              </div>
            </div>
            <div className="row wrap" style={{ marginTop: 10 }}>
              <Badge>{models.data?.source ?? "cache"}</Badge>
              <span className="dim tiny">{models.data?.detail}</span>
            </div>
          </Card>

          <Card>
            <div className="section-title"><h2>Execution</h2></div>
            <div className="grid cols-2">
              <div className="field">
                <span className="field-label">Reasoning effort</span>
                <Select value={draft.reasoning_effort} onChange={(event) => patch("reasoning_effort", event.target.value)} options={REASONING} />
              </div>
              <div className="field">
                <span className="field-label">Verbosity</span>
                <Select value={draft.verbosity} onChange={(event) => patch("verbosity", event.target.value)} options={VERBOSITY} />
              </div>
              <div className="field">
                <span className="field-label">Approval policy</span>
                <Select value={draft.approval_policy} onChange={(event) => patch("approval_policy", event.target.value)}
                  options={[{ value: "on-request", label: "on-request (recommended)" }, { value: "on-failure", label: "on-failure" }, { value: "untrusted", label: "untrusted" }, { value: "never", label: "never" }]} />
              </div>
              <div className="field">
                <span className="field-label">Sandbox mode</span>
                <Select value={draft.sandbox_mode} onChange={(event) => patch("sandbox_mode", event.target.value)}
                  options={[{ value: "workspace-write", label: "workspace-write (recommended)" }, { value: "read-only", label: "read-only" }, { value: "danger-full-access", label: "danger-full-access" }]} />
              </div>
            </div>
            {draft.sandbox_mode === "danger-full-access" ? (
              <div className="banner warn" style={{ marginTop: 10 }}>
                <Icon name="alert" size={14} />
                <span className="tiny">Full access lets Codex write outside the project folder. Only use it if you understand the risk.</span>
              </div>
            ) : null}
            <div className="grid cols-2" style={{ marginTop: 12 }}>
              <Slider label="Generation timeout (seconds)" value={draft.generation_timeout_secs} min={60} max={3600} step={30} onChange={(value) => patch("generation_timeout_secs", value)} />
              <Slider label="Max concurrent jobs" value={draft.max_concurrent_jobs} min={1} max={4} onChange={(value) => patch("max_concurrent_jobs", value)} />
            </div>
            <ToggleRow label="Network access inside the sandbox" description="Codex needs network access for the model call itself; leave this off unless a tool genuinely requires outbound traffic." checked={draft.network_access} onChange={(value) => patch("network_access", value)} />
          </Card>

          <Card>
            <div className="section-title"><h2>Output behaviour</h2></div>
            <div className="field">
              <span className="field-label">Default quality preset</span>
              <Select value={draft.quality_preset} onChange={(event) => patch("quality_preset", event.target.value)} options={QUALITY_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))} />
              <div className="field-hint">Presets are prompt directives (lighting, lens, finish), not hidden model parameters.</div>
            </div>
            <div className="grid cols-2" style={{ marginTop: 12 }}>
              <Slider label="Preview quality" value={draft.preview_quality} min={40} max={100} onChange={(value) => patch("preview_quality", value)} />
              <Slider label="Thumbnail size (px)" value={draft.thumbnail_size} min={160} max={720} step={20} onChange={(value) => patch("thumbnail_size", value)} />
            </div>
            <div style={{ marginTop: 10 }}>
              <ToggleRow label="Keep original files" description="Post-processing writes a new file and leaves the source untouched." checked={draft.keep_original} onChange={(value) => patch("keep_original", value)} />
              <ToggleRow label="Auto post-process after generation" description="Applies the default transform chain automatically. Off by default so results stay predictable." checked={draft.auto_post_process} onChange={(value) => patch("auto_post_process", value)} />
              <ToggleRow label="Enable GIF output" description="Codex may return animated GIFs for some prompts; keeping this on preserves them instead of converting to PNG." checked={draft.enable_gif} onChange={(value) => patch("enable_gif", value)} />
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <div className="section-title"><h2>Binary</h2></div>
            <div className="field">
              <span className="field-label">Codex CLI path override</span>
              <PickerField label="" mode="file" value={draft.codex_path} onChange={(value) => patch("codex_path", value)} placeholder="Auto-detected" />
              <div className="field-hint">Leave empty to auto-detect from PATH, npm global, WinGet and %USERPROFILE%\\.codex.</div>
            </div>
            <div className="grid cols-2" style={{ marginTop: 10 }}>
              <div>
                <div className="tiny muted">Detected</div>
                <div className="mono-path">{boot?.codex.path || "not found"}</div>
              </div>
              <div>
                <div className="tiny muted">Version</div>
                <div className="small">{boot?.codex.version || "—"}</div>
              </div>
            </div>
            <Button size="sm" icon="external" style={{ marginTop: 10 }} onClick={() => void api.openUrl("https://developers.openai.com/codex/cli").catch(() => undefined)}>Installation docs</Button>
          </Card>

          <Card>
            <div className="section-title"><h2>Effective command</h2></div>
            <div className="mono-path" style={{ whiteSpace: "pre-wrap" }}>
              {`codex exec --json --skip-git-repo-check\n  -C <work dir>\n  ${draft.codex_model ? `-m ${draft.codex_model}` : "[-m default]"}\n  -s ${draft.sandbox_mode}\n  ${draft.approval_policy ? `--ask-for-approval ${draft.approval_policy}` : ""}\n  ${draft.reasoning_effort ? `-c model_reasoning_effort="${draft.reasoning_effort}"` : ""}\n  ${draft.verbosity ? `-c model_verbosity="${draft.verbosity}"` : ""}\n  -- "<engine instruction + prompt>"`}
            </div>
            <div className="tiny dim" style={{ marginTop: 8 }}>
              CODEX_HOME is set to the ARIA profile folder for every call.
            </div>
          </Card>

          <Card>
            <div className="section-title"><h2>Environment</h2></div>
            {models.isLoading ? <Spinner label="Reading models cache…" /> : null}
            <div className="list">
              <div className="list-row"><Icon name="cpu" size={13} /><span className="small" style={{ flex: 1 }}>Cached models</span><Badge>{models.data?.models.length ?? 0}</Badge></div>
              <div className="list-row"><Icon name="image" size={13} /><span className="small" style={{ flex: 1 }}>Image tool</span><Badge tone="accent">image_gen</Badge></div>
              <div className="list-row"><Icon name="key" size={13} /><span className="small" style={{ flex: 1 }}>API key required</span><Badge tone="ok">no</Badge></div>
            </div>
          </Card>
        </div>
      </div>

      {dirty ? (
        <div className="banner" style={{ position: "sticky", bottom: 12, marginTop: 16 }}>
          <Icon name="alert" size={14} />
          <span className="small" style={{ flex: 1 }}>You have unsaved engine settings.</span>
          <Button size="sm" variant="ghost" onClick={() => setDraft(settings)}>Discard</Button>
          <Button size="sm" variant="primary" loading={saving} onClick={() => void save()}>Save</Button>
        </div>
      ) : null}
    </div>
  );
}
