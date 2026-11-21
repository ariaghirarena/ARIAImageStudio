import { useEffect, useState } from "react";
import { Badge, Button, Card, CodeBlock, Icon, Select, Slider, Spinner, ToggleRow } from "@aria/ui";
import { api, errorText, formatDate, type Settings } from "@aria/core";
import { useApp } from "../store";
import { PickerField, PageHeader } from "../components/shell";

export function PreferencesPage() {
  const boot = useApp((state) => state.boot);
  const settings = useApp((state) => state.settings);
  const saveSettings = useApp((state) => state.saveSettings);
  const toast = useApp((state) => state.toast);
  const [draft, setDraft] = useState<Settings>(settings);
  const [update, setUpdate] = useState<{ status: string; current: string; latest?: string; detail?: string; release_url?: string; auto_install?: boolean } | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => setDraft(settings), [settings]);

  const patch = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    void saveSettings({ [key]: value } as Partial<Settings>);
  };

  const checkUpdates = async () => {
    setChecking(true);
    try {
      const result = await api.updatesCheck();
      setUpdate(result);
      toast(result.status === "available" ? `Version ${result.latest} is available` : "You are on the latest version", result.status === "available" ? "info" : "ok");
    } catch (error) {
      toast(errorText(error), "err");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="page fade-in">
      <PageHeader
        title="Preferences"
        description="Interface, storage and privacy. Changes to toggles are saved immediately; sliders commit as you release them."
        actions={<Button icon="refresh" loading={checking} onClick={() => void checkUpdates()}>Check for updates</Button>}
      />

      <div className="grid split">
        <div className="stack">
          <Card>
            <div className="section-title"><h2>Interface</h2></div>
            <div className="grid cols-2">
              <div className="field">
                <span className="field-label">Language</span>
                <Select value={draft.language} onChange={(event) => patch("language", event.target.value)} options={[{ value: "fa", label: "فارسی" }, { value: "en", label: "English" }]} />
              </div>
              <div className="field">
                <span className="field-label">Direction</span>
                <Select value={draft.locale_direction} onChange={(event) => patch("locale_direction", event.target.value)} options={[{ value: "rtl", label: "Right to left" }, { value: "ltr", label: "Left to right" }]} />
              </div>
              <div className="field">
                <span className="field-label">Theme</span>
                <Select value={draft.theme} onChange={(event) => patch("theme", event.target.value)} options={[{ value: "obsidian", label: "Obsidian (default)" }, { value: "graphite", label: "Graphite" }]} />
              </div>
              <div className="field">
                <span className="field-label">Default quality preset</span>
                <Select value={draft.quality_preset} onChange={(event) => patch("quality_preset", event.target.value)}
                  options={[{ value: "aria-best-quality", label: "ARIA best quality" }, { value: "natural", label: "Natural photo" }, { value: "product", label: "Product studio" }]} />
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <ToggleRow label="Autosave prompts while typing" description="Keeps a draft in the prompt editor so a crash never loses work." checked={draft.autosave} onChange={(value) => patch("autosave", value)} />
              <ToggleRow label="Desktop notifications" description="Shows a notification when a queued batch finishes." checked={draft.notifications} onChange={(value) => patch("notifications", value)} />
              <ToggleRow label="Confirm destructive actions" description="Ask before deleting images, accounts or projects. Strongly recommended." checked={draft.confirm_destructive} onChange={(value) => patch("confirm_destructive", value)} />
              <ToggleRow label="Enhance prompts by default" description="Pre-fills Prompt Intelligence with the aggressive structuring preset." checked={draft.prompt_enhance_default} onChange={(value) => patch("prompt_enhance_default", value)} />
            </div>
          </Card>

          <Card>
            <div className="section-title"><h2>Storage</h2></div>
            <PickerField label="Output root" mode="dir" value={draft.output_root} onChange={(value) => patch("output_root", value)} placeholder={boot?.paths.projects ?? "Default: ARIA Projects folder"} />
            <div className="grid cols-2" style={{ marginTop: 12 }}>
              <Slider label="History limit (records)" value={draft.history_limit} min={200} max={20000} step={200} onChange={(value) => patch("history_limit", value)} />
              <Slider label="Thumbnail cache (MB)" value={draft.cache_limit_mb} min={64} max={4096} step={64} onChange={(value) => patch("cache_limit_mb", value)} />
            </div>
            <div className="row wrap" style={{ marginTop: 12 }}>
              <Button size="sm" icon="folder" onClick={() => { if (boot?.paths.root) void api.openPath(boot.paths.root).catch(() => undefined); }}>Open data root</Button>
              <Button size="sm" variant="ghost" icon="folder" onClick={() => { if (boot?.paths.backups) void api.openPath(boot.paths.backups).catch(() => undefined); }}>Open backups</Button>
              <Button size="sm" variant="ghost" icon="folder" onClick={() => { if (boot?.paths.logs) void api.openPath(boot.paths.logs).catch(() => undefined); }}>Open logs</Button>
            </div>
          </Card>

          <Card>
            <div className="section-title"><h2>Data locations</h2></div>
            <CodeBlock text={`root        ${boot?.paths.root ?? ""}
codex_home  ${boot?.paths.codex_home ?? ""}
projects    ${boot?.paths.projects ?? ""}
gallery     ${boot?.paths.gallery ?? ""}
backups     ${boot?.paths.backups ?? ""}
database    ${boot?.paths.database ?? ""}`} maxHeight={170} />
          </Card>
        </div>

        <div className="stack">
          <Card>
            <div className="section-title"><h2>About</h2><Badge tone="accent">v{boot?.version ?? "1.0.0"}</Badge></div>
            <div className="stack" style={{ gap: 6 }}>
              <div className="row between"><span className="small">Product</span><span className="small strong">ARIA Image Studio</span></div>
              <div className="row between"><span className="small">Platform</span><span className="mono tiny">{boot?.platform}</span></div>
              <div className="row between"><span className="small">Engine</span><span className="small">Codex CLI · built-in image_gen</span></div>
              <div className="row between"><span className="small">Licence</span><span className="small">Proprietary · see LICENSES</span></div>
            </div>
            <div className="divider" style={{ margin: "12px 0" }} />
            <div className="row wrap">
              <Button size="sm" icon="external" onClick={() => void api.openUrl("https://github.com/ariaghirarena/ARIAImageStudio").catch(() => undefined)}>Repository</Button>
              <Button size="sm" variant="ghost" icon="activity" onClick={() => useApp.getState().setRoute("diagnostics")}>Diagnostics</Button>
            </div>
          </Card>

          <Card>
            <div className="section-title"><h2>Updates</h2>{update ? <Badge tone={update.status === "available" ? "info" : "ok"}>{update.status}</Badge> : null}</div>
            {checking ? <Spinner label="Contacting GitHub releases…" /> : null}
            {update ? (
              <div className="stack" style={{ gap: 6 }}>
                <div className="row between"><span className="small">Current</span><span className="mono tiny">{update.current}</span></div>
                {update.latest ? <div className="row between"><span className="small">Latest</span><span className="mono tiny">{update.latest}</span></div> : null}
                {update.detail ? <div className="tiny muted">{update.detail}</div> : null}
                <div className="tiny dim">{update.auto_install ? "Automatic installation is available." : "Updates are downloaded from the release page; ARIA never runs an unverified installer."}</div>
                {update.release_url ? <Button size="sm" icon="external" onClick={() => void api.openUrl(update.release_url!).catch(() => undefined)}>Open release</Button> : null}
              </div>
            ) : <div className="muted small">Run a check to inspect the latest GitHub release.</div>}
            <div className="tiny dim" style={{ marginTop: 8 }}>Checked {formatDate(new Date().toISOString())}</div>
          </Card>

          <Card>
            <div className="section-title"><h2>Keyboard</h2></div>
            <div className="list">
              {[
                ["Ctrl / Cmd + K", "Command palette"],
                ["Ctrl / Cmd + Enter", "Generate in Create"],
                ["Ctrl / Cmd + S", "Save prompt"],
                ["Ctrl / Cmd + 1…5", "Jump to a workspace"],
                ["Shift + ?", "Shortcuts & help"],
                ["Esc", "Close dialogs"],
              ].map(([keys, action]) => (
                <div className="list-row" key={keys}>
                  <span className="kbd">{keys}</span>
                  <span className="spacer" />
                  <span className="small muted">{action}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="row" style={{ gap: 8 }}>
              <Icon name="info" size={14} />
              <span className="tiny muted">
                ARIA does not require an API key, never falls back to another provider, and refuses to fake unsupported engine parameters.
              </span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
