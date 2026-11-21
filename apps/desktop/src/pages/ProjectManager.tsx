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
    success: "Project created with its folder structure",
    onDone: () => { setCreating(false); setName(""); setDescription(""); projects.refetch(); },
  });

  const update = useAction((project: Project) => api.projectUpdate(project.id, project.name, project.description, project.output_dir), {
    success: "Project updated",
    onDone: () => { setEditing(null); projects.refetch(); void refresh(); },
  });

  const backup = useAction((id: string) => api.projectBackup(id), {
    success: (result) => `Backup written: ${result.files} file(s)`,
  });

  return (
    <div className="page fade-in">
      <PageHeader
        title="Projects"
        description="A project owns a folder tree, its references, prompts and outputs. ARIA only deletes files you explicitly confirm."
        actions={
          <>
            <Button icon="refresh" onClick={() => projects.refetch()}>Refresh</Button>
            <Button icon="download" onClick={() => setRestoreOpen(true)}>Restore backup</Button>
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>New project</Button>
          </>
        }
      />

      <div className="grid split-left">
        <Card>
          <div className="section-title">
            <h2>All projects</h2>
            <div className="row" style={{ gap: 8 }}>
              <Toggle checked={showArchived} onChange={setShowArchived} label="Show archived" />
              <span className="tiny muted">archived</span>
            </div>
          </div>
          {projects.isLoading ? <Spinner label="Loading projects…" /> : null}
          {list.length === 0 && !projects.isLoading ? (
            <EmptyState icon="folder" title="No projects" description="Create one to group references, prompts and generated images under a single folder." />
          ) : null}
          <div className="list">
            {list.map((project) => (
              <button key={project.id} className="wf-row" data-active={project.id === selected?.id ? "true" : "false"} onClick={() => setSelectedId(project.id)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="small strong truncate">{project.name}</span>
                    {project.id === activeId ? <Badge tone="accent">active</Badge> : null}
                    {project.archived ? <Badge>archived</Badge> : null}
                  </div>
                  <div className="tiny muted truncate">{project.description || "no description"}</div>
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
                        try { await saveSettings({ active_project_id: selected.id }); toast("Active project switched", "ok"); projects.refetch(); }
                        catch (error) { toast(errorText(error), "err"); }
                      }}>Set active</Button>
                    ) : <Badge tone="accent">active project</Badge>}
                    <Button size="sm" icon="edit" onClick={() => setEditing(selected)}>Edit</Button>
                    <Button size="sm" icon="download" loading={backup.isPending} onClick={() => backup.mutate([selected.id])}>Backup</Button>
                    <Button size="sm" icon="folder" onClick={() => void api.openPath(selected.dir || selected.output_dir).catch(() => undefined)}>Open folder</Button>
                    <Button size="sm" variant="ghost" icon="archive" onClick={() => setArchiving(selected)}>{selected.archived ? "Unarchive" : "Archive"}</Button>
                  </div>
                </div>
                <p className="muted small" style={{ marginTop: 0 }}>{selected.description || "No description yet — use Edit to describe the project's purpose."}</p>
                <div className="grid cols-4">
                  <div><div className="tiny muted">Images</div><div className="strong">{selected.image_count}</div></div>
                  <div><div className="tiny muted">References</div><div className="strong">{references.data?.length ?? 0}</div></div>
                  <div><div className="tiny muted">Jobs</div><div className="strong">{selected.job_count}</div></div>
                  <div><div className="tiny muted">Created</div><div className="strong small">{formatDate(selected.created_at)}</div></div>
                </div>
                <div className="divider" style={{ margin: "12px 0" }} />
                <div className="tiny muted">Output folder</div>
                <div className="mono-path">{selected.output_dir || selected.dir}</div>
              </Card>

              <Card>
                <div className="section-title"><h2>References</h2><span>{references.data?.length ?? 0} asset(s)</span></div>
                <div className="grid cols-3" style={{ marginBottom: 10 }}>
                  <div style={{ gridColumn: "span 2" }}>
                    <PickerField label="Add a reference image" mode="file" value={refPath} onChange={setRefPath} filter={(entry) => entry.is_image} />
                  </div>
                  <div className="field">
                    <span className="field-label">Role</span>
                    <Input value={refRole} onChange={(event) => setRefRole(event.target.value)} placeholder="style, subject, product" />
                  </div>
                </div>
                <Button size="sm" icon="plus" disabled={!refPath} onClick={async () => {
                  try {
                    await api.referenceAdd(refPath, selected.id, refRole || "reference");
                    toast("Reference copied into the project", "ok");
                    setRefPath("");
                    references.refetch();
                    projects.refetch();
                  } catch (error) { toast(errorText(error), "err"); }
                }}>Add reference</Button>
                <div className="gallery-grid" style={{ marginTop: 12 }}>
                  {references.data?.map((reference) => (
                    <div key={reference.id} className="thumb">
                      <img src={toFileUrl(reference.thumb_path || reference.path)} alt={reference.role} loading="lazy" />
                      <div className="thumb-meta"><span className="truncate">{reference.role}</span><span className="mono">{reference.width}×{reference.height}</span></div>
                      <button className="thumb-select" aria-label="Remove reference" onClick={async () => {
                        try { await api.referenceDelete(reference.id); toast("Reference removed", "ok"); references.refetch(); }
                        catch (error) { toast(errorText(error), "err"); }
                      }}><Icon name="close" size={11} /></button>
                    </div>
                  ))}
                </div>
                {references.data && references.data.length === 0 ? <div className="muted small">No references yet. Reference images are passed to Codex as input images.</div> : null}
              </Card>

              <Card>
                <div className="section-title"><h2>Recent images</h2><Button size="sm" variant="ghost" icon="chevronRight" onClick={() => setRoute("gallery")}>Gallery</Button></div>
                <div className="gallery-grid">
                  {gallery.data?.items.map((image) => (
                    <div key={image.id} className="thumb" onClick={() => { useApp.getState().setHandoff({ imageId: image.id, imagePath: image.path }); setRoute("edit"); }} role="button" tabIndex={0}>
                      <img src={toFileUrl(image.thumb_path || image.path)} alt={image.file_name} loading="lazy" />
                      <div className="thumb-meta"><span className="truncate">{image.file_name}</span><span className="mono">{image.width}×{image.height}</span></div>
                    </div>
                  ))}
                </div>
                {gallery.data && gallery.data.items.length === 0 ? <div className="muted small">Nothing generated in this project yet.</div> : null}
              </Card>
            </>
          ) : <Card><div className="muted small">Select a project.</div></Card>}
        </div>
      </div>

      <Modal open={creating} title="New project" subtitle="Creates the folder tree on disk" onClose={() => setCreating(false)}
        footer={<>
          <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
          <Button variant="primary" loading={create.isPending} disabled={!name.trim()} onClick={() => create.mutate([name, description])}>Create</Button>
        </>}
      >
        <div className="stack">
          <div className="field"><span className="field-label">Name</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Autumn campaign" /></div>
          <div className="field"><span className="field-label">Description</span><Textarea value={description} onChange={(event) => setDescription(event.target.value)} style={{ minHeight: 70 }} /></div>
          <div className="field-hint">Folders created: Inputs, References, Generated, Variations, Edited, Exports.</div>
        </div>
      </Modal>

      <Modal open={Boolean(editing)} title="Edit project" onClose={() => setEditing(null)}
        footer={<>
          <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="primary" loading={update.isPending} onClick={() => { if (editing) update.mutate([editing]); }}>Save</Button>
        </>}
      >
        {editing ? (
          <div className="stack">
            <div className="field"><span className="field-label">Name</span><Input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></div>
            <div className="field"><span className="field-label">Description</span><Textarea value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} style={{ minHeight: 70 }} /></div>
            <div className="field"><span className="field-label">Output folder override</span><Input value={editing.output_dir} onChange={(event) => setEditing({ ...editing, output_dir: event.target.value })} placeholder="Defaults to the project Generated folder" /></div>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(archiving)} title={archiving?.archived ? "Unarchive project" : "Archive project"} onClose={() => setArchiving(null)}
        footer={<>
          <Button variant="ghost" onClick={() => setArchiving(null)}>Cancel</Button>
          <Button variant="primary" onClick={async () => {
            if (!archiving) return;
            try {
              await api.projectArchive(archiving.id, !archiving.archived);
              toast(archiving.archived ? "Project restored" : "Project archived", "ok");
              setArchiving(null);
              projects.refetch();
            } catch (error) { toast(errorText(error), "err"); }
          }}>{archiving?.archived ? "Unarchive" : "Archive"}</Button>
        </>}
      >
        <p className="small muted">
          {archiving?.archived
            ? "The project becomes visible and selectable again. No files are touched."
            : "Archiving hides the project from pickers but never deletes files. You can restore it later."}
        </p>
      </Modal>

      <Modal open={restoreOpen} title="Restore project backup" subtitle="Copies a backup folder into a new project" onClose={() => setRestoreOpen(false)}
        footer={<>
          <Button variant="ghost" onClick={() => setRestoreOpen(false)}>Cancel</Button>
          <Button variant="primary" disabled={!restorePath} onClick={async () => {
            try {
              const result = await api.projectRestore(restorePath);
              toast(`Restored ${result.files} file(s) into ${result.restored_into}`, "ok");
              setRestoreOpen(false);
              setRestorePath("");
              projects.refetch();
            } catch (error) { toast(errorText(error), "err"); }
          }}>Restore</Button>
        </>}
      >
        <PickerField label="Backup folder" mode="dir" value={restorePath} onChange={setRestorePath} />
        <p className="muted tiny" style={{ marginTop: 10 }}>
          Backups live under <span className="mono">{boot?.paths.backups ?? "%LOCALAPPDATA%\\ARIA\\ImageStudio\\Backups"}</span>. Restoring never overwrites an existing project.
        </p>
      </Modal>
    </div>
  );
}
