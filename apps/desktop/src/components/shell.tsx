import React, { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, EmptyState, FilePickerModal, Icon, Input, Modal, Spinner, type IconName } from "@aria/ui";
import { api, toFileUrl, type ImageRecord, type PickerEntry } from "@aria/core";
import { useApp, type Route } from "../store";

export const NAV: { group: string; items: { route: Route; label: string; icon: IconName; badge?: string }[] }[] = [
  {
    group: "Studio",
    items: [
      { route: "dashboard", label: "Dashboard", icon: "dashboard" },
      { route: "create", label: "Create Image", icon: "sparkles" },
      { route: "edit", label: "Edit Image", icon: "wand" },
      { route: "variations", label: "Variations", icon: "layers" },
    ],
  },
  {
    group: "Library",
    items: [
      { route: "gallery", label: "Gallery", icon: "image" },
      { route: "projects", label: "Projects", icon: "folder" },
      { route: "prompt-studio", label: "Prompt Studio", icon: "zap" },
      { route: "prompt-library", label: "Prompt Library", icon: "library" },
    ],
  },
  {
    group: "Engine",
    items: [
      { route: "engine", label: "AI Engine", icon: "cpu" },
      { route: "models", label: "Model Settings", icon: "sliders" },
      { route: "codex", label: "Codex Settings", icon: "terminal" },
      { route: "auth", label: "Authentication", icon: "key" },
      { route: "accounts", label: "Account Manager", icon: "user" },
    ],
  },
  {
    group: "Operations",
    items: [
      { route: "batch", label: "Batch Studio", icon: "grid" },
      { route: "workflows", label: "Workflow Builder", icon: "workflow" },
      { route: "history", label: "History", icon: "clock" },
      { route: "analytics", label: "Analytics", icon: "chart" },
    ],
  },
  {
    group: "System",
    items: [
      { route: "preferences", label: "Preferences", icon: "settings" },
      { route: "diagnostics", label: "Diagnostics", icon: "activity" },
    ],
  },
];

export const PAGE_TITLES: Record<Route, string> = {
  welcome: "Welcome",
  auth: "Authentication",
  dashboard: "Dashboard",
  create: "Create Image",
  edit: "Edit Image",
  variations: "Image Variations",
  gallery: "Gallery",
  "prompt-studio": "Prompt Studio",
  "prompt-library": "Prompt Library",
  batch: "Batch Studio",
  workflows: "Workflow Builder",
  projects: "Project Manager",
  engine: "AI Engine",
  models: "Model Settings",
  codex: "Codex Settings",
  accounts: "Account Manager",
  history: "History",
  analytics: "Analytics",
  preferences: "Preferences",
  diagnostics: "Diagnostics",
};

