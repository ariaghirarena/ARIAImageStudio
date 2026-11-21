import { ImportImageButton } from "../components/ImportImage";
import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Icon, Input, Lightbox, Modal, Select, Spinner, Textarea, Toggle, useDebounced } from "@aria/ui";
import { api, errorText, formatBytes, formatDate, toFileUrl, type ImageRecord } from "@aria/core";
import { useApp } from "../store";
import { useGallery, useProjects } from "../lib/hooks";
import { PageHeader } from "../components/shell";

export function GalleryPage() {
  const toast = useApp((state) => state.toast);
  const setRoute = useApp((state) => state.setRoute);
  const setHandoff = useApp((state) => state.setHandoff);
  const projects = useProjects();

  const [search, setSearch] = useState("");
  const [projectId, setProjectId] = useState("");
  const [format, setFormat] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sort, setSort] = useState("newest");
  const [pageSize, setPageSize] = useState(60);
  const [selected, setSelected] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState<ImageRecord | null>(null);
  const [note, setNote] = useState("");
  const [tags, setTags] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [pattern, setPattern] = useState("{name}-{index}");
  const [dupesOpen, setDupesOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ImageRecord | null>(null);
  const [bulkDelete, setBulkDelete] = useState(false);
  const debouncedSearch = useDebounced(search, 260);

  const gallery = useGallery({ project_id: projectId, search: debouncedSearch, format, favorite_only: favoritesOnly, sort, limit: pageSize, offset: 0 });

  useEffect(() => {
    if (!lightbox) return;
    setNote(lightbox.note);
    try {
      const parsed = JSON.parse(lightbox.tags_json || "[]");
      setTags(Array.isArray(parsed) ? parsed.join(", ") : "");
    } catch {
      setTags("");
    }
  }, [lightbox]);

  const items = gallery.data?.items ?? [];
  const total = gallery.data?.total ?? 0;
  const allSelected = items.length > 0 && selected.length === items.length;

  const toggleSelect = (id: string) => setSelected((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]);

  const applyTags = async () => {
    if (!lightbox) return;
    const list = tags.split(",").map((tag) => tag.trim()).filter(Boolean);
    try {
      await api.imageTags(lightbox.id, list);
      toast("برچسب‌ها به‌روزرسانی شد", "ok");
      gallery.refetch();
      setLightbox({ ...lightbox, tags_json: JSON.stringify(list) });
    } catch (error) { toast(errorText(error), "err"); }
  };

  return (
    <div className="page fade-in">
      <PageHeader
        title="گالری تصاویر"
        description={`${total} تصویر ثبت شده است · تصویرهای کوچک و کد تأیید فایل‌ها روی همین کامپیوتر ساخته می‌شود.`}
        actions={
          <>
            <ImportImageButton projectId={projectId || undefined} onImported={(image) => { setSearch(""); setFormat(""); setFavoritesOnly(false); setLightbox(image); }} />
            <Button icon="layers" onClick={() => setDupesOpen(true)}>یافتن تکراری‌ها</Button>
            <Button icon="refresh" onClick={() => gallery.refetch()}>تازه‌سازی</Button>
            <Button variant="primary" icon="sparkles" onClick={() => setRoute("create")}>تصویر جدید</Button>
          </>
        }
      />

      <Card tight>
        <div className="gal-toolbar">
          <div className="search-box">
            <Icon name="search" size={14} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جستجو در نام فایل، پرامپت، یادداشت یا برچسب…" />
          </div>
          <Select value={projectId} onChange={(event) => setProjectId(event.target.value)} aria-label="پروژه"
            options={[{ value: "", label: "همه پروژه‌ها" }, ...(projects.data ?? []).map((project) => ({ value: project.id, label: project.name }))]} />
          <Select value={format} onChange={(event) => setFormat(event.target.value)} aria-label="فرمت"
            options={[{ value: "", label: "همه فرمت‌ها" }, { value: "png", label: "PNG" }, { value: "jpg", label: "JPEG" }, { value: "webp", label: "WebP" }, { value: "gif", label: "GIF" }]} />
          <Select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="مرتب‌سازی"
            options={[{ value: "newest", label: "جدیدترین" }, { value: "oldest", label: "قدیمی‌ترین" }, { value: "largest", label: "بزرگ‌ترین" }, { value: "name", label: "نام" }]} />
          <div className="row" style={{ gap: 8 }}>
            <Toggle checked={favoritesOnly} onChange={setFavoritesOnly} label="فقط علاقه‌مندی‌ها" />
            <span className="small">علاقه‌مندی‌ها</span>
          </div>
          <span className="spacer" />
          {selected.length > 0 ? (
            <div className="row" style={{ gap: 6 }}>
              <Badge tone="accent">{selected.length} انتخاب شده</Badge>
              <Button size="sm" icon="edit" onClick={() => setRenameOpen(true)}>تغییر نام</Button>
              <Button size="sm" icon="trash" variant="danger" onClick={() => setBulkDelete(true)}>حذف</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected([])}>پاک‌کردن انتخاب</Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" icon="check" onClick={() => setSelected(allSelected ? [] : items.map((image) => image.id))}>
              {allSelected ? "حذف همه انتخاب‌ها" : "انتخاب همه"}
            </Button>
          )}
        </div>
      </Card>

      {gallery.isLoading ? <Spinner label="در حال بارگذاری تصاویر…" /> : null}
      {gallery.isError ? <div className="banner err"><Icon name="alert" size={14} /><span>{errorText(gallery.error)}</span></div> : null}

      {items.length === 0 && !gallery.isLoading ? (
        <EmptyState
          icon="image"
          title={search || favoritesOnly || format || projectId ? "تصویری با این فیلترها نیست" : "گالری خالی است"}
          description={search || favoritesOnly || format || projectId ? "فیلترها را پاک کنید یا عبارت دیگری جستجو کنید." : "تصاویر ساخته‌شده، ویرایش‌شده و واردشده با پرامپتشان خودکار اینجا ثبت می‌شود."}
          action={<Button variant="primary" icon="sparkles" onClick={() => setRoute("create")}>ساخت اولین تصویر</Button>}
        />
      ) : (
        <div className="gallery-grid" style={{ marginTop: 14 }}>
          {items.map((image) => (
            <div key={image.id} className="thumb" data-selected={selected.includes(image.id) ? "true" : "false"} onClick={() => setLightbox(image)} role="button" tabIndex={0}>
              <img src={toFileUrl(image.thumb_path || image.path)} alt={image.file_name} loading="lazy" />
              <div className="thumb-meta">
                <span className="truncate">{image.file_name}</span>
                <span className="mono">{image.width}×{image.height}</span>
              </div>
              <button
                className="thumb-select"
                onClick={(event) => { event.stopPropagation(); toggleSelect(image.id); }}
                aria-label="انتخاب تصویر"
              >
                <Icon name={selected.includes(image.id) ? "check" : "circle"} size={11} />
              </button>
              {image.favorite ? <span className="thumb-fav"><Icon name="star" size={12} /></span> : null}
            </div>
          ))}
        </div>
      )}

      {items.length < total ? (
        <div className="row" style={{ marginTop: 16, justifyContent: "center" }}>
          <Button icon="chevronDown" onClick={() => setPageSize((value) => value + 60)}>نمایش بیشتر ({total - items.length} تصویر دیگر)</Button>
        </div>
      ) : null}

      {lightbox ? (
        <Lightbox
          src={toFileUrl(lightbox.path)}
          title={lightbox.file_name}
          subtitle={`${lightbox.width}×${lightbox.height} · ${lightbox.format.toUpperCase()} · ${formatBytes(lightbox.size_bytes)} · ${formatDate(lightbox.created_at)}`}
          onClose={() => setLightbox(null)}
          side={
            <div className="stack" style={{ gap: 12 }}>
              <div>
                <div className="tiny muted" style={{ marginBottom: 4 }}>پرامپت</div>
                <div className="small" style={{ whiteSpace: "pre-wrap", maxHeight: 150, overflow: "auto", color: "var(--text-soft)" }}>{lightbox.prompt || "—"}</div>
              </div>
              <div className="field">
                <span className="field-label">برچسب‌ها</span>
                <Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="محصول، استودیو، زمستان" />
                <Button size="sm" onClick={() => void applyTags()} style={{ marginTop: 6 }}>ذخیره برچسب‌ها</Button>
              </div>
              <div className="field">
                <span className="field-label">یادداشت</span>
                <Textarea value={note} onChange={(event) => setNote(event.target.value)} style={{ minHeight: 60 }} />
                <Button size="sm" style={{ marginTop: 6 }} onClick={async () => {
                  try { await api.imageNote(lightbox.id, note); toast("یادداشت ذخیره شد", "ok"); gallery.refetch(); } catch (error) { toast(errorText(error), "err"); }
                }}>ذخیره یادداشت</Button>
              </div>
              <div className="row wrap" style={{ gap: 6 }}>
                <Button size="sm" icon="star" onClick={async () => {
                  try { await api.imageFavorite(lightbox.id, !lightbox.favorite); gallery.refetch(); setLightbox({ ...lightbox, favorite: !lightbox.favorite }); } catch (error) { toast(errorText(error), "err"); }
                }}>{lightbox.favorite ? "حذف از علاقه‌مندی" : "علاقه‌مندی"}</Button>
                <Button size="sm" icon="wand" onClick={() => { setHandoff({ imageId: lightbox.id, imagePath: lightbox.path }); setRoute("edit"); }}>ویرایش</Button>
                <Button size="sm" icon="layers" onClick={() => { setHandoff({ imageId: lightbox.id, imagePath: lightbox.path }); setRoute("variations"); }}>ساخت نسخه</Button>
                <Button size="sm" icon="folder" onClick={() => void api.openPath(lightbox.path).catch(() => undefined)}>نمایش در پوشه</Button>
                <Button size="sm" variant="danger" icon="trash" onClick={() => setDeleteTarget(lightbox)}>حذف</Button>
              </div>
              <div className="tiny dim mono truncate">sha256 {lightbox.sha256.slice(0, 24)}…</div>
            </div>
          }
        />
      ) : null}

      <Modal open={renameOpen} title="تغییر نام گروهی" subtitle={`${selected.length} تصویر`} onClose={() => setRenameOpen(false)}
        footer={<>
          <Button variant="ghost" onClick={() => setRenameOpen(false)}>لغو</Button>
          <Button variant="primary" icon="edit" onClick={async () => {
            try {
              const result = await api.bulkRename(selected, pattern);
              toast(`${result.renamed} فایل تغییر نام داد`, "ok");
              setRenameOpen(false);
              setSelected([]);
              gallery.refetch();
            } catch (error) { toast(errorText(error), "err"); }
          }}>تغییر نام فایل‌ها</Button>
        </>}
      >
        <div className="field">
          <span className="field-label">الگو</span>
          <Input value={pattern} onChange={(event) => setPattern(event.target.value)} />
          <div className="field-hint">متغیرها: <span className="mono">{"{name}"}</span> نام اصلی فایل، <span className="mono">{"{index}"}</span> شماره ترتیب، <span className="mono">{"{date}"}</span> تاریخ ساخت. نام فایل روی دیسک و در فهرست تغییر می‌کند.</div>
        </div>
      </Modal>

      <Modal open={bulkDelete} title="حذف تصاویر انتخاب‌شده" subtitle={`${selected.length} تصویر`} onClose={() => setBulkDelete(false)}
        footer={<>
          <Button variant="ghost" onClick={() => setBulkDelete(false)}>لغو</Button>
          <Button variant="danger" icon="trash" onClick={async () => {
            try {
              for (const id of selected) await api.imageDelete(id, true);
              toast(`${selected.length} تصویر حذف شد`, "ok");
              setSelected([]);
              setBulkDelete(false);
              gallery.refetch();
            } catch (error) { toast(errorText(error), "err"); }
          }}>حذف دائمی</Button>
        </>}
      >
        <p className="small muted">فایل‌ها از دیسک و فهرست حذف می‌شوند و قابل بازگشت نیستند؛ اول خروجی بگیرید.</p>
      </Modal>

      <Modal open={Boolean(deleteTarget)} title="حذف تصویر" onClose={() => setDeleteTarget(null)}
        footer={<>
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>لغو</Button>
          <Button variant="danger" icon="trash" onClick={async () => {
            if (!deleteTarget) return;
            try {
              await api.imageDelete(deleteTarget.id, true);
              toast("تصویر حذف شد", "ok");
              setDeleteTarget(null);
              setLightbox(null);
              gallery.refetch();
            } catch (error) { toast(errorText(error), "err"); }
          }}>حذف فایل و رکورد</Button>
        </>}
      >
        <p className="small muted truncate">{deleteTarget?.file_name}</p>
      </Modal>

      <Modal open={dupesOpen} title="یافتن فایل‌های تکراری" subtitle="شناسایی محتوای یکسان با کد SHA-256" onClose={() => setDupesOpen(false)} wide>
        <DuplicateList onDone={() => setDupesOpen(false)} />
      </Modal>
    </div>
  );
}

