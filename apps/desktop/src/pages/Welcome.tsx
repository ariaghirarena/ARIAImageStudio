import { useMemo } from "react";
import { Badge, Button, Card, Icon } from "@aria/ui";
import { api } from "@aria/core";
import { useApp } from "../store";
import { useProfiles } from "../lib/hooks";

export function WelcomePage() {
  const boot = useApp((state) => state.boot);
  const setRoute = useApp((state) => state.setRoute);
  const saveSettings = useApp((state) => state.saveSettings);
  const profiles = useProfiles();

  type Step = { title: string; body: string; done: boolean; action: () => void; cta: string };

  const steps: Step[] = useMemo(() => [
    {
      title: "Install the official Codex CLI",
      body: boot?.codex.found
        ? `Detected ${boot.codex.version || "Codex"} at ${boot.codex.path}`
        : "ARIA drives the official Codex CLI; it is not bundled because it must be signed in by you.",
      done: Boolean(boot?.codex.found),
      action: () => setRoute("engine"),
      cta: boot?.codex.found ? "Review engine" : "Open engine guide",
    },
    {
      title: "Connect your Codex account",
      body: boot?.codex.auth_present
        ? "Credentials are present in the ARIA-owned CODEX_HOME."
        : "Import auth.json or sign in with ChatGPT. ARIA never asks for an API key.",
      done: Boolean(boot?.codex.auth_present) || (profiles.data?.length ?? 0) > 0,
      action: () => setRoute("auth"),
      cta: "Open authentication",
    },
    {
      title: "Create your first project",
      body: boot && boot.counts.projects > 0
        ? `${boot.counts.projects} project(s) ready in ${boot.paths.projects}`
        : "Projects keep prompts, references and outputs tidy per subject.",
      done: Boolean(boot && boot.counts.projects > 0),
      action: () => setRoute("projects"),
      cta: "Manage projects",
    },
    {
      title: "Generate and review",
      body: boot && boot.counts.images > 0
        ? `${boot.counts.images} image(s) in your library.`
        : "Describe the image, let Prompt Intelligence structure it, then generate with the built-in tool.",
      done: Boolean(boot && boot.counts.images > 0),
      action: () => setRoute("create"),
      cta: "Create an image",
    },
  ], [boot, profiles.data, setRoute]);

  const doneCount = steps.filter((step) => step.done).length;

  return (
    <div className="page fade-in">
      <div className="hero">
        <div className="hero-grid">
          <div>
            <div className="row" style={{ gap: 8, marginBottom: 14 }}>
              <Badge tone="accent">v{boot?.version ?? "1.0.0"}</Badge>
              <Badge tone="info">Codex built-in image_gen</Badge>
              <Badge>No API key</Badge>
            </div>
            <h1>Image creation, engineered<br />around your Codex account.</h1>
            <p style={{ fontSize: 15, marginTop: 12 }}>
              ARIA Image Studio is a Windows studio for generating, editing, enhancing and organising images with the
              built-in image generation engine of Codex. Every capability you see is wired to a real backend command —
              what the engine cannot do is labelled, never faked.
            </p>
            <div className="row wrap" style={{ marginTop: 22 }}>
              <Button variant="primary" size="lg" icon="sparkles" onClick={() => setRoute("create")}>Start creating</Button>
              <Button size="lg" icon="key" onClick={() => setRoute("auth")}>Connect account</Button>
              <Button size="lg" variant="ghost" icon="activity" onClick={() => setRoute("diagnostics")}>Run diagnostics</Button>
            </div>
          </div>
          <div className="stack">
            <Card tight>
              <div className="row between" style={{ marginBottom: 8 }}>
                <span className="tiny muted" style={{ letterSpacing: ".12em", textTransform: "uppercase" }}>Environment</span>
                <span className="mono tiny dim">{boot?.platform}</span>
              </div>
              <div className="list">
                {[
                  ["Codex CLI", boot?.codex.found ? (boot.codex.version || "installed") : "not found", Boolean(boot?.codex.found)],
                  ["Credentials", boot?.codex.auth_present ? "present" : "missing", Boolean(boot?.codex.auth_present)],
                  ["Image skill", boot?.codex.skill_present ? "installed" : "not installed", Boolean(boot?.codex.skill_present)],
                  ["Database", `${boot?.counts.images ?? 0} images`, true],
                ].map(([label, value, ok]) => (
                  <div className="list-row" key={String(label)} style={{ padding: "8px 0" }}>
                    <span style={{ color: ok ? "var(--ok)" : "var(--warn)" }}><Icon name={ok ? "check" : "alert"} size={13} /></span>
                    <span className="small">{label}</span>
                    <span className="spacer" />
                    <span className="mono tiny muted truncate" style={{ maxWidth: 150 }}>{value}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card tight>
              <div className="tiny muted" style={{ letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 8 }}>Onboarding</div>
              <div className="row between">
                <span className="strong" style={{ fontSize: 20 }}>{doneCount}/4</span>
                <span className="muted tiny">steps complete</span>
              </div>
              <div className="split-progress" style={{ marginTop: 10 }}>
                <div style={{ width: `${(doneCount / 4) * 100}%` }} />
              </div>
            </Card>
          </div>
        </div>
      </div>

      <div className="grid split" style={{ marginTop: 18 }}>
        <Card>
          <div className="section-title"><h2>First-run checklist</h2><span>{doneCount} of 4 done</span></div>
          <div className="step-list">
            {steps.map((step, index) => (
              <div className="step" key={step.title} data-done={step.done ? "true" : "false"}>
                <div className="step-index">{step.done ? <Icon name="check" size={12} /> : index + 1}</div>
                <div>
                  <div className="strong small">{step.title}</div>
                  <div className="muted tiny" style={{ marginTop: 2 }}>{step.body}</div>
                </div>
                <Button size="sm" variant={step.done ? "ghost" : "outline"} onClick={step.action}>{step.cta}</Button>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="section-title"><h2>Where things live</h2></div>
          <div className="stack" style={{ gap: 10 }}>
            <div>
              <div className="tiny muted">ARIA data root</div>
              <div className="mono-path">{boot?.paths.root ?? "—"}</div>
            </div>
            <div>
              <div className="tiny muted">Dedicated CODEX_HOME</div>
              <div className="mono-path">{boot?.paths.codex_home ?? "—"}</div>
            </div>
            <div>
              <div className="tiny muted">Projects</div>
              <div className="mono-path">{boot?.paths.projects ?? "—"}</div>
            </div>
            <Button size="sm" icon="folder" onClick={() => { if (boot?.paths.root) void api.openPath(boot.paths.root).catch(() => undefined); }}>
              Open data folder
            </Button>
          </div>
        </Card>
      </div>

      <div className="row wrap" style={{ marginTop: 18, justifyContent: "space-between" }}>
        <span className="dim tiny">
          Credentials stay on this machine. ARIA never uploads auth.json, prompts or images to any ARIA server.
        </span>
        <Button variant="primary" icon="check" onClick={async () => { await saveSettings({ onboarded: true }); setRoute("dashboard"); }}>
          Finish setup
        </Button>
      </div>
    </div>
  );
}
