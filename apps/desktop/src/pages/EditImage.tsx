import { ImportImageButton } from "../components/ImportImage";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, CompareSlider, Icon, Lightbox, Modal, Select, Slider, Spinner, Textarea, Toggle } from "@aria/ui";
import { api, errorText, formatDuration, toFileUrl, type ImageRecord } from "@aria/core";
import { useApp } from "../store";
import { useAction, useGallery } from "../lib/hooks";
import { ImageThumb, PageHeader } from "../components/shell";

const EDIT_PRESETS = [
  { id: "background", label: "تعویض پس‌زمینه", instruction: "replace the background with a clean, softly lit studio set that matches the subject's existing light direction" },
  { id: "remove", label: "حذف یک عنصر", instruction: "remove the described unwanted element and reconstruct the area naturally behind it" },
  { id: "add", label: "افزودن عنصر", instruction: "add the described element, matching perspective, scale and lighting" },
  { id: "recolor", label: "تغییر رنگ", instruction: "change the colour of the described object only, keeping material and highlights" },
  { id: "relight", label: "تغییر نور", instruction: "relight the scene with soft directional light from the left, keeping every object and the framing identical" },
  { id: "angle", label: "تغییر زاویه", instruction: "re-render the same scene from a slightly lower camera angle while keeping all products and styling identical" },
  { id: "style", label: "تغییر سبک", instruction: "restyle the image while keeping the subject, pose and composition exactly the same" },
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
  const [invariants, setInvariants] = useState("هویت موضوع، شکل، حالت و کادربندی را بدون تغییر نگه دار");
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
      success: "نسخه جدید ساخته شد — تصویر اصلی دست نخورده ماند",
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
      toast("اول یک تصویر انتخاب کنید", "err");
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
        toast(`ویرایش در ${formatDuration(outcome.duration_ms)} تمام شد`, "ok");
        gallery.refetch();
      } else {
        toast(outcome.error || "تصویر ویرایش‌شده‌ای ساخته نشد", "err");
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
        title="ویرایش تصویر"
        description="دو راه واقعی: ویرایش با موتور (با پرامپت، بدون تغییر هویت تصویر) یا تنظیمات محلی که تصویر اصلی را تغییر نمی‌دهد."
        actions={
          <>
            <ImportImageButton onImported={(image) => { setSource(image); setResult(null); setHandoff({}); }} />
            <Button icon="image" onClick={() => setSelectOpen(true)}>انتخاب تصویر</Button>
            <Button variant="primary" icon="wand" loading={running} disabled={!source} onClick={() => void generateEdit()}>ساخت ویرایش</Button>
          </>
        }
      />

      <div className="grid split-left">
        <Card>
          <div className="section-title"><h2>تصویر اصلی</h2>{source ? <Badge tone="accent">{source.format.toUpperCase()}</Badge> : null}</div>
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
              <Button size="sm" variant="ghost" icon="refresh" onClick={() => setSelectOpen(true)}>انتخاب تصویر دیگر</Button>
            </div>
          ) : gallery.isLoading ? <Spinner label="در حال بارگذاری گالری…" /> : <div className="muted small">هنوز تصویری در کتابخانه نیست.</div>}
        </Card>

        <div className="stack">
          <Card>
            <div className="section-title"><h2>ویرایش با موتور</h2><span>ابزار داخلی image_gen</span></div>
            <div className="preset-chips" style={{ marginBottom: 10 }}>
              {EDIT_PRESETS.map((preset) => (
                <button key={preset.id} className="preset-chip" data-active={presetId === preset.id ? "true" : "false"} onClick={() => { setPresetId(preset.id); setInstruction(preset.instruction); }}>
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="field">
              <span className="field-label">فقط این را تغییر بده</span>
              <Textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="تغییری که می‌خواهید را بنویسید" style={{ minHeight: 74 }} />
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <span className="field-label">این‌ها دست نخورند</span>
              <Textarea value={invariants} onChange={(event) => setInvariants(event.target.value)} style={{ minHeight: 58 }} />
            </div>
            {log.length > 0 ? <div className="log-view" style={{ marginTop: 10, maxHeight: 140 }}>{log.join("\n")}</div> : null}
          </Card>

          <Card>
            <div className="section-title"><h2>تنظیمات محلی</h2><span>بدون تغییر اصل · فایل جدید می‌سازد</span></div>
            <div className="grid cols-2">
              <Slider label="روشنایی" value={brightness} min={-80} max={80} onChange={setBrightness} />
              <Slider label="کنتراست" value={contrast} min={0.4} max={2} step={0.05} onChange={setContrast} />
              <Slider label="اشباع رنگ" value={saturation} min={0} max={2} step={0.05} onChange={setSaturation} />
              <Slider label="وضوح (شارپن)" value={sharpen} min={0} max={4} step={0.1} onChange={setSharpen} />
              <Slider label="بزرگ‌نمایی" value={scale} min={1} max={4} step={0.1} onChange={setScale} />
              <Slider label="حساسیت حذف پس‌زمینه" value={tolerance} min={2} max={40} onChange={setTolerance} />
            </div>
            <div className="row wrap" style={{ marginTop: 12, gap: 16 }}>
              <div className="row" style={{ gap: 8 }}><Toggle checked={denoise} onChange={setDenoise} label="حذف نویز" /><span className="small">حذف نویز میانه</span></div>
              <div className="row" style={{ gap: 8 }}><Toggle checked={removeBg} onChange={setRemoveBg} label="حذف پس‌زمینه" /><span className="small">برش با کلید رنگ</span></div>
            </div>
            <div className="grid cols-2" style={{ marginTop: 12 }}>
              <Select value={format} onChange={(event) => setFormat(event.target.value)} aria-label="فرمت" options={[{ value: "png", label: "PNG" }, { value: "jpg", label: "JPEG" }, { value: "webp", label: "WebP" }]} />
              <Slider label="کیفیت" value={quality} min={40} max={100} onChange={setQuality} />
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <Button variant="primary" icon="sliders" loading={postProcess.isPending || processing} disabled={!source} onClick={() => {
                if (!source) return;
                setProcessing(true);
                postProcess.mutate([source.id]);
                window.setTimeout(() => setProcessing(false), 600);
              }}>
                اعمال محلی
              </Button>
              <span className="dim tiny">بزرگ‌نمایی با روش Lanczos است، نه هوش مصنوعی.</span>
            </div>
          </Card>

          {result ? (
            <Card>
              <div className="section-title"><h2>مقایسه قبل و بعد</h2><span>دسته را بکشید</span></div>
              {source ? <CompareSlider beforeSrc={toFileUrl(source.path)} afterSrc={toFileUrl(result.path)} alt={result.file_name} /> : null}
              <div className="row between" style={{ marginTop: 10 }}>
                <span className="tiny muted truncate">{result.file_name} · {result.width}×{result.height}</span>
                <div className="row" style={{ gap: 6 }}>
                  <Button size="sm" icon="eye" onClick={() => setLightbox(result)}>مشاهده</Button>
                  <Button size="sm" icon="folder" onClick={() => void api.openPath(result.path).catch(() => undefined)}>نمایش در پوشه</Button>
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      <Modal open={selectOpen} title="انتخاب تصویر اصلی" subtitle="فقط تصاویری که در ARIA ثبت شده‌اند" onClose={() => setSelectOpen(false)} wide>
        {gallery.data && gallery.data.items.length === 0 ? <div className="muted small">گالری خالی است.</div> : null}
        <ImportImageButton onImported={(image) => { setSource(image); setResult(null); setSelectOpen(false); setHandoff({}); }} />
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
            <Button size="sm" icon="wand" onClick={() => { setSource(lightbox); setLightbox(null); }}>استفاده به‌عنوان اصلی</Button>
            <Button size="sm" icon="folder" onClick={() => void api.openPath(lightbox.path).catch(() => undefined)}>نمایش در پوشه</Button>
          </div>}
        />
      ) : null}

      <div className="row" style={{ marginTop: 16, gap: 8 }}>
        <Icon name="info" size={13} />
        <span className="dim tiny">
          ویرایش با موتور به پشتیبانی حساب شما از ابزار داخلی بستگی دارد. ویرایش با ماسک واقعی در موتور در دسترس نیست و برنامه آن را پشتیبانی‌نشده اعلام می‌کند، نه اینکه تظاهر کند.
        </span>
      </div>
    </div>
  );
}
