import { faLabel } from "@aria/core";
import { useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, Icon, Input, Modal, Spinner, Textarea, Toggle } from "@aria/ui";
import { api, errorText, formatDate, toFileUrl, type Project } from "@aria/core";
import { useApp } from "../store";
import { useAction, useGallery, useProjects, useReferences } from "../lib/hooks";
import { PickerField, PageHeader } from "../components/shell";

export function ProjectsPage() {
  const boot = useApp((state) => state.boot);
  const refresh = useApp((state) => state.refresh);
  const saveSettings = useApp((state) => state.saveSettings);
  const toast = useApp((state) => state.toast);
  const setRoute = useApp((state) => state.setRoute);
  const projects = useProjects();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState<Project | null>(null);
  const [archiving, setArchiving] = useState<Project | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restorePath, setRestorePath] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(boot?.settings.active_project_id ?? null);
  const [refPath, setRefPath] = useState("");
  const [refRole, setRefRole] = useState("reference");

  const activeId = boot?.settings.active_project_id ?? "";
  const list = useMemo(
    () => (projects.data ?? []).filter((project) => showArchived || !project.archived),
    [projects.data, showArchived],
  );
  const selected = (projects.data ?? []).find((project) => project.id === (selectedId ?? activeId)) ?? list[0];
  const references = useReferences(selected?.id ?? "");
  const gallery = useGallery({ project_id: selected?.id ?? "", limit: 8, sort: "newest" });

  const create = useAction((projectName: string, projectDescription: string) => api.projectCreate(projectName, projectDescription), {
    success: "پروژه و پوشه‌های آن ساخته شد",
    onDone: () => { setCreating(false); setName(""); setDescription(""); projects.refetch(); },
  });

  const update = useAction((project: Project) => api.projectUpdate(project.id, project.name, project.description, project.output_dir), {
    success: "پروژه به‌روز شد",
    onDone: () => { setEditing(null); projects.refetch(); void refresh(); },
  });

  const backup = useAction((id: string) => api.projectBackup(id), {
    success: (result) => `پشتیبان ساخته شد: ${result.files} فایل`,
  });

  return (
    <div className="page fade-in">
      <PageHeader
        title="پروژه‌ها"
        description="هر پروژه پوشه‌ها، مرجع‌ها، پرامپت‌ها و خروجی‌های خودش را دارد. حذف فایل فقط با تأیید صریح شما انجام می‌شود."
        actions={
          <>
            <Button icon="refresh" onClick={() => projects.refetch()}>تازه‌سازی</Button>
            <Button icon="download" onClick={() => setRestoreOpen(true)}>بازیابی پشتیبان</Button>
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>پروژه جدید</Button>
          </>
        }
      />

      <div className="grid split-left">
        <Card>
          <div className="section-title">
            <h2>همه پروژه‌ها</h2>
            <div className="row" style={{ gap: 8 }}>
              <Toggle checked={showArchived} onChange={setShowArchived} label="نمایش بایگانی‌شده‌ها" />
              <span className="tiny muted">بایگانی‌شده</span>
            </div>
          </div>
          {projects.isLoading ? <Spinner label="در حال بارگذاری پروژه‌ها…" /> : null}
          {list.length === 0 && !projects.isLoading ? (
            <EmptyState icon="folder" title="پروژه‌ای نیست" description="برای قراردادن مرجع‌ها، توضیحات و تصاویر در یک پوشه، پروژه بسازید." />
          ) : null}
          <div className="list">
            {list.map((project) => (
              <button key={project.id} className="wf-row" data-active={project.id === selected?.id ? "true" : "false"} onClick={() => setSelectedId(project.id)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="small strong truncate">{project.name}</span>
                    {project.id === activeId ? <Badge tone="accent">فعال</Badge> : null}
                    {project.archived ? <Badge>بایگانی‌شده</Badge> : null}
                  </div>
                  <div className="tiny muted truncate">{project.description || "بدون توضیح"}</div>
                  <div className="tiny dim">{formatDate(project.created_at)}</div>
                </div>
                <Icon name="chevronRight" size={13} />
              </button>
            ))}
          </div>
        </Card>

        <div className="stack">
          {selected ? (
            <>
              <Card>
                <div className="section-title">
                  <h2>{selected.name}</h2>
                  <div className="row" style={{ gap: 6 }}>
                    {selected.id !== activeId ? (
                      <Button size="sm" icon="check" onClick={async () => {
                        try { await saveSettings({ active_project_id: selected.id }); toast("پروژه فعال تغییر کرد", "ok"); projects.refetch(); }
                        catch (error) { toast(errorText(error), "err"); }
                      }}>فعال‌کردن پروژه</Button>
                    ) : <Badge tone="accent">پروژه فعال</Badge>}
                    <Button size="sm" icon="edit" onClick={() => setEditing(selected)}>ویرایش</Button>
                    <Button size="sm" icon="download" loading={backup.isPending} onClick={() => backup.mutate([selected.id])}>پشتیبان‌گیری</Button>
                    <Button size="sm" icon="folder" onClick={() => void api.openPath(selected.dir || selected.output_dir).catch(() => undefined)}>بازکردن پوشه</Button>
                    <Button size="sm" variant="ghost" icon="archive" onClick={() => setArchiving(selected)}>{selected.archived ? "خارج‌کردن از بایگانی" : "بایگانی"}</Button>
                  </div>
                </div>
                <p className="muted small" style={{ marginTop: 0 }}>{selected.description || "توضیحی نیست؛ از دکمه ویرایش برای شرح هدف پروژه استفاده کنید."}</p>
                <div className="grid cols-4">
                  <div><div className="tiny muted">تصاویر</div><div className="strong">{selected.image_count}</div></div>
                  <div><div className="tiny muted">مرجع‌ها</div><div className="strong">{references.data?.length ?? 0}</div></div>
                  <div><div className="tiny muted">کارهای صف</div><div className="strong">{selected.job_count}</div></div>
                  <div><div className="tiny muted">تاریخ ساخت</div><div className="strong small">{formatDate(selected.created_at)}</div></div>
                </div>
                <div className="divider" style={{ margin: "12px 0" }} />
                <div className="tiny muted">پوشه خروجی</div>
                <div className="mono-path">{selected.output_dir || selected.dir}</div>
              </Card>

              <Card>
                <div className="section-title"><h2>مرجع‌ها</h2><span>{references.data?.length ?? 0} فایل</span></div>
                <div className="grid cols-3" style={{ marginBottom: 10 }}>
                  <div style={{ gridColumn: "span 2" }}>
                    <PickerField label="افزودن تصویر مرجع" mode="file" value={refPath} onChange={setRefPath} filter={(entry) => entry.is_image} />
                  </div>
                  <div className="field">
                    <span className="field-label">نقش مرجع</span>
                    <Input value={refRole} onChange={(event) => setRefRole(event.target.value)} placeholder="سبک، موضوع، محصول" />
                  </div>
                </div>
                <Button size="sm" icon="plus" disabled={!refPath} onClick={async () => {
                  try {
                    await api.referenceAdd(refPath, selected.id, refRole || "reference");
                    toast("تصویر مرجع در پروژه کپی شد", "ok");
                    setRefPath("");
                    references.refetch();
                    projects.refetch();
                  } catch (error) { toast(errorText(error), "err"); }
                }}>افزودن مرجع</Button>
                <div className="gallery-grid" style={{ marginTop: 12 }}>
                  {references.data?.map((reference) => (
                    <div key={reference.id} className="thumb">
                      <img src={toFileUrl(reference.thumb_path || reference.path)} alt={faLabel(reference.role)} loading="lazy" />
                      <div className="thumb-meta"><span className="truncate">{faLabel(reference.role)}</span><span className="mono">{reference.width}×{reference.height}</span></div>
                      <button className="thumb-select" aria-label="حذف مرجع" onClick={async () => {
                        try { await api.referenceDelete(reference.id); toast("مرجع حذف شد", "ok"); references.refetch(); }
                        catch (error) { toast(errorText(error), "err"); }
                      }}><Icon name="close" size={11} /></button>
                    </div>
                  ))}
                </div>
                {references.data && references.data.length === 0 ? <div className="muted small">هنوز مرجعی نیست. تصاویر مرجع همراه ورودی برای Codex فرستاده می‌شوند.</div> : null}
              </Card>

              <Card>
                <div className="section-title"><h2>تصاویر اخیر</h2><Button size="sm" variant="ghost" icon="chevronRight" onClick={() => setRoute("gallery")}>گالری</Button></div>
                <div className="gallery-grid">
                  {gallery.data?.items.map((image) => (
                    <div key={image.id} className="thumb" onClick={() => { useApp.getState().setHandoff({ imageId: image.id, imagePath: image.path }); setRoute("edit"); }} role="button" tabIndex={0}>
                      <img src={toFileUrl(image.thumb_path || image.path)} alt={image.file_name} loading="lazy" />
                      <div className="thumb-meta"><span className="truncate">{image.file_name}</span><span className="mono">{image.width}×{image.height}</span></div>
                    </div>
                  ))}
                </div>
                {gallery.data && gallery.data.items.length === 0 ? <div className="muted small">هنوز در این پروژه تصویری ساخته نشده است.</div> : null}
              </Card>
            </>
          ) : <Card><div className="muted small">یک پروژه انتخاب کنید.</div></Card>}
        </div>
      </div>

      <Modal open={creating} title="پروژه جدید" subtitle="پوشه‌های پروژه روی دیسک ساخته می‌شود" onClose={() => setCreating(false)}
        footer={<>
          <Button variant="ghost" onClick={() => setCreating(false)}>لغو</Button>
          <Button variant="primary" loading={create.isPending} disabled={!name.trim()} onClick={() => create.mutate([name, description])}>ساختن</Button>
        </>}
      >
        <div className="stack">
          <div className="field"><span className="field-label">نام</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="کارزار پاییزی" /></div>
          <div className="field"><span className="field-label">توضیحات</span><Textarea value={description} onChange={(event) => setDescription(event.target.value)} style={{ minHeight: 70 }} /></div>
          <div className="field-hint">پوشه‌های ورودی، مرجع، تصاویر ساخته‌شده، نسخه‌ها، ویرایش‌ها و خروجی‌ها ساخته می‌شوند.</div>
        </div>
      </Modal>

      <Modal open={Boolean(editing)} title="ویرایش پروژه" onClose={() => setEditing(null)}
        footer={<>
          <Button variant="ghost" onClick={() => setEditing(null)}>لغو</Button>
          <Button variant="primary" loading={update.isPending} onClick={() => { if (editing) update.mutate([editing]); }}>ذخیره</Button>
        </>}
      >
        {editing ? (
          <div className="stack">
            <div className="field"><span className="field-label">نام</span><Input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></div>
            <div className="field"><span className="field-label">توضیحات</span><Textarea value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} style={{ minHeight: 70 }} /></div>
            <div className="field"><span className="field-label">پوشه خروجی دلخواه</span><Input value={editing.output_dir} onChange={(event) => setEditing({ ...editing, output_dir: event.target.value })} placeholder="پیش‌فرض: پوشه تصاویر ساخته‌شده پروژه" /></div>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(archiving)} title={archiving?.archived ? "خارج‌کردن پروژه از بایگانی" : "بایگانی پروژه"} onClose={() => setArchiving(null)}
        footer={<>
          <Button variant="ghost" onClick={() => setArchiving(null)}>لغو</Button>
          <Button variant="primary" onClick={async () => {
            if (!archiving) return;
            try {
              await api.projectArchive(archiving.id, !archiving.archived);
              toast(archiving.archived ? "پروژه بازیابی شد" : "پروژه بایگانی شد", "ok");
              setArchiving(null);
              projects.refetch();
            } catch (error) { toast(errorText(error), "err"); }
          }}>{archiving?.archived ? "خارج‌کردن از بایگانی" : "بایگانی"}</Button>
        </>}
      >
        <p className="small muted">
          {archiving?.archived
            ? "پروژه دوباره نمایش داده می‌شود و قابل انتخاب است؛ فایل‌ها تغییر نمی‌کنند."
            : "بایگانی پروژه را از فهرست انتخاب پنهان می‌کند و فایلی حذف نمی‌شود؛ بعداً می‌توانید آن را برگردانید."}
        </p>
      </Modal>

      <Modal open={restoreOpen} title="بازیابی پشتیبان پروژه" subtitle="محتوای پشتیبان در پروژه جدید کپی می‌شود" onClose={() => setRestoreOpen(false)}
        footer={<>
          <Button variant="ghost" onClick={() => setRestoreOpen(false)}>لغو</Button>
          <Button variant="primary" disabled={!restorePath} onClick={async () => {
            try {
              const result = await api.projectRestore(restorePath);
              toast(`${result.files} فایل در ${result.restored_into} بازیابی شد`, "ok");
              setRestoreOpen(false);
              setRestorePath("");
              projects.refetch();
            } catch (error) { toast(errorText(error), "err"); }
          }}>بازیابی</Button>
        </>}
      >
        <PickerField label="پوشه پشتیبان" mode="dir" value={restorePath} onChange={setRestorePath} />
        <p className="muted tiny" style={{ marginTop: 10 }}>
          پشتیبان‌ها در این مسیر هستند: <span className="mono">{boot?.paths.backups ?? "%LOCALAPPDATA%\\ARIA\\ImageStudio\\Backups"}</span>. بازیابی هیچ پروژه موجودی را بازنویسی نمی‌کند.
        </p>
      </Modal>
    </div>
  );
}
