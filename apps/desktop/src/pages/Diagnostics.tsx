import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Card, Icon, Input, Select, Spinner, Stat } from "@aria/ui";
import { api, errorText, formatDate } from "@aria/core";
import { CATEGORIES, FEATURES, REGISTRY_HEALTH, STATUS_LABELS, featureStats, type FeatureStatus } from "@aria/feature-registry";
import { useApp } from "../store";
import { useAction, useRegistrySummary } from "../lib/hooks";
import { PageHeader } from "../components/shell";

export function DiagnosticsPage() {
  const boot = useApp((state) => state.boot);
  const toast = useApp((state) => state.toast);
  const saveSettings = useApp((state) => state.saveSettings);
  const report = useQuery({ queryKey: ["diagnostics"], queryFn: api.diagnosticsRun });
  const registry = useRegistrySummary();
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const stats = useMemo(() => featureStats(), []);

  const sync = useAction(() => api.registrySync(FEATURES.map((feature) => ({
    id: feature.id,
    category: feature.category,
    category_label: feature.categoryLabel,
    name: feature.name,
    description: feature.description,
    status: feature.status,
    availability: feature.availability,
    dependencies: feature.dependencies,
    test_status: feature.testStatus,
  }))), {
    success: (result) => `${result.synced} feature rows synced into SQLite`,
    onDone: () => registry.refetch(),
  });

  const exportReport = useAction(() => api.diagnosticsExport(), {
    success: (result) => `Saved to ${result.dir}`,
  });

  const features = useMemo(() => FEATURES.filter((feature) => {
    if (statusFilter !== "all" && feature.status !== statusFilter) return false;
    if (categoryFilter !== "all" && feature.category !== categoryFilter) return false;
    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      return `${feature.id} ${feature.name} ${feature.description}`.toLowerCase().includes(needle);
    }
    return true;
  }), [statusFilter, categoryFilter, search]);

  const data = report.data;

  return (
    <div className="page fade-in">
      <PageHeader
        title="Diagnostics & Feature Registry"
        description="A live self-check of the installation plus the honest 300-feature matrix. Nothing here is aspirational: status reflects what the code actually does."
        actions={
          <>
            <Button icon="refresh" onClick={() => report.refetch()}>Run checks</Button>
            <Button icon="download" loading={exportReport.isPending} onClick={() => exportReport.mutate([])}>Export report</Button>
            <Button variant="primary" icon="list" loading={sync.isPending} onClick={() => sync.mutate([])}>Sync registry</Button>
          </>
        }
      />

      <div className="grid cols-4">
        <Stat label="Registry" value={`${stats.total}/300`} sub={REGISTRY_HEALTH.complete ? "complete matrix" : "incomplete"} icon="list" />
        <Stat label="Implemented / tested" value={stats.shipped} sub={`${stats.completion}% of features`} icon="check" />
        <Stat label="Partial" value={stats.partial} sub="works with limits" icon="alert" />
        <Stat label="Unsupported" value={stats.unsupported} sub="engine cannot expose" icon="close" />
      </div>

      <div className="grid split" style={{ marginTop: 16 }}>
        <Card>
          <div className="section-title">
            <h2>Installation checks</h2>
            {report.isLoading ? <Spinner label="Running…" /> : data ? <Badge tone={data.overall === "ok" ? "ok" : data.overall === "warn" ? "warn" : "err"}>{data.overall}</Badge> : null}
          </div>
          {data ? (
            <>
              <div className="list">
                {data.checks.map((check) => (
                  <div className="list-row" key={check.id} style={{ alignItems: "flex-start", paddingBlock: 10 }}>
                    <span style={{ color: check.status === "ok" ? "var(--ok)" : check.status === "warn" ? "var(--warn)" : "var(--err)", marginTop: 2 }}>
                      <Icon name={check.status === "ok" ? "check" : "alert"} size={13} />
                    </span>
                    <div style={{ flex: 1 }}>
                      <div className="small strong">{check.label}</div>
                      <div className="tiny muted">{check.detail}</div>
                      {check.hint ? <div className="tiny dim" style={{ marginTop: 2 }}>{check.hint}</div> : null}
                    </div>
                    <Badge tone={check.status === "ok" ? "ok" : check.status === "warn" ? "warn" : "err"}>{check.status}</Badge>
                  </div>
                ))}
              </div>
              <div className="row between" style={{ marginTop: 10 }}>
                <span className="tiny dim">generated {formatDate(data.generated_at)}</span>
                <span className="tiny dim">{data.errors} error(s) · {data.warnings} warning(s)</span>
              </div>
            </>
          ) : null}
        </Card>

        <div className="stack">
          <Card>
            <div className="section-title"><h2>Environment</h2></div>
            <div className="list">
              <div className="list-row"><Icon name="cpu" size={13} /><span className="small" style={{ flex: 1 }}>Platform</span><span className="mono tiny">{boot?.platform}</span></div>
              <div className="list-row"><Icon name="terminal" size={13} /><span className="small" style={{ flex: 1 }}>Codex</span><span className="mono tiny truncate" style={{ maxWidth: 200 }}>{boot?.codex.path || "missing"}</span></div>
              <div className="list-row"><Icon name="database" size={13} /><span className="small" style={{ flex: 1 }}>Images indexed</span><span className="mono tiny">{boot?.counts.images ?? 0}</span></div>
              <div className="list-row"><Icon name="list" size={13} /><span className="small" style={{ flex: 1 }}>Features in DB</span><span className="mono tiny">{boot?.counts.features ?? 0}</span></div>
            </div>
            <div className="row wrap" style={{ marginTop: 10 }}>
              <Button size="sm" icon="folder" onClick={() => { if (boot?.paths.logs) void api.openPath(boot.paths.logs).catch(() => undefined); }}>Open logs</Button>
              <Button size="sm" variant="ghost" icon="folder" onClick={() => { if (boot?.paths.exports) void api.openPath(boot.paths.exports).catch(() => undefined); }}>Open exports</Button>
            </div>
          </Card>

          <Card>
            <div className="section-title"><h2>Health actions</h2></div>
            <div className="row wrap">
              <Button size="sm" icon="key" onClick={() => useApp.getState().setRoute("auth")}>Check credentials</Button>
              <Button size="sm" icon="download" onClick={async () => {
                try { await api.codexInstallSkill(); toast("Skill re-installed", "ok"); report.refetch(); }
                catch (error) { toast(errorText(error), "err"); }
              }}>Repair skill</Button>
              <Button size="sm" variant="ghost" icon="save" onClick={async () => {
                try { await saveSettings({}); toast("Settings re-saved and validated", "ok"); }
                catch (error) { toast(errorText(error), "err"); }
              }}>Re-save settings</Button>
            </div>
            <div className="divider" style={{ margin: "10px 0" }} />
            <div className="tiny muted">Registry health: {REGISTRY_HEALTH.actual} rows · duplicates {REGISTRY_HEALTH.duplicateIds} · expected {REGISTRY_HEALTH.expected}</div>
            <div className="tiny muted">Database rows: {registry.data?.total ?? 0}</div>
          </Card>
        </div>
      </div>

      <Card style={{ marginTop: 16 }}>
        <div className="section-title">
          <h2>Feature matrix (300)</h2>
          <div className="row wrap" style={{ gap: 6 }}>
            <div style={{ width: 190 }}>
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search features…" />
            </div>
            <div style={{ width: 170 }}>
              <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Status"
                options={[{ value: "all", label: "All statuses" }, ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))]} />
            </div>
            <div style={{ width: 210 }}>
              <Select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Category"
                options={[{ value: "all", label: "All categories" }, ...CATEGORIES.map((category) => ({ value: category.id, label: category.label }))]} />
            </div>
          </div>
        </div>
        <div className="tiny muted" style={{ marginBottom: 8 }}>{features.length} feature(s) shown</div>
        <div style={{ maxHeight: 460, overflow: "auto" }}>
          <table className="table">
            <thead>
              <tr><th>#</th><th>Feature</th><th>Category</th><th>Status</th><th>Availability</th><th>Test</th></tr>
            </thead>
            <tbody>
              {features.map((feature) => (
                <tr key={feature.id}>
                  <td className="mono tiny">{feature.id}</td>
                  <td>
                    <div className="small">{feature.name}</div>
                    <div className="tiny dim" style={{ maxWidth: "52ch" }}>{feature.description}</div>
                  </td>
                  <td className="tiny muted">{feature.categoryLabel}</td>
                  <td><Badge tone={feature.status === "tested" || feature.status === "implemented" ? "ok" : feature.status === "partial" ? "warn" : feature.status === "unsupported" || feature.status === "blocked" ? "err" : "default"}>{STATUS_LABELS[feature.status as FeatureStatus]}</Badge></td>
                  <td className="tiny muted">{feature.availability}</td>
                  <td className="tiny dim">{feature.testStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row wrap" style={{ marginTop: 10 }}>
          <Button size="sm" icon="download" onClick={async () => {
            try { const result = await api.registryExport(); toast(`Markdown written to ${result.path}`, "ok"); }
            catch (error) { toast(errorText(error), "err"); }
          }}>Export markdown</Button>
          <span className="dim tiny">The same file is used to generate FEATURES-300.md for the release.</span>
        </div>
      </Card>
    </div>
  );
}
