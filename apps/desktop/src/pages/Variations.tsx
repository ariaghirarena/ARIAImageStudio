import { useEffect, useState } from "react";
import { Badge, Button, Card, CompareSlider, Lightbox, Modal, Select, Spinner } from "@aria/ui";
import { api, errorText, formatDuration, toFileUrl, type ImageRecord } from "@aria/core";
import { useApp } from "../store";
import { useGallery } from "../lib/hooks";
import { ImageThumb, PageHeader } from "../components/shell";

const AXES = [
  { id: "style", label: "سبک", instruction: "restyle the image in the requested visual style while keeping the subject, pose and framing identical" },
  { id: "colour", label: "رنگ", instruction: "shift the colour palette of the image while keeping every object, its position and the lighting shape unchanged" },
  { id: "background", label: "پس‌زمینه", instruction: "replace only the background with a variation that keeps the subject untouched and the light direction consistent" },
  { id: "lighting", label: "نور", instruction: "change the lighting mood only, keeping geometry, objects and framing identical" },
  { id: "angle", label: "زاویه دوربین", instruction: "render the same scene from a nearby camera angle, keeping all objects and their relationships intact" },
  { id: "minimal", label: "مینیمال", instruction: "produce a more minimal version of the same scene with fewer distractions, same subject and message" },
];

