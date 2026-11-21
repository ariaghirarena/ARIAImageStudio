import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, CompareSlider, Icon, Lightbox, Modal, Select, Slider, Spinner, Textarea, Toggle } from "@aria/ui";
import { api, errorText, formatDuration, toFileUrl, type ImageRecord } from "@aria/core";
import { useApp } from "../store";
import { useAction, useGallery } from "../lib/hooks";
import { ImageThumb, PageHeader } from "../components/shell";

const EDIT_PRESETS = [
  { id: "background", label: "Replace background", instruction: "replace the background with a clean, softly lit studio set that matches the subject's existing light direction" },
  { id: "remove", label: "Remove an element", instruction: "remove the described unwanted element and reconstruct the area naturally behind it" },
  { id: "add", label: "Add an element", instruction: "add the described element, matching perspective, scale and lighting" },
  { id: "recolor", label: "Change colour", instruction: "change the colour of the described object only, keeping material and highlights" },
  { id: "relight", label: "Change lighting", instruction: "relight the scene with soft directional light from the left, keeping every object and the framing identical" },
  { id: "angle", label: "Change angle", instruction: "re-render the same scene from a slightly lower camera angle while keeping all products and styling identical" },
  { id: "style", label: "Change style", instruction: "restyle the image while keeping the subject, pose and composition exactly the same" },
];