function DuplicateList({ onDone }: { onDone: () => void }) {
  const [state, setState] = useState<{ loading: boolean; groups: { sha256: string; copies: number; paths: string }[]; error: string }>({ loading: true, groups: [], error: "" });

  useEffect(() => {
    let alive = true;
    void api.imagesDuplicates()
      .then((result) => { if (alive) setState({ loading: false, groups: result.groups, error: "" }); })
      .catch((error) => { if (alive) setState({ loading: false, groups: [], error: errorText(error) }); });
    return () => { alive = false; };
  }, []);

  if (state.loading) return <Spinner label="در حال بررسی کتابخانه…" />;
  if (state.error) return <div className="banner err"><Icon name="alert" size={14} /><span>{state.error}</span></div>;
  if (state.groups.length === 0) return <div className="muted small">فایل تکراری پیدا نشد — همه فایل‌ها کد تأیید متفاوت دارند.</div>;

  return (
    <div className="stack">
      {state.groups.map((group) => (
        <Card key={group.sha256} tight>
          <div className="row between" style={{ marginBottom: 6 }}>
            <span className="mono tiny truncate">{group.sha256.slice(0, 32)}…</span>
            <Badge tone="warn">{group.copies} نسخه</Badge>
          </div>
          <div className="mono-path">{group.paths}</div>
        </Card>
      ))}
      <Button size="sm" onClick={onDone}>تمام</Button>
    </div>
  );
}
