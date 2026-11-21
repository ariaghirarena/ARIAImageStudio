import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Card, Icon, Spinner, Stat } from "@aria/ui";
import { api, formatBytes, formatDate, formatDuration } from "@aria/core";
import { useApp } from "../store";
import { useAnalytics, useGallery, useProfiles, useQueueState, useRegistrySummary } from "../lib/hooks";
import { ImageThumb, PageHeader } from "../components/shell";

export function DashboardPage() {
  const boot = useApp((state) => state.boot);
  const setRoute = useApp((state) => state.setRoute);
  const analytics = useAnalytics();
  const queue = useQueueState();
  const registry = useRegistrySummary();
  const profiles = useProfiles();
  const recent = useGallery({ limit: 8, sort: "newest" });
  const health = useQuery({ queryKey: ["health"], queryFn: api.codexHealth, refetchInterval: 15000 });

  const summary = analytics.data;
  const activeProfile = profiles.data?.find((profile) => profile.id === boot?.settings.active_profile_id);
  const engineOk = Boolean(boot?.codex.found && boot.codex.auth_present);
  const shipped = registry.data?.by_status
    .filter((row) => row.status === "implemented" || row.status === "tested")
    .reduce((total, row) => total + Number(row.count), 0) ?? 0;

  return (
    <div className="page fade-in">
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}`}
        description="Everything here is live data from the local database, the Codex installation and the queue."
        actions={
          <>
            <Button icon="refresh" onClick={() => { void analytics.refetch(); queue.refetch(); health.refetch(); }}>Refresh</Button>
            <Button variant="primary" icon="sparkles" onClick={() => setRoute("create")}>New image</Button>
          </>
        }
      />

      <div className="grid cols-4">
        <Stat label="Images" value={summary?.images ?? boot?.counts.images ?? 0} sub={`${formatBytes(summary?.disk_bytes ?? 0)} on disk`} icon="image" />
        <Stat label="Generations" value={summary?.generations ?? 0} sub={`${summary?.success_rate ?? 0}% success`} icon="sparkles" />
        <Stat label="Avg. generation" value={formatDuration(summary?.avg_duration_ms ?? 0)} sub="successful runs" icon="clock" />
        <Stat label="Queue" value={queue.data ? queue.data.queued + queue.data.running : 0} sub={queue.data?.paused ? "paused" : "active"} icon="workflow" />
      </div>

      <div className="grid split" style={{ marginTop: 16 }}>
        <Card>
          <div className="section-title">
            <h2>Engine health</h2>
            <Badge tone={engineOk ? "ok" : "warn"}>{engineOk ? "ready" : "needs attention"}</Badge>
          </div>
          {health.isLoading ? <Spinner label="Checking Codex…" /> : null}
          <div className="list">
            <div className="list-row">
              <Icon name="terminal" size={15} />
              <div style={{ flex: 1 }}>
                <div className="small strong">Codex CLI</div>
                <div className="mono-path dim">{health.data?.codex.path || "not detected"}</div>
              </div>
              <Badge tone={health.data?.codex.found ? "ok" : "err"}>{health.data?.codex.version || "missing"}</Badge>
            </div>
            <div className="list-row">
              <Icon name="key" size={15} />
              <div style={{ flex: 1 }}>
                <div className="small strong">Session</div>
                <div className="tiny muted truncate">{health.data?.login?.detail || (health.data?.codex.auth_present ? "credentials present" : "no credentials")}</div>
              </div>
              <Badge tone={health.data?.login?.authenticated ? "ok" : health.data?.codex.auth_present ? "warn" : "err"}>
                {health.data?.login?.authenticated ? "authenticated" : health.data?.codex.auth_present ? "unverified" : "none"}
              </Badge>
            </div>
            <div className="list-row">
              <Icon name="sparkles" size={15} />
              <div style={{ flex: 1 }}>
                <div className="small strong">imagegen skill</div>
                <div className="tiny muted">Built-in image_gen tool is provided by Codex; the skill teaches the agent how to use it.</div>
              </div>
              <Badge tone={health.data?.codex.skill_present ? "ok" : "warn"}>{health.data?.codex.skill_present ? "installed" : "missing"}</Badge>
            </div>
            <div className="list-row">
              <Icon name="alert" size={15} />
              <div style={{ flex: 1 }}>
                <div className="small strong">Recent failures</div>
                <div className="tiny muted">Failed generations in the last 24 hours</div>
              </div>
              <Badge tone={(health.data?.recent_failures ?? 0) > 0 ? "warn" : "ok"}>{health.data?.recent_failures ?? 0}</Badge>
            </div>
          </div>
          <div className="row wrap" style={{ marginTop: 12 }}>
            <Button size="sm" icon="key" onClick={() => setRoute("auth")}>Manage account</Button>
            <Button size="sm" icon="activity" onClick={() => setRoute("diagnostics")}>Diagnostics</Button>
            <Button size="sm" variant="ghost" icon="cpu" onClick={() => setRoute("engine")}>AI engine</Button>
          </div>
        </Card>

        <div className="stack">
          <Card>
            <div className="section-title"><h2>Active profile</h2></div>
            {activeProfile ? (
              <div className="stack" style={{ gap: 6 }}>
                <div className="row"><Icon name="user" size={14} /><span className="strong small">{activeProfile.name}</span></div>
                <div className="tiny muted">{activeProfile.auth_mode} · {activeProfile.status.replace("_", " ")}</div>
                <div className="tiny dim">checked {formatDate(activeProfile.last_checked)}</div>
              </div>
            ) : (
              <div className="muted small">No profile selected. Connect an account to enable generation.</div>
            )}
            <div className="divider" style={{ margin: "12px 0" }} />
            <div className="tiny muted">CODEX_HOME</div>
            <div className="mono-path">{boot?.paths.codex_home ?? "—"}</div>
          </Card>

          <Card>
            <div className="section-title"><h2>Feature registry</h2><span>{registry.data?.total ?? 0}/300</span></div>
            <div className="split-progress"><div style={{ width: `${registry.data?.total ? (shipped / registry.data.total) * 100 : 0}%` }} /></div>
            <div className="tiny muted" style={{ marginTop: 8 }}>
              {shipped} implemented or tested capabilities · every entry states its real availability.
            </div>
            <Button size="sm" variant="ghost" icon="list" onClick={() => setRoute("diagnostics")} style={{ marginTop: 10 }}>Open registry</Button>
          </Card>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 22 }}>
        <h2>Recent work</h2>
        <Button size="sm" variant="ghost" icon="chevronRight" onClick={() => setRoute("gallery")}>Open gallery</Button>
      </div>
      {recent.isLoading ? <Spinner label="Loading gallery…" /> : null}
      {recent.data && recent.data.items.length === 0 ? (
        <Card>
          <div className="row between">
            <div>
              <div className="strong small">No images yet</div>
              <div className="muted tiny">Generate your first image — ARIA will import it, hash it, thumbnail it and index the prompt.</div>
            </div>
            <Button variant="primary" icon="sparkles" onClick={() => setRoute("create")}>Create image</Button>
          </div>
        </Card>
      ) : null}
      <div className="gallery-grid" style={{ marginTop: 10 }}>
        {recent.data?.items.map((image) => (
          <ImageThumb key={image.id} record={image} onClick={() => { useApp.getState().setHandoff({ imageId: image.id, imagePath: image.path }); setRoute("edit"); }} />
        ))}
      </div>

      <div className="grid cols-3" style={{ marginTop: 22 }}>
        {[
          { title: "Create with Prompt Intelligence", body: "Structure a Persian or English idea into a production prompt, then generate.", route: "create" as const, icon: "sparkles" as const },
          { title: "Batch studio", body: "Queue multiple prompts and let ARIA run them sequentially with retry and cancel.", route: "batch" as const, icon: "grid" as const },
          { title: "Workflows", body: "Chain generation with local upscale, background removal and format conversion.", route: "workflows" as const, icon: "workflow" as const },
        ].map((card) => (
          <Card key={card.title} className="fade-in">
            <div className="row" style={{ gap: 10, marginBottom: 8 }}>
              <span style={{ color: "var(--accent)" }}><Icon name={card.icon} size={16} /></span>
              <span className="strong small">{card.title}</span>
            </div>
            <p className="muted tiny" style={{ margin: 0 }}>{card.body}</p>
            <Button size="sm" variant="ghost" icon="chevronRight" style={{ marginTop: 10, paddingInline: 0 }} onClick={() => setRoute(card.route)}>Open</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
