import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Card, CodeBlock, Icon, Modal, Spinner, Textarea } from "@aria/ui";
import { api, errorText, formatDate } from "@aria/core";
import { useApp } from "../store";
import { useAction } from "../lib/hooks";
import { PageHeader } from "../components/shell";

const TEMPLATE = `# ARIA Image Studio — per-profile Codex configuration
# This file belongs to the ARIA profile, not to your personal ~/.codex.
# Keep it minimal: ARIA passes model, sandbox and effort per call.

# model = "gpt-5-codex"
# approval_policy = "on-request"
# sandbox_mode = "workspace-write"
`;

export function CodexSettingsPage() {
  const boot = useApp((state) => state.boot);
  const toast = useApp((state) => state.toast);
  const refresh = useApp((state) => state.refresh);
  const config = useQuery({ queryKey: ["codex-config"], queryFn: api.codexConfigRead });
  const [content, setContent] = useState("");
  const [loadedPath, setLoadedPath] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (config.data) {
      setContent(config.data.content);
      setLoadedPath(config.data.path);
    }
  }, [config.data]);

  const installSkill = useAction(() => api.codexInstallSkill(), {
    success: "imagegen skill installed",
    onDone: () => void refresh(),
  });

  const save = async () => {
    try {
      const result = await api.codexConfigWrite(content);
      toast(`config.toml written (${result.path})`, "ok");
      setConfirmOpen(false);
      config.refetch();
    } catch (error) {
      toast(errorText(error), "err");
    }
  };

  const dirty = config.data ? content !== config.data.content : content.trim().length > 0;

  return (
    <div className="page fade-in">
      <PageHeader
        title="Codex Configuration"
        description="A per-profile config.toml. ARIA backs it up before every write and never edits your personal ~/.codex."
        actions={
          <>
            <Button icon="refresh" onClick={() => config.refetch()}>Reload</Button>
            <Button icon="file" onClick={() => setContent((current) => (current.trim() ? current : TEMPLATE))}>Insert template</Button>
            <Button variant="primary" icon="save" disabled={!dirty} onClick={() => setConfirmOpen(true)}>Write config.toml</Button>
          </>
        }
      />

      <div className="grid split">
        <Card>
          <div className="section-title">
            <h2>config.toml</h2>
            <Badge tone={config.data?.exists ? "ok" : "warn"}>{config.data?.exists ? "exists" : "not created yet"}</Badge>
          </div>
          {config.isLoading ? <Spinner label="Reading config…" /> : null}
          {config.isError ? <div className="banner err"><Icon name="alert" size={14} /><span>{errorText(config.error)}</span></div> : null}
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            spellCheck={false}
            placeholder={TEMPLATE}
            style={{ minHeight: 360, fontFamily: "var(--mono)", fontSize: 12 }}
          />
          <div className="row wrap" style={{ marginTop: 10 }}>
            <span className="mono-path">{loadedPath || boot?.paths.codex_home}</span>
            <span className="spacer" />
            {dirty ? <Badge tone="warn">unsaved changes</Badge> : <Badge tone="ok">in sync</Badge>}
          </div>
        </Card>

        <div className="stack">
          <Card>
            <div className="section-title"><h2>Safety</h2></div>
            <ul className="small muted" style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.8 }}>
              <li>The previous file is copied to <span className="mono">Backups/</span> before each write.</li>
              <li>Writes are atomic (temp file + rename).</li>
              <li>Comments and unknown keys are preserved as typed.</li>
              <li>Invalid TOML is reported by Codex on the next run, not swallowed.</li>
            </ul>
          </Card>

          <Card>
            <div className="section-title"><h2>Skills</h2><Badge tone={boot?.codex.skill_present ? "ok" : "warn"}>{boot?.codex.skill_present ? "installed" : "missing"}</Badge></div>
            <p className="muted tiny" style={{ marginTop: 0 }}>
              ARIA installs an <span className="mono">imagegen</span> skill into the profile's skills folder. It teaches the agent to use the
              built-in image tool and to avoid scripts or API keys.
            </p>
            <Button size="sm" icon="download" loading={installSkill.isPending} onClick={() => installSkill.mutate([])}>Install / repair skill</Button>
            <div className="mono-path" style={{ marginTop: 8 }}>{boot?.paths.codex_home}\skills</div>
          </Card>

          <Card>
            <div className="section-title"><h2>Profile home</h2></div>
            <div className="row wrap">
              <Button size="sm" icon="folder" onClick={() => { if (boot?.paths.codex_home) void api.openPath(boot.paths.codex_home).catch(() => undefined); }}>Open folder</Button>
              <Button size="sm" variant="ghost" icon="terminal" onClick={() => useApp.getState().setRoute("engine")}>AI engine</Button>
            </div>
            <div className="divider" style={{ margin: "10px 0" }} />
            <div className="tiny muted">Structure</div>
            <CodeBlock text={`${boot?.paths.codex_home ?? "<CODEX_HOME>"}
  auth.json          session tokens (user-only ACL)
  auth.vault         DPAPI backup
  config.toml        this file
  skills/            imagegen + ARIA skills
  generated_images/  built-in tool output
  sessions/          run transcripts`} maxHeight={150} />
          </Card>
        </div>
      </div>

      <Modal open={confirmOpen} title="Write config.toml" subtitle="A backup is created first" onClose={() => setConfirmOpen(false)}
        footer={<>
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="primary" icon="save" onClick={() => void save()}>Write file</Button>
        </>}
      >
        <div className="stack">
          <div className="mono-path">{loadedPath}</div>
          <div className="log-view" style={{ maxHeight: 220 }}>{content.slice(0, 2000)}{content.length > 2000 ? "\n…" : ""}</div>
          <div className="tiny dim">The change affects the active profile only. Existing sessions are not modified.</div>
          {config.data?.exists ? <div className="tiny muted">Last read {formatDate(new Date().toISOString())}</div> : null}
        </div>
      </Modal>
    </div>
  );
}