export function Sidebar() {
  const route = useApp((state) => state.route);
  const setRoute = useApp((state) => state.setRoute);
  const boot = useApp((state) => state.boot);
  const toast = useApp((state) => state.toast);

  const engineLabel = useMemo(() => {
    if (!boot) return { text: "Runtime offline", cls: "" };
    if (!boot.codex.found) return { text: "Codex not found", cls: "" };
    if (!boot.codex.auth_present) return { text: "No account", cls: "warn" };
    return { text: boot.codex.version || "Codex ready", cls: "ok" };
  }, [boot]);

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">A</div>
        <div className="brand-text">
          <div className="brand-name">ARIA</div>
          <div className="brand-sub">Image Studio</div>
        </div>
      </div>

      <div className="nav-scroll">
        {NAV.map((group) => (
          <div className="nav-group" key={group.group}>
            <div className="nav-label">{group.group}</div>
            {group.items.map((item) => (
              <button
                key={item.route}
                className="nav-item"
                data-active={route === item.route ? "true" : "false"}
                onClick={() => setRoute(item.route)}
              >
                <Icon name={item.icon} size={15} />
                <span>{item.label}</span>
                {item.route === "batch" && boot && boot.counts.pending_jobs > 0 ? (
                  <span className="nav-badge">{boot.counts.pending_jobs}</span>
                ) : null}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="sidebar-foot">
        <button className="engine-chip" onClick={() => setRoute("engine")} title="Open AI Engine">
          <span className={`engine-dot ${engineLabel.cls}`} />
          <span className="truncate">{engineLabel.text}</span>
          <span className="spacer" />
          <Icon name="chevronRight" size={12} />
        </button>
        <button className="nav-item" onClick={() => useApp.getState().setHelp(true)}>
          <Icon name="info" size={15} />
          <span>Help & shortcuts</span>
          <span className="nav-badge kbd">?</span>
        </button>
        <button
          className="nav-item"
          onClick={async () => {
            try {
              await api.openUrl("https://github.com/ariaghirarena/ARIAImageStudio/releases");
            } catch {
              toast("Could not open the releases page", "err");
            }
          }}
        >
          <Icon name="refresh" size={15} />
          <span>Updates</span>
          <span className="nav-badge">{boot?.version ?? ""}</span>
        </button>
      </div>
    </aside>
  );
}

export function Topbar() {
  const route = useApp((state) => state.route);
  const boot = useApp((state) => state.boot);
  const setPalette = useApp((state) => state.setPalette);
  const activeProfile = boot?.settings.active_profile_id
    ? boot.profiles.find((profile) => profile.id === boot.settings.active_profile_id)
    : undefined;

  return (
    <header className="topbar">
      <div className="crumbs">
        <span>ARIA</span>
        <Icon name="chevronRight" size={12} />
        <strong>{PAGE_TITLES[route]}</strong>
      </div>
      <div className="spacer" />
      <button className="search-trigger" onClick={() => setPalette(true)}>
        <Icon name="search" size={13} />
        <span>Search & commands</span>
        <span className="spacer" />
        <span className="kbd">Ctrl K</span>
      </button>
      <Badge tone={activeProfile ? "ok" : "warn"}>
        <Icon name="user" size={11} />
        {activeProfile ? activeProfile.name : "No account"}
      </Badge>
      {boot?.codex.found ? <Badge tone="info">Codex {boot.codex.version?.replace(/^codex-cli\s*/i, "")}</Badge> : <Badge tone="err">Codex missing</Badge>}
    </header>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export function ImageThumb({
  record,
  onClick,
  overlay,
  height,
}: {
  record: Pick<ImageRecord, "id" | "path" | "thumb_path" | "file_name" | "width" | "height">;
  onClick?: () => void;
  overlay?: React.ReactNode;
  height?: number;
}) {
  const [failed, setFailed] = useState(false);
  const src = toFileUrl(record.thumb_path || record.path);
  return (
    <div
      className="thumb"
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => { if (onClick && (event.key === "Enter" || event.key === " ")) onClick(); }}
      style={height ? { aspectRatio: "auto", height } : undefined}
    >
      {src && !failed ? (
        <img src={src} alt={record.file_name} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--dim)" }}>
          <Icon name="image" size={22} />
        </div>
      )}
      {overlay}
      <div className="thumb-meta">
        <span className="truncate">{record.file_name}</span>
        <span className="mono">{record.width}×{record.height}</span>
      </div>
    </div>
  );
}

export function CommandPalette() {
  const open = useApp((state) => state.paletteOpen);
  const setPalette = useApp((state) => state.setPalette);
  const setRoute = useApp((state) => state.setRoute);
  const toast = useApp((state) => state.toast);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const commands = useMemo(() => {
    const pages = NAV.flatMap((group) => group.items.map((item) => ({
      id: `page:${item.route}`,
      label: item.label,
      hint: group.group,
      icon: item.icon,
      run: () => setRoute(item.route),
    })));
    const actions = [
      { id: "act:diagnostics", label: "Run diagnostics", hint: "System", icon: "activity" as IconName, run: () => setRoute("diagnostics") },
      { id: "act:skill", label: "Install imagegen skill", hint: "Engine", icon: "sparkles" as IconName, run: async () => {
        try { await api.codexInstallSkill(); toast("Skill installed into the ARIA CODEX_HOME", "ok"); } catch (error) { toast(String((error as { message?: string })?.message ?? error), "err"); }
      } },
      { id: "act:releases", label: "Open GitHub releases", hint: "System", icon: "external" as IconName, run: () => { void api.openUrl("https://github.com/ariaghirarena/ARIAImageStudio/releases").catch(() => undefined); } },
      { id: "act:root", label: "Open ARIA data folder", hint: "System", icon: "folder" as IconName, run: () => { const root = useApp.getState().boot?.paths.root; if (root) void api.openPath(root).catch(() => undefined); } },
      { id: "act:help", label: "Help & shortcuts", hint: "Help", icon: "info" as IconName, run: () => useApp.getState().setHelp(true) },
    ];
    return [...pages, ...actions];
  }, [setRoute, toast]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands.slice(0, 12);
    return commands.filter((command) => command.label.toLowerCase().includes(needle) || command.hint.toLowerCase().includes(needle)).slice(0, 12);
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      window.setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  if (!open) return null;
  return (
    <div className="palette-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPalette(false); }}>
      <div className="palette" role="dialog" aria-label="Command palette">
        <input
          ref={inputRef}
          placeholder="Jump to a page or run a command…"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setActive(0); }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setPalette(false);
            if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => Math.min(filtered.length - 1, index + 1)); }
            if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => Math.max(0, index - 1)); }
            if (event.key === "Enter") {
              const command = filtered[active];
              if (command) {
                void command.run();
                setPalette(false);
              }
            }
          }}
        />
        <div className="palette-list">
          {filtered.map((command, index) => (
            <button
              key={command.id}
              className="palette-item"
              data-active={index === active ? "true" : "false"}
              onMouseEnter={() => setActive(index)}
              onClick={() => { void command.run(); setPalette(false); }}
            >
              <Icon name={command.icon} size={14} />
              <span>{command.label}</span>
              <small>{command.hint}</small>
            </button>
          ))}
          {filtered.length === 0 ? <div className="muted small" style={{ padding: 14 }}>No matches.</div> : null}
        </div>
      </div>
    </div>
  );
}

