import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, CodeBlock, Icon, Input, Select, Spinner, Textarea } from "@aria/ui";
import { api, errorText, formatDate } from "@aria/core";
import {
  NEGATIVE_DEFAULTS,
  PROMPT_TEMPLATES,
  QUALITY_PRESETS,
  analyzePrompt,
  applyTemplate,
  buildPrompt,
  detectLanguage,
  templateVariables,
} from "@aria/prompt-engine";
import { useApp } from "../store";
import { usePrompts } from "../lib/hooks";
import { PageHeader } from "../components/shell";

export function PromptStudioPage() {
  const toast = useApp((state) => state.toast);
  const setRoute = useApp((state) => state.setRoute);
  const setHandoff = useApp((state) => state.setHandoff);
  const prompts = usePrompts();

  const [raw, setRaw] = useState("");
  const [templateId, setTemplateId] = useState(PROMPT_TEMPLATES[0]?.id ?? "");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [presetId, setPresetId] = useState("aria-best-quality");
  const [negative, setNegative] = useState(NEGATIVE_DEFAULTS.join(", "));
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [refining, setRefining] = useState(false);
  const [versionFor, setVersionFor] = useState<string | null>(null);
  const [versions, setVersions] = useState<{ id: string; body: string; note: string; created_at: string }[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  const template = useMemo(() => PROMPT_TEMPLATES.find((entry) => entry.id === templateId), [templateId]);
  const fields = useMemo(() => (template ? templateVariables(template.body) : []), [template]);

  useEffect(() => {
    if (!template) return;
    setVariables((current) => {
      const next: Record<string, string> = {};
      for (const field of templateVariables(template.body)) next[field] = current[field] ?? "";
      return next;
    });
  }, [template]);

  const templated = useMemo(
    () => (template ? applyTemplate(template.body, variables) : ""),
    [template, variables],
  );

  const analysis = useMemo(() => analyzePrompt(templated || raw, negative), [templated, raw, negative]);
  const language = useMemo(() => detectLanguage(raw || templated), [raw, templated]);

  const composed = useMemo(
    () => buildPrompt({ raw: templated || raw, presetId, negative, aspect: "4:5" }),
    [templated, raw, presetId, negative],
  );

  const loadVersions = async (promptId: string) => {
    setVersionFor(promptId);
    setVersionsLoading(true);
    try {
      setVersions(await api.promptVersions(promptId));
    } catch (error) {
      toast(errorText(error), "err");
    } finally {
      setVersionsLoading(false);
    }
  };

  const save = async () => {
    const body = templated || raw;
    if (!body.trim()) {
      toast("Write or template a prompt first", "err");
      return;
    }
    setSaving(true);
    try {
      await api.promptSave({ title: title.trim() || body.slice(0, 56), body, negative, category: templateId || "custom", tags: [presetId, language], project_id: "" });
      toast("Prompt saved with a version snapshot", "ok");
      setTitle("");
      prompts.refetch();
    } catch (error) {
      toast(errorText(error), "err");
    } finally {
      setSaving(false);
    }
  };

  const refine = async () => {
    const body = templated || raw;
    if (!body.trim()) return;
    setRefining(true);
    try {
      const result = await api.codexComplete(
        `Rewrite this image prompt so it is production ready. Keep the language (${language}) and every concrete detail. ` +
        `Return only the improved prompt.\n\n${body}`,
      );
      setRaw(result.text.trim());
      setTemplateId("");
      toast("Rewritten with Codex — the template is now free text", "ok");
    } catch (error) {
      toast(errorText(error), "err");
    } finally {
      setRefining(false);
    }
  };

  return (
    <div className="page fade-in">
      <PageHeader
        title="Prompt Studio"
        description="Templates, variables, scoring and versioning. Everything here is deterministic text processing plus optional Codex rewriting — no hidden model calls."
        actions={
          <>
            <Button icon="refresh" loading={refining} onClick={() => void refine()}>Rewrite with Codex</Button>
            <Button icon="library" loading={saving} onClick={() => void save()}>Save prompt</Button>
            <Button variant="primary" icon="sparkles" onClick={() => { setHandoff({ prompt: templated || raw, negative, presetId }); setRoute("create"); }}>Send to Create</Button>
          </>
        }
      />

      <div className="grid split">
        <div className="stack">
          <Card>
            <div className="section-title"><h2>Template</h2><Badge>{language.toUpperCase()}</Badge></div>
            <div className="grid cols-2">
              <Select
                value={templateId}
                onChange={(event) => setTemplateId(event.target.value)}
                aria-label="Template"
                options={[{ value: "", label: "Free text" }, ...PROMPT_TEMPLATES.map((entry) => ({ value: entry.id, label: entry.title }))]}
              />
              <Select
                value={presetId}
                onChange={(event) => setPresetId(event.target.value)}
                aria-label="Quality preset"
                options={QUALITY_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))}
              />
            </div>
            {template ? <p className="muted tiny" style={{ margin: "8px 0 0" }}>{template.category} template · {template.titleFa}</p> : null}

            {fields.length > 0 ? (
              <div className="grid cols-2" style={{ marginTop: 12 }}>
                {fields.map((field) => (
                  <div className="field" key={field}>
                    <span className="field-label">{field.replace(/_/g, " ")}</span>
                    <Input
                      value={variables[field] ?? ""}
                      onChange={(event) => setVariables((current) => ({ ...current, [field]: event.target.value }))}
                      placeholder={field === "subject" ? "what the image is about" : ""}
                    />
                  </div>
                ))}
              </div>
            ) : null}

            <div className="field" style={{ marginTop: 12 }}>
              <span className="field-label">{template ? "Composed text (editable)" : "Prompt"}</span>
              <Textarea
                value={templated || raw}
                onChange={(event) => { setTemplateId(""); setRaw(event.target.value); }}
                placeholder="Write the prompt, or pick a template and fill its variables"
                style={{ minHeight: 130 }}
              />
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <span className="field-label">Negative constraints</span>
              <Input value={negative} onChange={(event) => setNegative(event.target.value)} />
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <span className="field-label">Save as</span>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Descriptive title for the library" />
            </div>
          </Card>

          <Card>
            <div className="section-title"><h2>Structured result</h2><span>{composed.structured.length} chars</span></div>
            <CodeBlock text={composed.structured} maxHeight={280} />
            <div className="row wrap" style={{ marginTop: 10 }}>
              <Button size="sm" icon="copy" onClick={async () => {
                try { await navigator.clipboard.writeText(composed.structured); toast("Structured prompt copied", "ok"); }
                catch { toast("Clipboard is unavailable", "err"); }
              }}>Copy</Button>
              <Button size="sm" variant="ghost" icon="library" onClick={() => setRoute("prompt-library")}>Open library</Button>
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <div className="row between" style={{ marginBottom: 8 }}>
              <h2 style={{ fontSize: 14 }}>Analysis</h2>
              <Badge tone={analysis.score >= 75 ? "ok" : analysis.score >= 45 ? "warn" : "err"}>{analysis.score}/100</Badge>
            </div>
            <div className="split-progress"><div style={{ width: `${analysis.score}%` }} /></div>
            <div className="stats-mini" style={{ marginTop: 10 }}>
              <div><span>Words</span><strong>{analysis.words}</strong></div>
              <div><span>Subject</span><strong>{analysis.hasSubject ? "yes" : "no"}</strong></div>
              <div><span>Negatives</span><strong>{analysis.hasNegative ? "yes" : "no"}</strong></div>
            </div>
            <ul className="muted tiny" style={{ margin: "10px 0 0", paddingInlineStart: 16, lineHeight: 1.8 }}>
              {analysis.tips.map((tip) => <li key={tip}>{tip}</li>)}
              {analysis.tips.length === 0 ? <li>The prompt covers the essentials.</li> : null}
            </ul>
          </Card>

          <Card>
            <div className="section-title"><h2>Version history</h2><span>{versions.length}</span></div>
            {!versionFor ? <div className="muted small">Pick a saved prompt on the right to inspect its versions.</div> : versionsLoading ? <Spinner label="Loading versions…" /> : versions.length === 0 ? <div className="muted small">No versions recorded.</div> : (
              <div className="list">
                {versions.map((version, index) => (
                  <div className="list-row" key={version.id} style={{ alignItems: "flex-start" }}>
                    <Badge>v{versions.length - index}</Badge>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="tiny muted">{formatDate(version.created_at)} · {version.note || "snapshot"}</div>
                      <div className="mono tiny truncate">{version.body.slice(0, 90)}</div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => { setRaw(version.body); setTemplateId(""); toast("Version loaded into the editor", "info"); }}>Load</Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="section-title"><h2>Saved prompts</h2><span>{prompts.data?.length ?? 0}</span></div>
            {prompts.isLoading ? <Spinner label="Loading…" /> : null}
            <div className="list" style={{ maxHeight: 320, overflow: "auto" }}>
              {prompts.data?.slice(0, 20).map((prompt) => (
                <div className="list-row" key={prompt.id} style={{ alignItems: "flex-start" }}>
                  <span style={{ color: prompt.favorite ? "var(--warn)" : "var(--dim)" }}><Icon name="star" size={12} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="small truncate">{prompt.title}</div>
                    <div className="tiny muted truncate">{prompt.body.slice(0, 70)}</div>
                  </div>
                  <div className="row" style={{ gap: 4 }}>
                    <Button size="sm" variant="ghost" onClick={() => { setRaw(prompt.body); setNegative(prompt.negative); setTemplateId(""); setVersionFor(prompt.id); void loadVersions(prompt.id); }}>Load</Button>
                  </div>
                </div>
              ))}
              {prompts.data && prompts.data.length === 0 ? <div className="muted small">Nothing saved yet.</div> : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
