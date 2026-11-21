import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Card, CodeBlock, Icon, Input, Spinner, Textarea } from "@aria/ui";
import { api, errorText, formatDate } from "@aria/core";
import { useApp } from "../store";
import { useAction } from "../lib/hooks";
import { PageHeader } from "../components/shell";

export function EnginePage() {
  const boot = useApp((state) => state.boot);
  const refresh = useApp((state) => state.refresh);
  const toast = useApp((state) => state.toast);
  const [testPrompt, setTestPrompt] = useState("Reply with exactly: ARIA engine online");
  const [testOutput, setTestOutput] = useState("");
  const [testing, setTesting] = useState(false);
  const health = useQuery({ queryKey: ["health"], queryFn: api.codexHealth, refetchInterval: 20000 });

  const installSkill = useAction(() => api.codexInstallSkill(), {
    success: "imagegen skill installed into the ARIA CODEX_HOME",
    onDone: () => { void refresh(); health.refetch(); },
  });

  const models = useQuery({ queryKey: ["models"], queryFn: api.codexModels });

  const runTest = async () => {
    setTesting(true);
    setTestOutput("");
    try {
      const result = await api.codexComplete(testPrompt);
      setTestOutput(result.text.trim() || "(empty response)");
      toast("Codex responded — the engine path works", "ok");
    } catch (error) {
      setTestOutput(errorText(error));
      toast("Engine test failed", "err");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="page fade-in">
      <PageHeader
        title="AI Engine"
        description="ARIA does not ship a model. It drives the official Codex CLI and its built-in image generation tool — no API key, no private endpoints."
        actions={
          <>
            <Button icon="refresh" onClick={() => { health.refetch(); void refresh(); }}>Re-check</Button>
            <Button variant="primary" icon="download" loading={installSkill.isPending} onClick={() => installSkill.mutate([])}>Install imagegen skill</Button>
          </>
        }
      />

      <div className="grid split">
        <div className="stack">
          <Card>
            <div className="section-title"><h2>Installation</h2>
              <Badge tone={health.data?.codex.found ? "ok" : "err"}>{health.data?.codex.found ? "detected" : "not found"}</Badge>
            </div>
            <div className="list">
              <div className="list-row"><Icon name="terminal" size={14} /><div style={{ flex: 1 }}><div className="small">Binary</div><div className="mono-path">{health.data?.codex.path || "—"}</div></div></div>
              <div className="list-row"><Icon name="info" size={14} /><div style={{ flex: 1 }}><div className="small">Version</div><div className="mono-path">{health.data?.codex.version || "unknown"}</div></div></div>
              <div className="list-row"><Icon name="key" size={14} /><div style={{ flex: 1 }}><div className="small">Session</div><div className="tiny muted">{health.data?.login?.detail || "not verified"}</div></div>
                <Badge tone={health.data?.login?.authenticated ? "ok" : "warn"}>{health.data?.login?.authenticated ? "signed in" : "unverified"}</Badge>
              </div>
              <div className="list-row"><Icon name="sparkles" size={14} /><div style={{ flex: 1 }}><div className="small">imagegen skill</div><div className="tiny muted">Required so the agent knows how to call the built-in tool.</div></div>
                <Badge tone={health.data?.codex.skill_present ? "ok" : "warn"}>{health.data?.codex.skill_present ? "installed" : "missing"}</Badge>
              </div>
            </div>
            {!health.data?.codex.found ? (
              <div className="banner warn" style={{ marginTop: 12 }}>
                <Icon name="alert" size={14} />
                <div>
                  <div className="strong small">Codex CLI is not installed</div>
                  <div className="tiny">Install it from the official channel, then press Re-check:</div>
                  <div className="mono tiny" style={{ marginTop: 4 }}>npm install -g @openai/codex</div>
                </div>
                <Button size="sm" icon="external" onClick={() => void api.openUrl("https://developers.openai.com/codex/cli").catch(() => undefined)}>Docs</Button>
              </div>
            ) : null}
          </Card>

          <Card>
            <div className="section-title"><h2>Model discovery</h2>
              <Badge tone="warn">partial</Badge>
            </div>
            <p className="muted tiny" style={{ marginTop: 0 }}>
              Codex does not expose a complete public model catalogue to wrappers. ARIA reads the local
              <span className="mono"> models_cache.json</span> and lets you type any model id. The image model itself is
              managed by Codex and shown as “Managed by Codex”.
            </p>
            {models.isLoading ? <Spinner label="Reading local cache…" /> : null}
            <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
              {models.data?.models.length === 0 ? <span className="dim tiny">No cached models. Leave the model field empty to use the Codex default.</span> : null}
              {models.data?.models.map((model) => <Badge key={model.id} tone="info">{model.label || model.id}</Badge>)}
            </div>
            <div className="tiny dim" style={{ marginTop: 8 }}>{models.data?.detail}</div>
            <Button size="sm" variant="ghost" icon="cpu" style={{ marginTop: 10 }} onClick={() => useApp.getState().setRoute("models")}>Model settings</Button>
          </Card>

          <Card>
            <div className="section-title"><h2>Engine smoke test</h2><span>text round-trip through Codex</span></div>
            <Input value={testPrompt} onChange={(event) => setTestPrompt(event.target.value)} />
            <div className="row" style={{ marginTop: 8 }}>
              <Button size="sm" icon="play" loading={testing} onClick={() => void runTest()} disabled={!testPrompt.trim()}>Run test</Button>
              <span className="dim tiny">Uses a tiny prompt, so it costs almost nothing.</span>
            </div>
            {testOutput ? <div className="log-view" style={{ marginTop: 8, maxHeight: 140 }}>{testOutput}</div> : null}
          </Card>
        </div>

        <div className="stack">
          <Card>
            <div className="section-title"><h2>Runtime layout</h2></div>
            <CodeBlock text={`CODEX_HOME=${boot?.paths.codex_home ?? ""}

ARIA never writes to your personal ~/.codex.
Profiles are isolated per account.`} maxHeight={110} />
            <div className="row wrap" style={{ marginTop: 10 }}>
              <Button size="sm" icon="folder" onClick={() => { if (boot?.paths.codex_home) void api.openPath(boot.paths.codex_home).catch(() => undefined); }}>Open CODEX_HOME</Button>
              <Button size="sm" variant="ghost" icon="settings" onClick={() => useApp.getState().setRoute("codex")}>config.toml</Button>
            </div>
          </Card>

          <Card>
            <div className="section-title"><h2>Why no API key</h2></div>
            <ul className="small muted" style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.8 }}>
              <li>Codex accounts already include image generation.</li>
              <li>API keys would bill a different platform and need a different endpoint.</li>
              <li>ARIA is designed for personal ChatGPT/Codex accounts, per the product rules.</li>
              <li>No alternative API is used as a fallback — ever.</li>
            </ul>
          </Card>

          <Card>
            <div className="section-title"><h2>Capability labels</h2></div>
            <div className="list">
              <div className="list-row"><Badge tone="ok">supported</Badge><span className="small" style={{ flex: 1 }}>Generate, edit via prompt, variations, local transforms</span></div>
              <div className="list-row"><Badge tone="warn">partial</Badge><span className="small" style={{ flex: 1 }}>Model listing (local cache only), transparency (engine-dependent)</span></div>
              <div className="list-row"><Badge tone="err">unsupported</Badge><span className="small" style={{ flex: 1 }}>Masked inpainting, per-image seed control, exact size selection</span></div>
            </div>
            <Button size="sm" variant="ghost" icon="list" style={{ marginTop: 10 }} onClick={() => useApp.getState().setRoute("diagnostics")}>Feature registry</Button>
          </Card>

          <Card tight>
            <div className="tiny muted">Last health check</div>
            <div className="small">{health.dataUpdatedAt ? formatDate(new Date(health.dataUpdatedAt).toISOString()) : "—"}</div>
          </Card>
        </div>
      </div>

      <Card style={{ marginTop: 16 }}>
        <div className="section-title"><h2>Engine instruction preview</h2><span>what Codex receives</span></div>
        <Textarea
          readOnly
          value={`Use your built-in image generation tool (image_gen) to create the requested image.
Do not write or run scripts, do not call any API, do not ask for an API key.
Produce the image(s) and finish.

PROMPT:
<final prompt from Prompt Intelligence>`}
          style={{ minHeight: 120, fontFamily: "var(--mono)", fontSize: 11.5 }}
        />
      </Card>
    </div>
  );
}
