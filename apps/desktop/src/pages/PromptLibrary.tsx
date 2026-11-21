import { useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, Icon, Input, Modal, Select, Spinner, Textarea, Toggle } from "@aria/ui";
import { api, errorText, formatDate, type Prompt } from "@aria/core";
import { useApp } from "../store";
import { PickerField, PageHeader } from "../components/shell";
import { usePrompts, useProjects } from "../lib/hooks";

export function PromptLibraryPage() {
  const toast = useApp((state) => state.toast);
  const setRoute = useApp((state) => state.setRoute);
  const setHandoff = useApp((state) => state.setHandoff);
  const projects = useProjects();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [editing, setEditing] = useState<Prompt | null>(null);
  const [deleting, setDeleting] = useState<Prompt | null>(null);
  const [versionsFor, setVersionsFor] = useState<Prompt | null>(null);
  const [versions, setVersions] = useState<{ id: string; body: string; note: string; created_at: string }[]>([]);
  const [importPath, setImportPath] = useState("");
  const [exportPath, setExportPath] = useState("");
  const [busy, setBusy] = useState(false);
  const prompts = usePrompts(search);

  const categories = useMemo(() => {
    const set = new Set<string>();
    prompts.data?.forEach((prompt) => set.add(prompt.category || "general"));
    return [...set].sort();
  }, [prompts.data]);

  const items = (prompts.data ?? []).filter((prompt) => {
    if (favoritesOnly && !prompt.favorite) return false;
    if (category && prompt.category !== category) return false;
    return true;
  });

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await api.promptSave({
        id: editing.id,
        title: editing.title,
        body: editing.body,
        negative: editing.negative,
        category: editing.category,
        tags: safeTags(editing.tags_json),
        favorite: editing.favorite,
        project_id: editing.project_id,
      });
      toast("Prompt updated with a new version snapshot", "ok");
      setEditing(null);
      prompts.refetch();
    } catch (error) { toast(errorText(error), "err"); } finally { setBusy(false); }
  };

  const toggleFavorite = async (prompt: Prompt) => {
    try {
      await api.promptSave({
        id: prompt.id,
        title: prompt.title,
        body: prompt.body,
        negative: prompt.negative,
        category: prompt.category,
        tags: safeTags(prompt.tags_json),
        favorite: !prompt.favorite,
        project_id: prompt.project_id,
      });
      prompts.refetch();
    } catch (error) { toast(errorText(error), "err"); }
  };

  return (
    <div className="page fade-in">
      <PageHeader
        title="Prompt Library"
        description="A local, versioned prompt bank. Export/import uses plain JSON so you can move prompts between machines without a cloud account."
        actions={
          <>
            <Button icon="upload" onClick={async () => {
              if (!importPath) { toast("Choose a prompt JSON file first", "err"); return; }
              try {
                const result = await api.promptsImport(importPath);
                toast(`${result.imported} prompt(s) imported`, "ok");
                prompts.refetch();
              } catch (error) { toast(errorText(error), "err"); }
            }}>Import</Button>
            <Button icon="download" onClick={async () => {
              if (!exportPath) { toast("Choose an export folder first", "err"); return; }
              try {
                const result = await api.promptsExport(exportPath);
                toast(`Exported ${result.count} prompt(s) to ${result.path}`, "ok");
              } catch (error) { toast(errorText(error), "err"); }
            }}>Export</Button>
            <Button variant="primary" icon="plus" onClick={() => setRoute("prompt-studio")}>New prompt</Button>
          </>
        }
      />

      <Card tight>
        <div className="gal-toolbar">
          <div className="search-box">
            <Icon name="search" size={14} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, body or tags…" />
          </div>
          <Select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Category"
            options={[{ value: "", label: "All categories" }, ...categories.map((entry) => ({ value: entry, label: entry }))]} />
          <div className="row" style={{ gap: 8 }}>
            <Toggle checked={favoritesOnly} onChange={setFavoritesOnly} label="Favourites" />
            <span className="small">Favourites</span>
          </div>
          <span className="spacer" />
          <span className="tiny muted">{items.length} prompt(s)</span>
        </div>
      </Card>

      {prompts.isLoading ? <Spinner label="Loading prompts…" /> : null}
      {items.length === 0 && !prompts.isLoading ? (
        <EmptyState icon="library" title="No prompts here yet" description="Save prompts from Create, or compose one in Prompt Studio to build a reusable bank."
          action={<Button variant="primary" icon="book" onClick={() => setRoute("prompt-studio")}>Open Prompt Studio</Button>} />
      ) : null}

      <div className="grid cols-3" style={{ marginTop: 14 }}>
        {items.map((prompt) => (
          <Card key={prompt.id} className="prompt-card">
            <div className="row between" style={{ marginBottom: 6 }}>
              <span className="strong small truncate" style={{ maxWidth: 200 }}>{prompt.title}</span>
              <button className="icon-btn" onClick={() => void toggleFavorite(prompt)} aria-label="Toggle favourite" style={{ color: prompt.favorite ? "var(--warn)" : "var(--dim)" }}>
                <Icon name="star" size={14} />
              </button>
            </div>
            <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
              <Badge>{prompt.category || "general"}</Badge>
              <Badge>v{prompt.version}</Badge>
              {prompt.project_id ? <Badge tone="info">{projects.data?.find((project) => project.id === prompt.project_id)?.name ?? "project"}</Badge> : null}
            </div>
            <p className="prompt-body">{prompt.body}</p>
            {prompt.negative ? <div className="tiny muted truncate" style={{ marginTop: 6 }}>avoid: {prompt.negative}</div> : null}
            <div className="row between" style={{ marginTop: 10 }}>
              <span className="tiny dim">{formatDate(prompt.updated_at)}</span>
              <div className="row" style={{ gap: 4 }}>
                <Button size="sm" variant="ghost" onClick={() => { setHandoff({ prompt: prompt.body, negative: prompt.negative }); setRoute("create"); }}>Use</Button>
                <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditing(prompt)}>Edit</Button>
                <Button size="sm" variant="ghost" icon="history" onClick={async () => {
                  setVersionsFor(prompt);
                  try { setVersions(await api.promptVersions(prompt.id)); } catch (error) { toast(errorText(error), "err"); }
                }}>History</Button>
                <Button size="sm" variant="ghost" icon="trash" onClick={() => setDeleting(prompt)}>Delete</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid cols-2" style={{ marginTop: 18 }}>
        <Card tight>
          <div className="strong small" style={{ marginBottom: 8 }}>Export</div>
          <PickerField label="Export folder" mode="dir" value={exportPath} onChange={setExportPath} />
          <div className="field-hint">Writes <span className="mono">prompts-&lt;date&gt;.json</span> into the chosen folder.</div>
        </Card>
        <Card tight>
          <div className="strong small" style={{ marginBottom: 8 }}>Import</div>
          <PickerField label="prompts.json" mode="file" value={importPath} onChange={setImportPath} filter={(entry) => !entry.is_dir && entry.name.toLowerCase().endsWith(".json")} />
          <div className="field-hint">Prompts are validated before insertion; duplicates are kept as separate entries.</div>
        </Card>
      </div>

      <Modal open={Boolean(editing)} title="Edit prompt" subtitle={`version ${editing?.version ?? 0} → ${(editing?.version ?? 0) + 1}`} onClose={() => setEditing(null)}
        footer={<>
          <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={() => void saveEdit()}>Save version</Button>
        </>}
      >
        {editing ? (
          <div className="stack">
            <div className="field"><span className="field-label">Title</span><Input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /></div>
            <div className="field"><span className="field-label">Body</span><Textarea value={editing.body} onChange={(event) => setEditing({ ...editing, body: event.target.value })} style={{ minHeight: 120 }} /></div>
            <div className="field"><span className="field-label">Negative</span><Input value={editing.negative} onChange={(event) => setEditing({ ...editing, negative: event.target.value })} /></div>
            <div className="grid cols-2">
              <div className="field"><span className="field-label">Category</span><Input value={editing.category} onChange={(event) => setEditing({ ...editing, category: event.target.value })} /></div>
              <div className="field"><span className="field-label">Tags (comma separated)</span><Input value={safeTags(editing.tags_json).join(", ")} onChange={(event) => setEditing({ ...editing, tags_json: JSON.stringify(event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean)) })} /></div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(deleting)} title="Delete prompt" onClose={() => setDeleting(null)}
        footer={<>
          <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
          <Button variant="danger" icon="trash" onClick={async () => {
            if (!deleting) return;
            try { await api.promptDelete(deleting.id); toast("Prompt deleted", "ok"); setDeleting(null); prompts.refetch(); }
            catch (error) { toast(errorText(error), "err"); }
          }}>Delete</Button>
        </>}
      >
        <p className="small muted">This removes the prompt and all of its version snapshots. Images that used it are unaffected.</p>
      </Modal>

      <Modal open={Boolean(versionsFor)} title="Version history" subtitle={versionsFor?.title} onClose={() => setVersionsFor(null)} wide>
        <div className="stack" style={{ maxHeight: "60vh", overflow: "auto" }}>
          {versions.length === 0 ? <div className="muted small">No snapshots.</div> : null}
          {versions.map((version, index) => (
            <Card key={version.id} tight>
              <div className="row between">
                <Badge>v{versions.length - index}</Badge>
                <span className="tiny muted">{formatDate(version.created_at)} · {version.note || "snapshot"}</span>
              </div>
              <p className="mono tiny" style={{ whiteSpace: "pre-wrap", marginTop: 8, color: "var(--text-soft)" }}>{version.body}</p>
              <Button size="sm" variant="ghost" onClick={() => { setHandoff({ prompt: version.body }); setVersionsFor(null); setRoute("create"); }}>Use this version</Button>
            </Card>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function safeTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