export function HelpDrawer() {
  const open = useApp((state) => state.helpOpen);
  const setHelp = useApp((state) => state.setHelp);
  const shortcuts = [
    ["Ctrl / ⌘ + K", "Command palette"],
    ["Ctrl / ⌘ + 1…5", "Fast navigation"],
    ["Ctrl / ⌘ + Enter", "Generate with the current prompt"],
    ["Ctrl / ⌘ + S", "Save the prompt to the library"],
    ["Esc", "Close overlays"],
    ["+ / − / wheel", "Zoom in the lightbox"],
  ];
  return (
    <Modal open={open} title="Help & shortcuts" subtitle="ARIA Image Studio 1.0" onClose={() => setHelp(false)}>
      <div className="stack">
        <div>
          <h3 style={{ fontSize: 13, marginBottom: 6 }}>How generation works</h3>
          <p className="muted small" style={{ margin: 0 }}>
            ARIA never calls an image API. It runs the official Codex CLI with an ARIA-owned CODEX_HOME and lets the
            built-in <span className="mono">image_gen</span> tool create the image; the result is imported from
            <span className="mono"> $CODEX_HOME/generated_images</span> into your project folder.
          </p>
        </div>
        <table className="table">
          <tbody>
            {shortcuts.map(([keys, label]) => (
              <tr key={keys}>
                <td style={{ width: 180 }}><span className="kbd">{keys}</span></td>
                <td>{label}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row wrap">
          <Button size="sm" icon="external" onClick={() => void api.openUrl("https://github.com/openai/codex").catch(() => undefined)}>Codex repository</Button>
          <Button size="sm" icon="external" onClick={() => void api.openUrl("https://github.com/ariaghirarena/ARIAImageStudio").catch(() => undefined)}>Project repository</Button>
          <span className="spacer" />
          <span className="dim tiny">No API key is ever required.</span>
        </div>
      </div>
    </Modal>
  );
}

export function RuntimeGate({ children }: { children: React.ReactNode }) {
  const error = useApp((state) => state.bootError);
  if (!error) return <>{children}</>;
  return (
    <div className="page">
      <div className="hero">
        <h1>ARIA Image Studio</h1>
        <p>
          {error === "no_desktop_runtime"
            ? "You are viewing the interface without the desktop runtime. Install the Windows build (or run `npm run tauri dev`) to use Codex authentication, generation and local image processing."
            : error}
        </p>
        <div className="row wrap" style={{ marginTop: 18 }}>
          <Button variant="primary" icon="download" onClick={() => void api.openUrl("https://github.com/ariaghirarena/ARIAImageStudio/releases").catch(() => undefined)}>
            Download the installer
          </Button>
          <Button icon="sparkles" onClick={() => useApp.getState().setRoute("prompt-studio")}>Try Prompt Studio (works offline)</Button>
        </div>
      </div>
      <div style={{ marginTop: 18 }}>
        <EmptyState
          icon="monitor"
          title="Preview mode"
          description="The design system, navigation and the deterministic prompt engine are fully live. Native features such as Codex generation, image processing and the gallery require the desktop runtime."
        />
      </div>
    </div>
  );
}

export function LoadingScreen({ label }: { label: string }) {
  return (
    <div style={{ height: "100vh", display: "grid", placeItems: "center" }}>
      <div className="stack center" style={{ alignItems: "center", gap: 12 }}>
        <div className="brand-mark" style={{ width: 46, height: 46, fontSize: 19 }}>A</div>
        <Spinner label={label} />
      </div>
    </div>
  );
}

export function PickerField({
  label,
  value,
  onChange,
  mode,
  placeholder,
  filter,
}: {
  label: string;
  value: string;
  onChange: (path: string) => void;
  mode: "file" | "dir";
  placeholder?: string;
  filter?: (entry: PickerEntry) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [roots, setRoots] = useState<{ name: string; path: string }[]>([]);

  useEffect(() => {
    if (!open || roots.length > 0) return;
    void api.pickerRoots().then((result) => setRoots([...result.shortcuts, ...result.roots])).catch(() => undefined);
  }, [open, roots.length]);

  return (
    <div className="field" style={{ display: "grid", gap: 6 }}>
      <span className="field-label">{label}</span>
      <div className="row">
        <Input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mono" />
        <Button icon="folder" onClick={() => setOpen(true)}>{mode === "dir" ? "Browse" : "Pick"}</Button>
      </div>
      <FilePickerModal
        open={open}
        title={label}
        mode={mode}
        roots={roots.length ? roots : [{ name: "Home", path: "" }]}
        onClose={() => setOpen(false)}
        onPick={(path) => onChange(path)}
        onConfirmDir={(path) => onChange(path)}
        loader={async (path) => {
          const listing = await api.pickerList(path);
          return {
            path: listing.path,
            parent: listing.parent,
            dirs: listing.dirs,
            files: (filter ? listing.files.filter(filter) : listing.files).map((file) => ({
              name: file.name,
              path: file.path,
              size: file.size,
              is_json: file.is_json,
              is_image: file.is_image,
            })),
            count: listing.count,
          };
        }}
      />
    </div>
  );
}
