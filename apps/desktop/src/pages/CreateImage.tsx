import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CodeBlock,
  EmptyState,
  FilePickerModal,
  Icon,
  Input,
  Lightbox,
  Select,
  Spinner,
  Textarea,
  useHotkeys,
} from "@aria/ui";
import { api, errorText, formatDuration, onEvent, toFileUrl, type ImageRecord } from "@aria/core";
import {
  ASPECT_PRESETS,
  CAMERA_PRESETS,
  COMPOSITION_PRESETS,
  LIGHTING_PRESETS,
  QUALITY_PRESETS,
  STYLE_PRESETS,
  analyzePrompt,
  buildPrompt,
  refinementInstruction,
  translationInstruction,
} from "@aria/prompt-engine";
import { useApp } from "../store";
import { useAction, useGallery, useProjects, useReferences } from "../lib/hooks";
import { PageHeader } from "../components/shell";

export function CreatePage() {
  const settings = useApp((state) => state.settings);
  const handoff = useApp((state) => state.handoff);
  const setHandoff = useApp((state) => state.setHandoff);
  const toast = useApp((state) => state.toast);
  const projects = useProjects();
  const references = useReferences(settings.active_project_id);

  const [raw, setRaw] = useState(handoff.prompt ?? "");
  const [presetId, setPresetId] = useState(handoff.presetId ?? settings.quality_preset ?? "aria-best-quality");
  const [styleId, setStyleId] = useState("");
  const [lightingId, setLightingId] = useState("");
  const [cameraId, setCameraId] = useState("");
  const [compositionId, setCompositionId] = useState("");
  const [aspect, setAspect] = useState(handoff.aspect ?? "4:5");
  const [negative, setNegative] = useState(handoff.negative ?? "");
  const [count, setCount] = useState(1);
  const [projectId, setProjectId] = useState(settings.active_project_id);
  const [outputDir, setOutputDir] = useState("");
  const [selectedRefs, setSelectedRefs] = useState<string[]>([]);
  const [edited, setEdited] = useState<string | null>(null);
  const [view, setView] = useState<"structured" | "compact" | "original">("structured");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [results, setResults] = useState<ImageRecord[]>([]);
  const [lastOutcome, setLastOutcome] = useState<{ status: string; duration_ms: number; error: string; exit: number | null } | null>(null);
  const [lightbox, setLightbox] = useState<ImageRecord | null>(null);
  const [addRefPath, setAddRefPath] = useState("");
  const [refPickerOpen, setRefPickerOpen] = useState(false);
  const [translateBusy, setTranslateBusy] = useState(false);
  const [refineBusy, setRefineBusy] = useState(false);
  const recent = useGallery({ limit: 6, sort: "newest" });

  const built = useMemo(
    () =>
      buildPrompt({
        raw,
        presetId,
        styleId: styleId || undefined,
        lightingId: lightingId || undefined,
        cameraId: cameraId || undefined,
        compositionId: compositionId || undefined,
        aspect,
        negative,
        referenceRoles: selectedRefs.map(() => "style and subject reference"),
        intendedUse: "ARIA Image Studio deliverable",
      }),
    [raw, presetId, styleId, lightingId, cameraId, compositionId, aspect, negative, selectedRefs],
  );

  useEffect(() => {
    setEdited(null);
  }, [built.structured, built.compact]);

  const analysis = useMemo(() => analyzePrompt(raw, negative, aspect), [raw, negative, aspect]);
  const finalPrompt = edited ?? (view === "compact" ? built.compact : built.structured);
  const activeProject = projects.data?.find((project) => project.id === projectId);

  const buildRequest = useCallback(() => ({
    project_id: projectId,
    profile_id: settings.active_profile_id,
    prompt_original: raw,
    prompt_final: finalPrompt,
    negative,
    aspect,
    style_notes: [styleId, lightingId, cameraId, compositionId].filter(Boolean).join(", "),
    count,
    reference_images: selectedRefs,
    output_dir: outputDir,
    model: settings.codex_model,
    reasoning_effort: settings.reasoning_effort,
    verbosity: settings.verbosity,
    sandbox_mode: settings.sandbox_mode,
    timeout_secs: settings.generation_timeout_secs,
    quality_preset: presetId,
  }), [projectId, settings, raw, finalPrompt, negative, aspect, styleId, lightingId, cameraId, compositionId, count, selectedRefs, outputDir, presetId]);

  const generate = useCallback(async () => {
    if (running) return;
    if (!raw.trim()) {
      toast("Describe the image first", "err");
      return;
    }
    setRunning(true);
    setLog([]);
    setResults([]);
    setLastOutcome(null);
    let unlisten: (() => void) | undefined;
    try {
      unlisten = await onEvent<{ text: string }>("aria://generation-line", (payload) => {
        setLog((lines) => [...lines, payload.text].slice(-400));
      });
      const outcome = await api.generateNow(buildRequest());
      setResults(outcome.images);
      setLastOutcome({ status: outcome.status, duration_ms: outcome.duration_ms, error: outcome.error, exit: outcome.codex_exit });
      if (outcome.images.length > 0) {
        toast(`${outcome.images.length} image(s) created in ${formatDuration(outcome.duration_ms)}`, "ok");
        void recent.refetch();
      } else {
        toast(outcome.error || "The engine returned no image", "err");
      }
    } catch (error) {
      toast(errorText(error), "err");
    } finally {
      unlisten?.();
      setRunning(false);
    }
  }, [running, raw, toast, buildRequest, recent]);

  const enqueue = useAction(() => api.generateQueue(buildRequest()), { success: "Added to the generation queue" });

  const savePrompt = useAction(
    () => api.promptSave({ title: raw.slice(0, 60) || "Untitled prompt", body: finalPrompt, negative, category: presetId, tags: [presetId], project_id: projectId }),
    { success: "Prompt saved to the library" },
  );

  const translate = async () => {
    setTranslateBusy(true);
    try {
      const result = await api.codexComplete(translationInstruction(raw));
      setRaw(result.text.trim());
      toast("Prompt translated by Codex", "ok");
    } catch (error) {
      toast(errorText(error), "err");
    } finally {
      setTranslateBusy(false);
    }
  };

  const refine = async () => {
    setRefineBusy(true);
    try {
      const result = await api.codexComplete(refinementInstruction(raw, "en"));
      setEdited(result.text.trim());
      setView("structured");
      toast("Prompt rewritten by Codex — review it before generating", "ok");
    } catch (error) {
      toast(errorText(error), "err");
    } finally {
      setRefineBusy(false);
    }
  };

  useHotkeys({
    "mod+enter": () => void generate(),
    "mod+s": () => { if (!savePrompt.isPending) savePrompt.mutate([]); },
  });

  useEffect(() => {
    if (handoff.prompt) setHandoff({});
  }, [handoff.prompt, setHandoff]);

  const scoreTone = analysis.score >= 75 ? "ok" : analysis.score >= 45 ? "warn" : "err";

  return (
    <div className="page fade-in">
      <PageHeader
        title="Create Image"
        description="Describe the image in Persian or English. Prompt Intelligence structures it into production language; the built-in Codex image tool does the generation."
        actions={
          <>
            <Button icon="library" loading={savePrompt.isPending} onClick={() => savePrompt.mutate([])}>Save prompt</Button>
            <Button icon="grid" onClick={() => enqueue.mutate([])} loading={enqueue.isPending}>Add to queue</Button>
            <Button variant="primary" icon="sparkles" loading={running} onClick={() => void generate()}>Generate</Button>
          </>
        }
      />

      <div className="prompt-shell">
        <div className="stack">
          <Card>
            <div className="row between" style={{ marginBottom: 8 }}>
              <span className="field-label" style={{ margin: 0 }}>Prompt</span>
              <div className="row" style={{ gap: 6 }}>
                <Badge tone={analysis.language === "fa" ? "info" : "default"}>{analysis.language.toUpperCase()}</Badge>
                <Badge>{analysis.words} words</Badge>
              </div>
            </div>
            <Textarea
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
              placeholder="مثال: یک عکس تبلیغاتی لوکس برای عطر مشکی روی سنگ مرمر، نور نرم از سمت چپ، فضای خالی برای نوشته"
              style={{ minHeight: 120, fontSize: 14 }}
            />
            <div className="row wrap" style={{ marginTop: 10 }}>
              <Button size="sm" icon="zap" loading={refineBusy} onClick={() => void refine()} disabled={!raw.trim()}>Refine with Codex</Button>
              <Button size="sm" icon="refresh" loading={translateBusy} onClick={() => void translate()} disabled={!raw.trim() || built.language === "en"}>
                Translate to English
              </Button>
              <Button size="sm" variant="ghost" icon="close" onClick={() => { setRaw(""); setEdited(null); }}>Clear</Button>
              <span className="spacer" />
              <span className="dim tiny">Ctrl+Enter to generate</span>
            </div>
          </Card>

          <Card>
            <div className="section-title"><h2>Quality preset</h2><span>Prompt directives, not fake model settings</span></div>
            <div className="preset-chips">
              {QUALITY_PRESETS.map((preset) => (
                <button key={preset.id} className="preset-chip" data-active={presetId === preset.id ? "true" : "false"} onClick={() => setPresetId(preset.id)} title={preset.directive}>
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="grid cols-4" style={{ marginTop: 14 }}>
              <Select
                value={styleId}
                onChange={(event) => setStyleId(event.target.value)}
                aria-label="Style"
                options={[{ value: "", label: "Style · none" }, ...STYLE_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))]}
              />
              <Select
                value={lightingId}
                onChange={(event) => setLightingId(event.target.value)}
                aria-label="Lighting"
                options={[{ value: "", label: "Lighting · none" }, ...LIGHTING_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))]}
              />
              <Select
                value={cameraId}
                onChange={(event) => setCameraId(event.target.value)}
                aria-label="Camera"
                options={[{ value: "", label: "Camera · none" }, ...CAMERA_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))]}
              />
              <Select
                value={compositionId}
                onChange={(event) => setCompositionId(event.target.value)}
                aria-label="Composition"
                options={[{ value: "", label: "Composition · none" }, ...COMPOSITION_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))]}
              />
            </div>

            <div className="grid cols-4" style={{ marginTop: 12 }}>
              <Select value={aspect} onChange={(event) => setAspect(event.target.value)} aria-label="Aspect" options={ASPECT_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))} />
              <Select
                value={String(count)}
                onChange={(event) => setCount(Number(event.target.value))}
                aria-label="Variants"
                options={[1, 2, 3, 4].map((value) => ({ value: String(value), label: `${value} variant${value > 1 ? "s" : ""}` }))}
              />
              <Select
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                aria-label="Project"
                options={[{ value: "", label: "No project" }, ...(projects.data ?? []).map((project) => ({ value: project.id, label: project.name }))]}
              />
              <Input value={outputDir} onChange={(event) => setOutputDir(event.target.value)} placeholder={activeProject?.output_dir || "Default project output"} aria-label="Output directory" />
            </div>

            <div className="field" style={{ marginTop: 12 }}>
              <span className="field-label">Negative constraints</span>
              <Input value={negative} onChange={(event) => setNegative(event.target.value)} placeholder="watermark, extra props, text, clutter" />
            </div>
          </Card>

          <Card>
            <div className="section-title">
              <h2>Reference images</h2>
              <Button size="sm" variant="ghost" icon="plus" onClick={() => setRefPickerOpen(true)}>Add file</Button>
            </div>
            {references.data && references.data.length === 0 ? (
              <div className="muted small">No references in this project yet. Add one to guide style, composition or subject identity.</div>
            ) : null}
            <div className="row wrap" style={{ gap: 10 }}>
              {references.data?.map((reference) => {
                const selected = selectedRefs.includes(reference.path);
                return (
                  <button
                    key={reference.id}
                    onClick={() => setSelectedRefs((current) => selected ? current.filter((path) => path !== reference.path) : [...current, reference.path])}
                    style={{
                      width: 92, padding: 0, borderRadius: 10, overflow: "hidden", cursor: "pointer",
                      border: selected ? "1px solid rgba(125,211,252,.7)" : "1px solid var(--line)",
                      background: "var(--surface-2)", position: "relative",
                    }}
                    title={reference.path}
                  >
                    <img src={toFileUrl(reference.thumb_path || reference.path)} alt={reference.role} style={{ width: "100%", height: 72, objectFit: "cover", display: "block" }} />
                    <span className="tiny" style={{ display: "block", padding: "4px 6px", color: selected ? "#d8ecff" : "var(--muted)" }}>
                      {selected ? <Icon name="check" size={11} /> : null} {reference.role}
                    </span>
                  </button>
                );
              })}
            </div>
            {selectedRefs.length > 0 ? (
              <div className="tiny muted" style={{ marginTop: 8 }}>
                {selectedRefs.length} reference(s) will be passed to Codex with <span className="mono">-i</span>.
              </div>
            ) : null}
          </Card>

          {log.length > 0 || running ? (
            <Card>
              <div className="section-title">
                <h2>Generation</h2>
                {running ? <Spinner label="Codex is working…" /> : lastOutcome ? <Badge tone={lastOutcome.status === "succeeded" ? "ok" : "err"}>{lastOutcome.status}</Badge> : null}
              </div>
              <div className="log-view">
                {log.length === 0 ? "Waiting for the first event…" : log.join("\n")}
              </div>
              {lastOutcome ? (
                <div className="row wrap" style={{ marginTop: 8, gap: 12 }}>
                  <span className="tiny muted">duration {formatDuration(lastOutcome.duration_ms)}</span>
                  <span className="tiny muted">exit {lastOutcome.exit ?? "—"}</span>
                  {lastOutcome.error ? <span className="tiny" style={{ color: "#fecaca" }}>{lastOutcome.error}</span> : null}
                </div>
              ) : null}
            </Card>
          ) : null}

          {results.length > 0 ? (
            <Card>
              <div className="section-title"><h2>Result</h2><span>{results.length} image(s) imported</span></div>
              <div className="result-strip">
                {results.map((image) => (
                  <div key={image.id} className="thumb" onClick={() => setLightbox(image)} role="button" tabIndex={0}>
                    <img src={toFileUrl(image.path)} alt={image.file_name} />
                    <div className="thumb-meta"><span className="truncate">{image.file_name}</span><span className="mono">{image.width}×{image.height}</span></div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>

        <div className="stack">
          <Card>
            <div className="row between" style={{ marginBottom: 8 }}>
              <h2 style={{ fontSize: 14 }}>Prompt Intelligence</h2>
              <Badge tone={scoreTone}>{analysis.score}/100</Badge>
            </div>
            <div className="split-progress"><div style={{ width: `${analysis.score}%` }} /></div>
            <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
              {[
                ["subject", analysis.hasSubject],
                ["style", analysis.hasStyle],
                ["light", analysis.hasLighting],
                ["frame", analysis.hasComposition],
                ["aspect", analysis.hasAspect],
                ["avoid", analysis.hasNegative],
              ].map(([label, ok]) => (
                <Badge key={String(label)} tone={ok ? "ok" : "default"}>{String(label)}</Badge>
              ))}
            </div>
            {analysis.ambiguous ? (
              <div className="chip warn" style={{ marginTop: 10, display: "flex" }}>
                <Icon name="alert" size={12} /> The request is very short — add subject detail.
              </div>
            ) : null}
            <ul className="muted tiny" style={{ margin: "10px 0 0", paddingInlineStart: 16, lineHeight: 1.7 }}>
              {analysis.tips.slice(0, 4).map((tip) => <li key={tip}>{tip}</li>)}
              {analysis.tips.length === 0 ? <li>Prompt is well specified.</li> : null}
            </ul>
          </Card>

          <Card>
            <div className="section-title"><h2>Final prompt</h2><span>{edited ? "edited" : "auto"}</span></div>
            <div className="pill-tabs" style={{ marginBottom: 8 }}>
              {(["structured", "compact", "original"] as const).map((mode) => (
                <button key={mode} data-active={view === mode ? "true" : "false"} onClick={() => setView(mode)}>{mode}</button>
              ))}
            </div>
            <Textarea
              value={view === "original" ? raw : finalPrompt}
              readOnly={view === "original"}
              onChange={(event) => { setEdited(event.target.value); }}
              style={{ minHeight: 200, fontFamily: "var(--mono)", fontSize: 11.5 }}
            />
            <div className="row wrap" style={{ marginTop: 8 }}>
              <Button size="sm" variant="ghost" icon="refresh" onClick={() => setEdited(null)} disabled={!edited}>Reset to auto</Button>
              <span className="spacer" />
              <span className="dim tiny">{finalPrompt.length} chars</span>
            </div>
          </Card>

          <Card tight>
            <div className="row between">
              <span className="strong small">What is sent to Codex</span>
              <Badge tone="accent">image_gen</Badge>
            </div>
            <p className="muted tiny" style={{ margin: "6px 0 0" }}>
              The final prompt is embedded in an engine instruction that forbids scripts, API keys and extra subjects. The
              generated file is imported from <span className="mono">$CODEX_HOME/generated_images</span>.
            </p>
            <div style={{ marginTop: 8 }}>
              <CodeBlock text={`codex exec --json --skip-git-repo-check -C <project/work> -m <model?> -c model_reasoning_effort -s workspace-write -- "<engine prompt>"`} maxHeight={92} />
            </div>
          </Card>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 22 }}>
        <h2>Recent outputs</h2>
        <Button size="sm" variant="ghost" icon="chevronRight" onClick={() => useApp.getState().setRoute("gallery")}>Gallery</Button>
      </div>
      {recent.data && recent.data.items.length === 0 ? (
        <EmptyState icon="image" title="Nothing yet" description="Your generated images will appear here with their prompt, dimensions and file hashes." />
      ) : (
        <div className="gallery-grid">
          {recent.data?.items.map((image) => (
            <div key={image.id} className="thumb" onClick={() => setLightbox(image)} role="button" tabIndex={0}>
              <img src={toFileUrl(image.thumb_path || image.path)} alt={image.file_name} loading="lazy" />
              <div className="thumb-meta"><span className="truncate">{image.file_name}</span><span className="mono">{image.width}×{image.height}</span></div>
            </div>
          ))}
        </div>
      )}

      {lightbox ? (
        <Lightbox
          src={toFileUrl(lightbox.path)}
          title={lightbox.file_name}
          subtitle={`${lightbox.width}×${lightbox.height} · ${lightbox.format.toUpperCase()} · ${(lightbox.size_bytes / 1024).toFixed(0)} KB`}
          onClose={() => setLightbox(null)}
          side={
            <div className="stack">
              <div>
                <div className="tiny muted">Prompt</div>
                <div className="small" style={{ whiteSpace: "pre-wrap", maxHeight: 180, overflow: "auto" }}>{lightbox.prompt || "—"}</div>
              </div>
              <div>
                <div className="tiny muted">SHA-256</div>
                <div className="mono tiny truncate">{lightbox.sha256}</div>
              </div>
              <div className="row wrap">
                <Button size="sm" icon="wand" onClick={() => { useApp.getState().setHandoff({ imageId: lightbox.id, imagePath: lightbox.path, prompt: lightbox.prompt }); useApp.getState().setRoute("edit"); }}>Edit</Button>
                <Button size="sm" icon="folder" onClick={() => void api.openPath(lightbox.path).catch(() => undefined)}>Reveal</Button>
                <Button size="sm" icon="star" onClick={() => void api.imageFavorite(lightbox.id, true).catch(() => undefined)}>Favourite</Button>
              </div>
            </div>
          }
        />
      ) : null}

      <FilePickerModal
        open={refPickerOpen}
        title="Add reference image"
        subtitle="Copied into the project References folder"
        mode="file"
        roots={[{ name: "Home", path: "" }]}
        onClose={() => setRefPickerOpen(false)}
        onPick={(path) => setAddRefPath(path)}
        loader={async (path) => {
          const listing = await api.pickerList(path);
          return {
            path: listing.path,
            parent: listing.parent,
            dirs: listing.dirs,
            files: listing.files.filter((file) => file.is_image),
            count: listing.count,
          };
        }}
      />
      {addRefPath ? (
        <div className="banner" style={{ margin: "10px 0 0" }}>
          <Icon name="image" size={14} />
          <span className="mono-path" style={{ flex: 1 }}>{addRefPath}</span>
          <Button size="sm" variant="primary" onClick={async () => {
            try {
              await api.referenceAdd(addRefPath, projectId, "reference");
              toast("Reference added to the project", "ok");
              setAddRefPath("");
              references.refetch();
            } catch (error) { toast(errorText(error), "err"); }
          }}>Add reference</Button>
          <Button size="sm" variant="ghost" onClick={() => setAddRefPath("")}>Dismiss</Button>
        </div>
      ) : null}
    </div>
  );
}
