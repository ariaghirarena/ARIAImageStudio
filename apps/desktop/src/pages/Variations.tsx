import { useEffect, useState } from "react";
import { Badge, Button, Card, CompareSlider, Lightbox, Modal, Select, Spinner } from "@aria/ui";
import { api, errorText, formatDuration, toFileUrl, type ImageRecord } from "@aria/core";
import { useApp } from "../store";
import { useGallery } from "../lib/hooks";
import { ImageThumb, PageHeader } from "../components/shell";

const AXES = [
  { id: "style", label: "Style", instruction: "restyle the image in the requested visual style while keeping the subject, pose and framing identical" },
  { id: "colour", label: "Colour", instruction: "shift the colour palette of the image while keeping every object, its position and the lighting shape unchanged" },
  { id: "background", label: "Background", instruction: "replace only the background with a variation that keeps the subject untouched and the light direction consistent" },
  { id: "lighting", label: "Lighting", instruction: "change the lighting mood only, keeping geometry, objects and framing identical" },
  { id: "angle", label: "Camera angle", instruction: "render the same scene from a nearby camera angle, keeping all objects and their relationships intact" },
  { id: "minimal", label: "Minimal", instruction: "produce a more minimal version of the same scene with fewer distractions, same subject and message" },
];

export function VariationsPage() {
  const settings = useApp((state) => state.settings);
  const toast = useApp((state) => state.toast);
  const handoff = useApp((state) => state.handoff);
  const gallery = useGallery({ limit: 120, sort: "newest" });

  const [source, setSource] = useState<ImageRecord | null>(null);
  const [axis, setAxis] = useState("style");
  const [styleHint, setStyleHint] = useState("cinematic, warm amber highlights, deep shadows");
  const [count, setCount] = useState(2);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ImageRecord[]>([]);
  const [pickA, setPickA] = useState<ImageRecord | null>(null);
  const [pickB, setPickB] = useState<ImageRecord | null>(null);
  const [lightbox, setLightbox] = useState<ImageRecord | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (handoff.imageId && gallery.data) {
      const found = gallery.data.items.find((image) => image.id === handoff.imageId);
      if (found) {
        setSource(found);
        setPickA(found);
      }
    }
  }, [handoff.imageId, gallery.data]);

  useEffect(() => {
    if (!source && gallery.data && gallery.data.items.length > 0) {
      setSource(gallery.data.items[0]);
      setPickA(gallery.data.items[0]);
    }
  }, [gallery.data, source]);

  const run = async () => {
    if (!source) {
      toast("Pick a source image", "err");
      return;
    }
    setRunning(true);
    setResults([]);
    try {
      const axisDef = AXES.find((entry) => entry.id === axis) ?? AXES[0];
      const prompt = [
        "Edit the provided image to create a variation.",
        `Variation axis: ${axisDef.label}.`,
        `Instruction: ${axisDef.instruction}.`,
        axis === "style" && styleHint.trim() ? `Style direction: ${styleHint.trim()}.` : "",
        "Keep the subject identity exactly; do not add new objects or text.",
      ].filter(Boolean).join("\n");
      const outcome = await api.generateNow({
        project_id: source.project_id,
        profile_id: settings.active_profile_id,
        prompt_original: `${axisDef.label} variation of ${source.file_name}`,
        prompt_final: prompt,
        negative: "watermark, text, extra objects",
        reference_images: [source.path],
        count,
        model: settings.codex_model,
        reasoning_effort: settings.reasoning_effort,
        verbosity: settings.verbosity,
        sandbox_mode: settings.sandbox_mode,
        timeout_secs: settings.generation_timeout_secs,
        quality_preset: "variation",
      });
      if (outcome.images.length === 0) {
        toast(outcome.error || "No variation was produced", "err");
      } else {
        setResults(outcome.images);
        setPickB(outcome.images[0]);
        toast(`${outcome.images.length} variation(s) in ${formatDuration(outcome.duration_ms)}`, "ok");
        gallery.refetch();
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
        title="Image Variations"
        description="Branch from an existing image along one explicit axis. Each variant is a separate engine call — no fabricated batch parameters."
        actions={
          <>
            <Button icon="image" onClick={() => setPickerOpen(true)}>Choose source</Button>
            <Button variant="primary" icon="layers" loading={running} onClick={() => void run()}>Generate variations</Button>
          </>
        }
      />

      <div className="grid split">
        <div className="stack">
          <Card>
            <div className="section-title"><h2>Variation axis</h2><span>one change at a time</span></div>
            <div className="preset-chips">
              {AXES.map((entry) => (
                <button key={entry.id} className="preset-chip" data-active={axis === entry.id ? "true" : "false"} onClick={() => setAxis(entry.id)}>{entry.label}</button>
              ))}
            </div>
            {axis === "style" ? (
              <div className="field" style={{ marginTop: 12 }}>
                <span className="field-label">Style direction</span>
                <input className="mono" style={{ background: "#080a0e", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 11px" }} value={styleHint} onChange={(event) => setStyleHint(event.target.value)} />
              </div>
            ) : null}
            <div className="row wrap" style={{ marginTop: 14 }}>
              <div style={{ width: 180 }}>
                <Select value={String(count)} onChange={(event) => setCount(Number(event.target.value))} aria-label="Variant count" options={[1, 2, 3, 4].map((value) => ({ value: String(value), label: `${value} variant(s)` }))} />
              </div>
              <span className="dim tiny">Each variant is one built-in image_gen call.</span>
            </div>
          </Card>

          <Card>
            <div className="section-title"><h2>Compare</h2><span>drag the divider</span></div>
            {pickA && pickB ? (
              <CompareSlider beforeSrc={toFileUrl(pickA.path)} afterSrc={toFileUrl(pickB.path)} alt="variation comparison" />
            ) : (
              <div className="muted small">Select two images (source + variant) to compare.</div>
            )}
            <div className="row wrap" style={{ marginTop: 10 }}>
              <Badge tone="info">A: {pickA?.file_name ?? "—"}</Badge>
              <Badge tone="accent">B: {pickB?.file_name ?? "—"}</Badge>
              {pickA && pickB ? (
                <Button size="sm" icon="activity" onClick={async () => {
                  try {
                    const metric = await api.imageCompare(pickA.path, pickB.path);
                    toast(metric.same_dimensions
                      ? `Mean absolute difference ${metric.mean_absolute_difference.toFixed(2)} / 255 ${metric.identical ? "(identical)" : ""}`
                      : "Images have different dimensions — visual comparison only", "info");
                  } catch (error) { toast(errorText(error), "err"); }
                }}>Diff metric</Button>
              ) : null}
            </div>
          </Card>

          <Card>
            <div className="section-title"><h2>Results</h2><span>{results.length} variant(s)</span></div>
            {running ? <Spinner label="Codex is generating variations…" /> : null}
            {results.length === 0 && !running ? <div className="muted small">Variants appear here after a run.</div> : null}
            <div className="gallery-grid">
              {results.map((image) => (
                <ImageThumb
                  key={image.id}
                  record={image}
                  onClick={() => setLightbox(image)}
                  overlay={
                    <div className="thumb-flag">
                      <Button size="sm" onClick={(event) => { event.stopPropagation(); setPickB(image); }}>Compare</Button>
                    </div>
                  }
                />
              ))}
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <div className="section-title"><h2>Source</h2></div>
            {source ? (
              <>
                <div className="thumb" style={{ aspectRatio: "1" }} onClick={() => setLightbox(source)} role="button" tabIndex={0}>
                  <img src={toFileUrl(source.path)} alt={source.file_name} />
                  <div className="thumb-meta"><span className="truncate">{source.file_name}</span><span className="mono">{source.width}×{source.height}</span></div>
                </div>
                <Button size="sm" icon="refresh" style={{ marginTop: 10 }} onClick={() => setPickerOpen(true)}>Change source</Button>
              </>
            ) : <div className="muted small">Pick an image from the library.</div>}
          </Card>
          <Card>
            <div className="section-title"><h2>Branching</h2></div>
            <p className="muted tiny" style={{ margin: 0 }}>
              Every variation is stored with its parent image id, so the edit history of a shot stays traceable in the Gallery.
            </p>
            <Button size="sm" variant="ghost" icon="image" style={{ marginTop: 10 }} onClick={() => useApp.getState().setRoute("gallery")}>Open gallery</Button>
          </Card>
        </div>
      </div>

      <Modal open={pickerOpen} title="Choose the source image" onClose={() => setPickerOpen(false)} wide>
        <div className="gallery-grid" style={{ maxHeight: "56vh", overflow: "auto" }}>
          {gallery.data?.items.map((image) => (
            <ImageThumb key={image.id} record={image} onClick={() => { setSource(image); setPickA(image); setPickerOpen(false); }} />
          ))}
        </div>
      </Modal>

      {lightbox ? (
        <Lightbox
          src={toFileUrl(lightbox.path)}
          title={lightbox.file_name}
          subtitle={`${lightbox.width}×${lightbox.height}`}
          onClose={() => setLightbox(null)}
          side={
            <div className="row wrap">
              <Button size="sm" icon="check" onClick={() => { setPickB(lightbox); setLightbox(null); }}>Compare as B</Button>
              <Button size="sm" icon="star" onClick={async () => { await api.imageFavorite(lightbox.id, true).catch(() => undefined); toast("Marked as favourite", "ok"); }}>Favourite</Button>
            </div>
          }
        />
      ) : null}
    </div>
  );
}
