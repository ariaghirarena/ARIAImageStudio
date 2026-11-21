import { useCreateMemory, readCreateMemory, writeCreateMemory, recoverMessages } from "../lib/create-memory";
import { ImportImageButton } from "../components/ImportImage";
import { faLabel } from "@aria/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type ChatMessage = {
  id: string;
  role: "user" | "ai";
  text: string;
  images?: ImageRecord[];
  status?: "running" | "succeeded" | "failed" | "cancelled" | "interrupted";
  durationMs?: number;
  error?: string;
};

const uid = () => Math.random().toString(36).slice(2, 9);

export function CreatePage() {
  const route = useApp((state) => state.route);
  const activeJob = useRef<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const settings = useApp((state) => state.settings);
  const handoff = useApp((state) => state.handoff);
  const setHandoff = useApp((state) => state.setHandoff);
  const toast = useApp((state) => state.toast);
  const projects = useProjects();
  const references = useReferences(settings.active_project_id);

  const [raw, setRaw] = useCreateMemory("raw", handoff.prompt ?? "");
  const [presetId, setPresetId] = useCreateMemory("presetId", handoff.presetId ?? settings.quality_preset ?? "aria-best-quality");
  const [styleId, setStyleId] = useCreateMemory("styleId", "");
  const [lightingId, setLightingId] = useCreateMemory("lightingId", "");
  const [cameraId, setCameraId] = useCreateMemory("cameraId", "");
  const [compositionId, setCompositionId] = useCreateMemory("compositionId", "");
  const [aspect, setAspect] = useCreateMemory("aspect", handoff.aspect ?? "4:5");
  const [negative, setNegative] = useCreateMemory("negative", handoff.negative ?? "");
  const [count, setCount] = useCreateMemory("count", 1);
  const [projectId, setProjectId] = useCreateMemory("projectId", settings.active_project_id);
  const [outputDir, setOutputDir] = useCreateMemory("outputDir", "");
  const [selectedRefs, setSelectedRefs] = useCreateMemory<string[]>("selectedRefs", []);
  const [edited, setEdited] = useState<string | null>(null);
  const [view, setView] = useCreateMemory<"structured" | "compact" | "original">("view", "structured");
  const [running, setRunning] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => recoverMessages(readCreateMemory<ChatMessage[]>("messages", [])));
  const [lightbox, setLightbox] = useState<ImageRecord | null>(null);
  const [addRefPath, setAddRefPath] = useState("");
  const [refPickerOpen, setRefPickerOpen] = useState(false);
  const [translateBusy, setTranslateBusy] = useState(false);
  const [refineBusy, setRefineBusy] = useState(false);
  const [showSettings, setShowSettings] = useCreateMemory("showSettings", false);
  const recent = useGallery({ limit: 6, sort: "newest" });
  const threadRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => { writeCreateMemory("messages", messages.slice(-200)); }, [messages]);

  const cancelGeneration = async () => {
    if (!activeJob.current || cancelling) return;
    setCancelling(true);
    try { await api.jobCancel(activeJob.current); }
    catch (error) { toast(errorText(error), "err"); setCancelling(false); }
  };

  const generate = useCallback(async () => {
    if (running || activeJob.current) return;
    if (!raw.trim()) {
      toast("اول توضیح تصویر را بنویسید", "err");
      return;
    }
    const userMsg: ChatMessage = { id: uid(), role: "user", text: raw };
    const aiId = uid();
    const aiMsg: ChatMessage = { id: aiId, role: "ai", text: "در حال ساخت تصویر؛ لطفاً منتظر بمانید…", status: "running" };
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    const jobId = `direct-${crypto.randomUUID()}`;
    activeJob.current = jobId;
    setCancelling(false);
    setRunning(true);
    let unlisten: (() => void) | undefined;
    try {
      unlisten = await onEvent<{ text: string }>("aria://generation-line", (payload) => {
        // Keep the conversational status understandable; raw engine output belongs in History.
        void payload;
      });
      const outcome = await api.generateNow({ ...buildRequest(), job_id: jobId });
      setMessages((prev) => prev.map((m) => (m.id === aiId ? {
        ...m,
        status: outcome.status === "cancelled" ? "cancelled" : outcome.images.length > 0 ? "succeeded" : "failed",
        images: outcome.images,
        durationMs: outcome.duration_ms,
        error: outcome.error || undefined,
        text: outcome.status === "cancelled" ? "ساخت تصویر لغو شد." : outcome.images.length > 0
          ? `${outcome.images.length} تصویر ساخته شد.`
          : (outcome.error || "موتور تصویری برنگرداند."),
      } : m)));
      if (outcome.status === "cancelled") {
        toast("ساخت تصویر لغو شد؛ خروجی احتمالی پیش از لغو در گالری می‌ماند", "info");
      } else if (outcome.images.length > 0) {
        toast(`${outcome.images.length} تصویر در ${formatDuration(outcome.duration_ms)} ساخته شد`, "ok");
        void recent.refetch();
      } else {
        toast(outcome.error || "موتور تصویری برنگرداند", "err");
      }
    } catch (error) {
      const text = errorText(error);
      setMessages((prev) => prev.map((m) => (m.id === aiId ? { ...m, status: "failed", text, error: text } : m)));
      toast(text, "err");
    } finally {
      unlisten?.();
      activeJob.current = null;
      setCancelling(false);
      setRunning(false);
    }
  }, [running, raw, toast, buildRequest, recent]);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const enqueue = useAction(() => api.generateQueue(buildRequest()), { success: "به صف تولید اضافه شد" });

  const savePrompt = useAction(
    () => api.promptSave({ title: raw.slice(0, 60) || "پرامپت بدون عنوان", body: finalPrompt, negative, category: presetId, tags: [presetId], project_id: projectId }),
    { success: "پرامپت در کتابخانه ذخیره شد" },
  );

  const translate = async () => {
    setTranslateBusy(true);
    try {
      const result = await api.codexComplete(translationInstruction(raw));
      setRaw(result.text.trim());
      toast("پرامپت توسط Codex ترجمه شد", "ok");
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
      toast("پرامپت بازنویسی شد — قبل از ساخت بررسی کنید", "ok");
    } catch (error) {
      toast(errorText(error), "err");
    } finally {
      setRefineBusy(false);
    }
  };

  useHotkeys(route === "create" ? {
    "mod+enter": () => void generate(),
    "mod+s": () => { if (!savePrompt.isPending) savePrompt.mutate([]); },
  } : {});

  useEffect(() => {
    if (route !== "create") return;
    if (handoff.prompt !== undefined) setRaw(handoff.prompt);
    if (handoff.presetId) setPresetId(handoff.presetId);
    if (handoff.aspect) setAspect(handoff.aspect);
    if (handoff.negative !== undefined) setNegative(handoff.negative);
    if (Object.keys(handoff).length) setHandoff({});
  }, [route, handoff, setHandoff]);

  useEffect(() => {
    if (route !== "create") { setLightbox(null); setRefPickerOpen(false); }
  }, [route]);

  const scoreTone = analysis.score >= 75 ? "ok" : analysis.score >= 45 ? "warn" : "err";

  return (
    <div className="page fade-in">
      <PageHeader
        title="ساخت تصویر"
        description="توضیح تصویر را فارسی یا انگلیسی بنویسید؛ موتور پرامپت آن را مرتب می‌کند و ابزار داخلی Codex تصویر را می‌سازد."
        actions={
          <>
            <ImportImageButton projectId={projectId} onImported={(image) => { setSelectedRefs((current) => [...current, image.path]); toast("عکس انتخاب‌شده به‌عنوان مرجع تصویر بعدی استفاده می‌شود", "info"); }} />
            <Button icon="trash" disabled={running} onClick={() => { if (window.confirm("گفت‌وگوی این صفحه پاک شود؟ تصاویر ذخیره‌شده حذف نمی‌شوند.")) setMessages([]); }}>پاک‌کردن چت</Button>
            <Button icon="library" loading={savePrompt.isPending} onClick={() => savePrompt.mutate([])}>ذخیره پرامپت</Button>
            <Button icon="grid" onClick={() => enqueue.mutate([])} loading={enqueue.isPending}>افزودن به صف</Button>
            {running ? <Button variant="danger" icon="close" disabled={cancelling} onClick={() => void cancelGeneration()}>{cancelling ? "در حال لغو…" : "لغو ساخت"}</Button> : null}
            <Button variant="primary" icon="sparkles" loading={running} onClick={() => void generate()}>ساخت تصویر</Button>
          </>
        }
      />

      <div className="prompt-shell" data-expanded={showSettings}>
        <div className="chat">
          <div className="chat-thread" ref={threadRef} style={{ maxHeight: "62vh", overflow: "auto" }}>
            {messages.length === 0 ? (
              <div className="chat-empty">
                <h1>چه تصویری می‌خواهید بسازید؟</h1>
                <p>توضیح را بنویسید و دکمه ساخت را بزنید. مثلاً: «یک عکس تبلیغاتی لوکس برای عطر مشکی روی سنگ مرمر، نور نرم از سمت چپ»</p>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className={`msg ${message.role === "user" ? "msg-user" : "msg-ai"}`}>
                  <div className="msg-avatar">
                    <Icon name={message.role === "user" ? "user" : "sparkles"} size={15} />
                  </div>
                  <div>
                    <div className="msg-body">{message.text}</div>
                    {message.images && message.images.length > 0 ? (
                      <div className="msg-images">
                        {message.images.map((image) => (
                          <div key={image.id} className="thumb" onClick={() => setLightbox(image)} role="button" tabIndex={0}>
                            <img src={toFileUrl(image.path)} alt={image.file_name} />
                            <div className="thumb-meta"><span className="truncate">{image.file_name}</span><span className="mono">{image.width}×{image.height}</span></div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="msg-meta">
                      {message.status === "running" ? <span className="row" style={{ gap: 6 }}><Spinner label="در حال ساخت…" /></span> : null}
                      {message.status === "succeeded" && message.durationMs ? <span>ساخته شد در {formatDuration(message.durationMs)}</span> : null}
                      {message.status === "failed" && message.error ? <span style={{ color: "var(--err)" }}>{message.error}</span> : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="composer-wrap">
            <div className="composer">
              <textarea
                value={raw}
                onChange={(event) => setRaw(event.target.value)}
                placeholder="توضیح تصویر را اینجا بنویسید…"
              />
              <div className="composer-bar">
                <button className="composer-chip" data-active={showSettings ? "true" : "false"} onClick={() => setShowSettings((v) => !v)}>
                  <Icon name="sliders" size={12} /> مرجع و تنظیمات
                </button>
                <button className="composer-chip" data-active={refineBusy ? "true" : "false"} onClick={() => void refine()} disabled={!raw.trim() || refineBusy}>
                  <Icon name="zap" size={12} /> بهبود پرامپت
                </button>
                <button className="composer-chip" onClick={() => void translate()} disabled={!raw.trim() || translateBusy || built.language === "en"}>
                  <Icon name="refresh" size={12} /> ترجمه به انگلیسی
                </button>
                <button className="composer-chip" onClick={() => { setRaw(""); setEdited(null); }}>
                  <Icon name="close" size={12} /> پاک‌کردن
                </button>
                {running ? <Button variant="danger" icon="close" disabled={cancelling} onClick={() => void cancelGeneration()}>{cancelling ? "در حال لغو…" : "لغو ساخت"}</Button> : null}
                <button className="composer-send" onClick={() => void generate()} disabled={running || !raw.trim()} aria-label="ساخت تصویر">
                  <Icon name="sparkles" size={16} />
                </button>
              </div>
            </div>
            {selectedRefs.length > 0 ? <div className="composer-hint">{selectedRefs.length} عکس مرجع برای تصویر بعدی انتخاب شده است <Button size="sm" variant="ghost" onClick={() => setSelectedRefs([])}>حذف مرجع‌ها</Button></div> : null}
            <div className="composer-hint">Ctrl+Enter برای ساخت · Ctrl+S برای ذخیره پرامپت</div>
          </div>
        </div>

        <div className="stack prompt-settings" hidden={!showSettings}>
          <Card>
            <div className="row between" style={{ marginBottom: 8 }}>
              <h2 style={{ fontSize: 14 }}>کیفیت پرامپت</h2>
              <Badge tone={scoreTone}>{analysis.score}/۱۰۰</Badge>
            </div>
            <div className="split-progress"><div style={{ width: `${analysis.score}%` }} /></div>
            <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
              {[
                ["موضوع", analysis.hasSubject],
                ["سبک", analysis.hasStyle],
                ["نور", analysis.hasLighting],
                ["کادر", analysis.hasComposition],
                ["ابعاد", analysis.hasAspect],
                ["محدودیت", analysis.hasNegative],
              ].map(([label, ok]) => (
                <Badge key={String(label)} tone={ok ? "ok" : "default"}>{String(label)}</Badge>
              ))}
            </div>
            {analysis.ambiguous ? (
              <div className="chip warn" style={{ marginTop: 10, display: "flex" }}>
                <Icon name="alert" size={12} /> توضیح خیلی کوتاه است — جزئیات موضوع را اضافه کنید.
              </div>
            ) : null}
            <ul className="muted tiny" style={{ margin: "10px 0 0", paddingInlineStart: 16, lineHeight: 1.7 }}>
              {analysis.tips.slice(0, 4).map((tip) => <li key={tip}>{tip}</li>)}
              {analysis.tips.length === 0 ? <li>پرامپت کامل و مشخص است.</li> : null}
            </ul>
          </Card>

          {showSettings ? (
            <Card>
              <div className="section-title"><h2>تنظیمات پیشرفته</h2></div>
              <div className="preset-chips">
                {QUALITY_PRESETS.map((preset) => (
                  <button key={preset.id} className="preset-chip" data-active={presetId === preset.id ? "true" : "false"} onClick={() => setPresetId(preset.id)} title={preset.labelFa}>
                    {preset.labelFa}
                  </button>
                ))}
              </div>
              <div className="grid cols-2" style={{ marginTop: 12 }}>
                <Select value={styleId} onChange={(event) => setStyleId(event.target.value)} aria-label="سبک" options={[{ value: "", label: "سبک · هیچ‌کدام" }, ...STYLE_PRESETS.map((preset) => ({ value: preset.id, label: preset.labelFa }))]} />
                <Select value={lightingId} onChange={(event) => setLightingId(event.target.value)} aria-label="نور" options={[{ value: "", label: "نور · هیچ‌کدام" }, ...LIGHTING_PRESETS.map((preset) => ({ value: preset.id, label: preset.labelFa }))]} />
                <Select value={cameraId} onChange={(event) => setCameraId(event.target.value)} aria-label="دوربین" options={[{ value: "", label: "دوربین · هیچ‌کدام" }, ...CAMERA_PRESETS.map((preset) => ({ value: preset.id, label: preset.labelFa }))]} />
                <Select value={compositionId} onChange={(event) => setCompositionId(event.target.value)} aria-label="ترکیب‌بندی" options={[{ value: "", label: "ترکیب‌بندی · هیچ‌کدام" }, ...COMPOSITION_PRESETS.map((preset) => ({ value: preset.id, label: preset.labelFa }))]} />
                <Select value={aspect} onChange={(event) => setAspect(event.target.value)} aria-label="ابعاد" options={ASPECT_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))} />
                <Select value={String(count)} onChange={(event) => setCount(Number(event.target.value))} aria-label="تعداد" options={[1, 2, 3, 4].map((value) => ({ value: String(value), label: `${value} نسخه` }))} />
                <Select value={projectId} onChange={(event) => setProjectId(event.target.value)} aria-label="پروژه" options={[{ value: "", label: "بدون پروژه" }, ...(projects.data ?? []).map((project) => ({ value: project.id, label: project.name }))]} />
                <Input value={outputDir} onChange={(event) => setOutputDir(event.target.value)} placeholder={activeProject?.output_dir || "پوشه خروجی پیش‌فرض"} aria-label="پوشه خروجی" />
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <span className="field-label">موارد ممنوعه</span>
                <Input value={negative} onChange={(event) => setNegative(event.target.value)} placeholder="واترمارک، متن، شلوغی…" />
              </div>
            </Card>
          ) : null}

          <Card>
            <div className="section-title">
              <h2>عکس‌های مرجع</h2>
              <Button size="sm" variant="ghost" icon="plus" onClick={() => setRefPickerOpen(true)}>افزودن فایل</Button>
            </div>
            {references.data && references.data.length === 0 ? (
              <div className="muted small">در این پروژه عکس مرجع نیست. یکی اضافه کنید تا سبک یا موضوع را هدایت کند.</div>
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
                      border: selected ? "1px solid var(--accent)" : "1px solid var(--line)",
                      background: "var(--surface-2)", position: "relative",
                    }}
                    title={reference.path}
                  >
                    <img src={toFileUrl(reference.thumb_path || reference.path)} alt={faLabel(reference.role)} style={{ width: "100%", height: 72, objectFit: "cover", display: "block" }} />
                    <span className="tiny" style={{ display: "block", padding: "4px 6px", color: selected ? "var(--ok)" : "var(--muted)" }}>
                      {selected ? <Icon name="check" size={11} /> : null} {faLabel(reference.role)}
                    </span>
                  </button>
                );
              })}
            </div>
            {selectedRefs.length > 0 ? (
              <div className="tiny muted" style={{ marginTop: 8 }}>
                {selectedRefs.length} عکس مرجع همراه پرامپت برای Codex ارسال می‌شود.
              </div>
            ) : null}
          </Card>

          <Card>
            <div className="section-title"><h2>پرامپت نهایی</h2><span>{edited ? "ویرایش شده" : "خودکار"}</span></div>
            <div className="pill-tabs" style={{ marginBottom: 8 }}>
              {([["structured", "کامل"], ["compact", "خلاصه"], ["original", "اصلی"]] as const).map(([mode, label]) => (
                <button key={mode} data-active={view === mode ? "true" : "false"} onClick={() => setView(mode)}>{label}</button>
              ))}
            </div>
            <Textarea
              value={view === "original" ? raw : finalPrompt}
              readOnly={view === "original"}
              onChange={(event) => { setEdited(event.target.value); }}
              style={{ minHeight: 160, fontFamily: "var(--mono)", fontSize: 11.5 }}
            />
            <div className="row wrap" style={{ marginTop: 8 }}>
              <Button size="sm" variant="ghost" icon="refresh" onClick={() => setEdited(null)} disabled={!edited}>بازگشت به خودکار</Button>
              <span className="spacer" />
              <span className="dim tiny">{finalPrompt.length} نویسه</span>
            </div>
          </Card>

          <Card tight>
            <div className="row between">
              <span className="strong small">چه چیزی برای Codex ارسال می‌شود</span>
              <Badge tone="accent">image_gen</Badge>
            </div>
            <p className="muted tiny" style={{ margin: "6px 0 0" }}>
              پرامپت نهایی داخل دستور موتور قرار می‌گیرد. فایل ساخته‌شده از پوشه <span className="mono">generated_images</span> وارد پروژه می‌شود.
            </p>
            <div style={{ marginTop: 8 }}>
              <CodeBlock text={`codex exec --json --skip-git-repo-check -C <project/work> -m <model?> -c model_reasoning_effort -s workspace-write -- "<engine prompt>"`} maxHeight={92} />
            </div>
          </Card>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 22 }}>
        <h2>خروجی‌های اخیر</h2>
        <Button size="sm" variant="ghost" icon="chevronLeft" onClick={() => useApp.getState().setRoute("gallery")}>گالری</Button>
      </div>
      {recent.data && recent.data.items.length === 0 ? (
        <EmptyState icon="image" title="هنوز چیزی نیست" description="تصاویر ساخته‌شده شما با پرامپت و ابعادشان اینجا نمایش داده می‌شود." />
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
                <div className="tiny muted">پرامپت</div>
                <div className="small" style={{ whiteSpace: "pre-wrap", maxHeight: 180, overflow: "auto" }}>{lightbox.prompt || "—"}</div>
              </div>
              <div>
                <div className="tiny muted">کد تأیید فایل (SHA-256)</div>
                <div className="mono tiny truncate">{lightbox.sha256}</div>
              </div>
              <div className="row wrap">
                <Button size="sm" icon="wand" onClick={() => { useApp.getState().setHandoff({ imageId: lightbox.id, imagePath: lightbox.path, prompt: lightbox.prompt }); useApp.getState().setRoute("edit"); }}>ویرایش</Button>
                <Button size="sm" icon="folder" onClick={() => void api.openPath(lightbox.path).catch(() => undefined)}>نمایش در پوشه</Button>
                <Button size="sm" icon="star" onClick={() => void api.imageFavorite(lightbox.id, true).catch(() => undefined)}>علاقه‌مندی</Button>
              </div>
            </div>
          }
        />
      ) : null}

      <FilePickerModal
        open={refPickerOpen}
        title="افزودن عکس مرجع"
        subtitle="در پوشه مرجع‌های پروژه کپی می‌شود"
        mode="file"
        roots={[{ name: "خانه", path: "" }]}
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
              toast("عکس مرجع به پروژه اضافه شد", "ok");
              setAddRefPath("");
              references.refetch();
            } catch (error) { toast(errorText(error), "err"); }
          }}>افزودن مرجع</Button>
          <Button size="sm" variant="ghost" onClick={() => setAddRefPath("")}>بستن</Button>
        </div>
      ) : null}
    </div>
  );
}