export function EditPage() {
  const handoff = useApp((state) => state.handoff);
  const setHandoff = useApp((state) => state.setHandoff);
  const settings = useApp((state) => state.settings);
  const toast = useApp((state) => state.toast);
  const gallery = useGallery({ limit: 120, sort: "newest" });

  const [source, setSource] = useState<ImageRecord | null>(null);
  const [selectOpen, setSelectOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [invariants, setInvariants] = useState("keep the subject identity, geometry, pose and framing unchanged");
  const [presetId, setPresetId] = useState("background");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<ImageRecord | null>(null);
  const [lightbox, setLightbox] = useState<ImageRecord | null>(null);

  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(1);
  const [saturation, setSaturation] = useState(1);
  const [sharpen, setSharpen] = useState(0);
  const [denoise, setDenoise] = useState(false);
  const [scale, setScale] = useState(1);
  const [removeBg, setRemoveBg] = useState(false);
  const [tolerance, setTolerance] = useState(14);
  const [format, setFormat] = useState("png");
  const [quality, setQuality] = useState(92);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (handoff.imageId && gallery.data) {
      const found = gallery.data.items.find((image) => image.id === handoff.imageId);
      if (found) setSource(found);
    }
  }, [handoff.imageId, gallery.data]);

  useEffect(() => {
    if (gallery.data && !source && gallery.data.items.length > 0) setSource(gallery.data.items[0]);
  }, [gallery.data, source]);

  const editPrompt = useMemo(() => {
    const base = instruction.trim() || EDIT_PRESETS.find((preset) => preset.id === presetId)?.instruction || "improve the image";
    return [
      "Edit the provided image.",
      `Change only: ${base}.`,
      `Must keep unchanged: ${invariants}.`,
      "Do not add extra objects, text or watermarks. Return the edited image.",
    ].join("\n");
  }, [instruction, presetId, invariants]);

  const postProcess = useAction(
    (imageId: string) => api.postProcess(imageId, {
      brightness: brightness !== 0 ? brightness : null,
      contrast: contrast !== 1 ? contrast : null,
      saturation: saturation !== 1 ? saturation : null,
      sharpen_sigma: sharpen > 0 ? sharpen : null,
      denoise,
      scale: scale !== 1 ? scale : null,
      remove_background: removeBg ? tolerance : null,
      output_format: format,
      quality,
    }, "edit"),
    {
      success: "Derivative created — the original is untouched",
      onDone: (value) => {
        const record = value as unknown as ImageRecord;
        if (record?.path) {
          setResult({ ...record, width: Number(record.width), height: Number(record.height), size_bytes: Number(record.size_bytes) } as ImageRecord);
        }
        gallery.refetch();
      },
    },
  );

  const generateEdit = async () => {
    if (!source) {
      toast("Select a source image first", "err");
      return;
    }
    setRunning(true);
    setLog([]);
    setResult(null);
    try {
      const outcome = await api.generateNow({
        project_id: source.project_id,
        profile_id: settings.active_profile_id,
        prompt_original: instruction || presetId,
        prompt_final: editPrompt,
        negative: "watermark, text, extra objects, changed identity",
        reference_images: [source.path],
        count: 1,
        model: settings.codex_model,
        reasoning_effort: settings.reasoning_effort,
        verbosity: settings.verbosity,
        sandbox_mode: settings.sandbox_mode,
        timeout_secs: settings.generation_timeout_secs,
        quality_preset: "edit",
      });
      setLog(outcome.log.slice(-40));
      if (outcome.images.length > 0) {
        setResult(outcome.images[0]);
        toast(`Edit finished in ${formatDuration(outcome.duration_ms)}`, "ok");
        gallery.refetch();
      } else {
        toast(outcome.error || "No edited image was produced", "err");
      }
    } catch (error) {
      toast(errorText(error), "err");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="page fade-in">
      <PageHeader
        title="Edit Image"
        description="Two honest paths: an engine edit through the built-in image tool (prompt-directed, identity-preserving), or non-destructive local adjustments that never touch the original."
        actions={
          <>
            <Button icon="image" onClick={() => setSelectOpen(true)}>Choose image</Button>
            <Button variant="primary" icon="wand" loading={running} disabled={!source} onClick={() => void generateEdit()}>Generate edit</Button>
          </>
        }
      />

      <div className="grid split-left">
        <Card>
          <div className="section-title"><h2>Source</h2>{source ? <Badge tone="accent">{source.format.toUpperCase()}</Badge> : null}</div>
          {source ? (
            <div className="stack">
              <div className="thumb" style={{ aspectRatio: "4/3" }} onClick={() => setLightbox(source)} role="button" tabIndex={0}>
                <img src={toFileUrl(source.path)} alt={source.file_name} />
                <div className="thumb-meta"><span className="truncate">{source.file_name}</span><span className="mono">{source.width}×{source.height}</span></div>
              </div>
              <div className="row between">
                <span className="tiny muted truncate" style={{ maxWidth: 220 }}>{source.file_name}</span>
                <span className="tiny dim">{(source.size_bytes / 1024).toFixed(0)} KB</span>
              </div>
              <Button size="sm" variant="ghost" icon="refresh" onClick={() => setSelectOpen(true)}>Pick another</Button>
            </div>
          ) : gallery.isLoading ? <Spinner label="Loading gallery…" /> : <div className="muted small">No images in the library yet.</div>}
        </Card>

        <div className="stack">
          <Card>
            <div className="section-title"><h2>Engine edit</h2><span>Built-in image_gen</span></div>
            <div className="preset-chips" style={{ marginBottom: 10 }}>
              {EDIT_PRESETS.map((preset) => (
                <button key={preset.id} className="preset-chip" data-active={presetId === preset.id ? "true" : "false"} onClick={() => { setPresetId(preset.id); setInstruction(preset.instruction); }}>
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="field">
              <span className="field-label">Change only</span>
              <Textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Describe the single change you want" style={{ minHeight: 74 }} />
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <span className="field-label">Keep unchanged</span>
              <Textarea value={invariants} onChange={(event) => setInvariants(event.target.value)} style={{ minHeight: 58 }} />
            </div>
            {log.length > 0 ? <div className="log-view" style={{ marginTop: 10, maxHeight: 140 }}>{log.join("\n")}</div> : null}
          </Card>

          <Card>
            <div className="section-title"><h2>Local adjustments</h2><span>Non-destructive · writes a new file</span></div>
            <div className="grid cols-2">
              <Slider label="Brightness" value={brightness} min={-80} max={80} onChange={setBrightness} />
              <Slider label="Contrast" value={contrast} min={0.4} max={2} step={0.05} onChange={setContrast} />
              <Slider label="Saturation" value={saturation} min={0} max={2} step={0.05} onChange={setSaturation} />
              <Slider label="Sharpen" value={sharpen} min={0} max={4} step={0.1} onChange={setSharpen} />
              <Slider label="Upscale" value={scale} min={1} max={4} step={0.1} onChange={setScale} />
              <Slider label="Background tolerance" value={tolerance} min={2} max={40} onChange={setTolerance} />
            </div>
            <div className="row wrap" style={{ marginTop: 12, gap: 16 }}>
              <div className="row" style={{ gap: 8 }}><Toggle checked={denoise} onChange={setDenoise} label="Denoise" /><span className="small">Median denoise</span></div>
              <div className="row" style={{ gap: 8 }}><Toggle checked={removeBg} onChange={setRemoveBg} label="Remove background" /><span className="small">Chroma key cutout</span></div>
            </div>
            <div className="grid cols-2" style={{ marginTop: 12 }}>
              <Select value={format} onChange={(event) => setFormat(event.target.value)} aria-label="Format" options={[{ value: "png", label: "PNG" }, { value: "jpg", label: "JPEG" }, { value: "webp", label: "WebP" }]} />
              <Slider label="Quality" value={quality} min={40} max={100} onChange={setQuality} />
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <Button variant="primary" icon="sliders" loading={postProcess.isPending || processing} disabled={!source} onClick={() => {
                if (!source) return;
                setProcessing(true);
                postProcess.mutate([source.id]);
                window.setTimeout(() => setProcessing(false), 600);
              }}>
                Apply locally
              </Button>
              <span className="dim tiny">Lanczos resampling — not AI super-resolution.</span>
            </div>
          </Card>

          {result ? (
            <Card>
              <div className="section-title"><h2>Comparison</h2><span>drag the handle</span></div>
              {source ? <CompareSlider beforeSrc={toFileUrl(source.path)} afterSrc={toFileUrl(result.path)} alt={result.file_name} /> : null}
              <div className="row between" style={{ marginTop: 10 }}>
                <span className="tiny muted truncate">{result.file_name} · {result.width}×{result.height}</span>
                <div className="row" style={{ gap: 6 }}>
                  <Button size="sm" icon="eye" onClick={() => setLightbox(result)}>Inspect</Button>
                  <Button size="sm" icon="folder" onClick={() => void api.openPath(result.path).catch(() => undefined)}>Reveal</Button>
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      <Modal open={selectOpen} title="Choose a source image" subtitle="Only images already indexed by ARIA" onClose={() => setSelectOpen(false)} wide>
        {gallery.data && gallery.data.items.length === 0 ? <div className="muted small">The gallery is empty.</div> : null}
        <div className="gallery-grid" style={{ maxHeight: "56vh", overflow: "auto" }}>
          {gallery.data?.items.map((image) => (
            <ImageThumb
              key={image.id}
              record={image}
              onClick={() => { setSource(image); setSelectOpen(false); setHandoff({}); }}
              overlay={null}
            />
          ))}
        </div>
      </Modal>

      {lightbox ? (
        <Lightbox src={toFileUrl(lightbox.path)} title={lightbox.file_name} subtitle={`${lightbox.width}×${lightbox.height}`} onClose={() => setLightbox(null)}
          side={<div className="row wrap">
            <Button size="sm" icon="wand" onClick={() => { setSource(lightbox); setLightbox(null); }}>Use as source</Button>
            <Button size="sm" icon="folder" onClick={() => void api.openPath(lightbox.path).catch(() => undefined)}>Reveal</Button>
          </div>}
        />
      ) : null}

      <div className="row" style={{ marginTop: 16, gap: 8 }}>
        <Icon name="info" size={13} />
        <span className="dim tiny">
          Engine edits depend on what the built-in tool supports for your account. True masked inpainting is not exposed, which is why ARIA labels it as unsupported instead of faking it.
        </span>
      </div>
    </div>
  );
}