export function VariationsPage() {
  const settings = useApp((state) => state.settings);
  const toast = useApp((state) => state.toast);
  const handoff = useApp((state) => state.handoff);
  const gallery = useGallery({ limit: 120, sort: "newest" });

  const [source, setSource] = useState<ImageRecord | null>(null);
  const [axis, setAxis] = useState("style");
  const [styleHint, setStyleHint] = useState("سینمایی، نورهای گرم کهربایی، سایه‌های عمیق");
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
      toast("یک تصویر انتخاب کنید", "err");
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
        toast(outcome.error || "نسخه‌ای ساخته نشد", "err");
      } else {
        setResults(outcome.images);
        setPickB(outcome.images[0]);
        toast(`${outcome.images.length} نسخه در ${formatDuration(outcome.duration_ms)} ساخته شد`, "ok");
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
        title="تنوع تصویر"
        description="از یک تصویر موجود، در یک محور مشخص نسخه‌های جدید بسازید؛ مثلاً فقط سبک یا فقط نور عوض شود."
        actions={
          <>
            <Button icon="image" onClick={() => setPickerOpen(true)}>انتخاب تصویر اصلی</Button>
            <Button variant="primary" icon="layers" loading={running} onClick={() => void run()}>ساخت نسخه‌ها</Button>
          </>
        }
      />

      <div className="grid split">
        <div className="stack">
          <Card>
            <div className="section-title"><h2>محور تغییر</h2><span>هر بار فقط یک تغییر</span></div>
            <div className="preset-chips">
              {AXES.map((entry) => (
                <button key={entry.id} className="preset-chip" data-active={axis === entry.id ? "true" : "false"} onClick={() => setAxis(entry.id)}>{entry.label}</button>
              ))}
            </div>
            {axis === "style" ? (
              <div className="field" style={{ marginTop: 12 }}>
                <span className="field-label">جهت سبک</span>
                <input className="mono" style={{ background: "#fff", border: "1px solid var(--line-strong)", borderRadius: 10, padding: "9px 11px", direction: "ltr", textAlign: "left" }} value={styleHint} onChange={(event) => setStyleHint(event.target.value)} />
              </div>
            ) : null}
            <div className="row wrap" style={{ marginTop: 14 }}>
              <div style={{ width: 180 }}>
                <Select value={String(count)} onChange={(event) => setCount(Number(event.target.value))} aria-label="تعداد نسخه" options={[1, 2, 3, 4].map((value) => ({ value: String(value), label: `${value} نسخه` }))} />
              </div>
              <span className="dim tiny">هر نسخه یک فراخوانی جدا از موتور است.</span>
            </div>
          </Card>

          <Card>
            <div className="section-title"><h2>مقایسه</h2><span>دسته را بکشید</span></div>
            {pickA && pickB ? (
              <CompareSlider beforeSrc={toFileUrl(pickA.path)} afterSrc={toFileUrl(pickB.path)} alt="مقایسه نسخه‌ها" />
            ) : (
              <div className="muted small">دو تصویر انتخاب کنید (اصلی + نسخه) تا مقایسه شوند.</div>
            )}
            <div className="row wrap" style={{ marginTop: 10 }}>
              <Badge tone="info">الف: {pickA?.file_name ?? "—"}</Badge>
              <Badge tone="accent">ب: {pickB?.file_name ?? "—"}</Badge>
              {pickA && pickB ? (
                <Button size="sm" icon="activity" onClick={async () => {
                  try {
                    const metric = await api.imageCompare(pickA.path, pickB.path);
                    toast(metric.same_dimensions
                      ? `اختلاف میانگین ${metric.mean_absolute_difference.toFixed(2)} از ۲۵۵ ${metric.identical ? "(یکسان)" : ""}`
                      : "ابعاد دو تصویر فرق دارد — فقط مقایسه چشمی ممکن است", "info");
                  } catch (error) { toast(errorText(error), "err"); }
                }}>محاسبه اختلاف</Button>
              ) : null}
            </div>
          </Card>

          <Card>
            <div className="section-title"><h2>نتیجه‌ها</h2><span>{results.length} نسخه</span></div>
            {running ? <Spinner label="در حال ساخت نسخه‌ها…" /> : null}
            {results.length === 0 && !running ? <div className="muted small">نسخه‌ها بعد از اجرا اینجا نمایش داده می‌شود.</div> : null}
            <div className="gallery-grid">
              {results.map((image) => (
                <ImageThumb
                  key={image.id}
                  record={image}
                  onClick={() => setLightbox(image)}
                  overlay={
                    <div className="thumb-flag">
                      <Button size="sm" onClick={(event) => { event.stopPropagation(); setPickB(image); }}>مقایسه</Button>
                    </div>
                  }
                />
              ))}
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <div className="section-title"><h2>تصویر اصلی</h2></div>
            {source ? (
              <>
                <div className="thumb" style={{ aspectRatio: "1" }} onClick={() => setLightbox(source)} role="button" tabIndex={0}>
                  <img src={toFileUrl(source.path)} alt={source.file_name} />
                  <div className="thumb-meta"><span className="truncate">{source.file_name}</span><span className="mono">{source.width}×{source.height}</span></div>
                </div>
                <Button size="sm" icon="refresh" style={{ marginTop: 10 }} onClick={() => setPickerOpen(true)}>تغییر تصویر اصلی</Button>
              </>
            ) : <div className="muted small">یک تصویر از کتابخانه انتخاب کنید.</div>}
          </Card>
          <Card>
            <div className="section-title"><h2>تاریخچه نسخه‌ها</h2></div>
            <p className="muted tiny" style={{ margin: 0 }}>
              هر نسخه با شناسه تصویر اصلی ذخیره می‌شود، پس مسیر ویرایش هر عکس در گالری قابل ردیابی است.
            </p>
            <Button size="sm" variant="ghost" icon="image" style={{ marginTop: 10 }} onClick={() => useApp.getState().setRoute("gallery")}>بازکردن گالری</Button>
          </Card>
        </div>
      </div>

      <Modal open={pickerOpen} title="انتخاب تصویر اصلی" onClose={() => setPickerOpen(false)} wide>
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
              <Button size="sm" icon="check" onClick={() => { setPickB(lightbox); setLightbox(null); }}>مقایسه به‌عنوان ب</Button>
              <Button size="sm" icon="star" onClick={async () => { await api.imageFavorite(lightbox.id, true).catch(() => undefined); toast("به علاقه‌مندی‌ها اضافه شد", "ok"); }}>علاقه‌مندی</Button>
            </div>
          }
        />
      ) : null}
    </div>
  );
}
