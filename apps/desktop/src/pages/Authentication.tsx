import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, CodeBlock, EmptyState, Icon, Input, Modal, Spinner } from "@aria/ui";
import { api, errorText, formatDate, isDesktopRuntime, onEvent, type Profile } from "@aria/core";
import { useApp } from "../store";
import { useAction, useProfiles } from "../lib/hooks";
import { PageHeader, PickerField } from "../components/shell";

export function AuthPage() {
  const boot = useApp((state) => state.boot);
  const refresh = useApp((state) => state.refresh);
  const toast = useApp((state) => state.toast);
  const profiles = useProfiles();

  const [sourcePath, setSourcePath] = useState("");
  const [profileName, setProfileName] = useState("");
  const [loginLog, setLoginLog] = useState<string[]>([]);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginDevice, setLoginDevice] = useState(false);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null);
  const [replaceFor, setReplaceFor] = useState<Profile | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const logRef = useRef<HTMLDivElement | null>(null);

  const activeProfileId = boot?.settings.active_profile_id ?? "";

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [loginLog]);

  useEffect(() => {
    let unlistenLine: (() => void) | undefined;
    let unlistenDone: (() => void) | undefined;
    void (async () => {
      unlistenLine = await onEvent<{ text: string }>("aria://login-line", (payload) => {
        setLoginLog((lines) => [...lines, payload.text].slice(-300));
      });
      unlistenDone = await onEvent<{ exit_code: number | null; status: { authenticated?: boolean; detail?: string } }>(
        "aria://login-finished",
        (payload) => {
          setLoginBusy(false);
          const ok = Boolean(payload.status?.authenticated);
          toast(ok ? "Codex account connected" : `Login finished without a session — ${payload.status?.detail ?? "check the log"}`, ok ? "ok" : "err");
          void refresh();
          profiles.refetch();
        },
      );
    })();
    return () => {
      unlistenLine?.();
      unlistenDone?.();
    };
  }, [profiles, refresh, toast]);

  const importAction = useAction(
    (path: string, name: string) => api.authImport(path, name),
    {
      success: "auth.json imported into an isolated ARIA profile",
      onDone: () => { setSourcePath(""); setProfileName(""); void refresh(); profiles.refetch(); },
    },
  );

  const replaceAction = useAction(
    (profileId: string, path: string) => api.authReplace(profileId, path),
    { success: "Credential replaced and encrypted backup refreshed", onDone: () => { setReplaceFor(null); setSourcePath(""); profiles.refetch(); } },
  );

  useEffect(() => {
    if (!isDesktopRuntime()) return;
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/webview").then(async ({ getCurrentWebview }) => {
      unlisten = await getCurrentWebview().onDragDropEvent((event) => {
        if (event.payload.type !== "drop") return;
        const candidate = event.payload.paths.find((path) => path.toLowerCase().endsWith(".json"));
        if (candidate) {
          setSourcePath(candidate);
          toast(`auth.json detected at ${candidate}`, "info");
        }
      });
    }).catch(() => undefined);
    return () => unlisten?.();
  }, [toast]);

  const checkStatus = async (profile: Profile) => {
    try {
      const result = await api.authStatus(profile.id);
      setStatusMap((map) => ({ ...map, [profile.id]: `${result.authenticated ? "Authenticated" : "Not authenticated"} · ${result.detail || "no detail"}` }));
      profiles.refetch();
      void refresh();
    } catch (error) {
      setStatusMap((map) => ({ ...map, [profile.id]: errorText(error) }));
    }
  };

  const startLogin = async () => {
    setLoginBusy(true);
    setLoginLog([]);
    try {
      await api.authLoginStart(activeProfileId, loginDevice);
    } catch (error) {
      setLoginBusy(false);
      toast(errorText(error), "err");
    }
  };

  const activeProfile = useMemo(
    () => profiles.data?.find((profile) => profile.id === activeProfileId),
    [profiles.data, activeProfileId],
  );

  return (
    <div className="page fade-in">
      <PageHeader
        title="Authentication"
        description="ARIA talks to your Codex account through an isolated CODEX_HOME. Import an existing auth.json or run the official ChatGPT login flow — tokens are never displayed, logged or written to the database."
        actions={
          <>
            <Button icon="refresh" onClick={() => { profiles.refetch(); void refresh(); }}>Rescan</Button>
            <Button variant="ghost" icon="activity" onClick={() => setAdvancedOpen(true)}>How it works</Button>
          </>
        }
      />

      <div className="grid split">
        <div className="stack">
          <Card highlight>
            <div className="section-title">
              <h2>Connect Codex account</h2>
              {activeProfile ? <Badge tone="ok">active · {activeProfile.name}</Badge> : <Badge tone="warn">no active profile</Badge>}
            </div>

            <div className="grid cols-2">
              <div className="stack">
                <PickerField
                  label="auth.json file"
                  mode="file"
                  value={sourcePath}
                  onChange={setSourcePath}
                  placeholder="C:\\Users\\you\\Downloads\\auth.json"
                  filter={(entry) => !entry.is_dir && entry.name.toLowerCase().endsWith(".json")}
                />
                <div className="field">
                  <span className="field-label">Profile name (optional)</span>
                  <Input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Personal ChatGPT account" />
                </div>
                <Button
                  variant="primary"
                  icon="key"
                  loading={importAction.isPending}
                  disabled={!sourcePath.trim()}
                  onClick={() => importAction.mutate([sourcePath, profileName])}
                >
                  Import auth.json
                </Button>
                <div className="field-hint">
                  The file is validated structurally, copied into an ARIA profile, ACL-hardened and backed up with DPAPI.
                  Drag &amp; drop a .json file anywhere on this page to stage it.
                </div>
              </div>

              <div className="stack">
                <div className="card tight" style={{ background: "rgba(125,211,252,.04)" }}>
                  <div className="strong small" style={{ marginBottom: 4 }}>Sign in with ChatGPT</div>
                  <p className="muted tiny" style={{ marginTop: 0 }}>
                    Runs <span className="mono">codex login</span> with CODEX_HOME pointed at the ARIA profile, so your personal
                    Codex configuration is never touched.
                  </p>
                  <div className="row wrap">
                    <Button variant="primary" icon="external" loading={loginBusy && !loginDevice} disabled={loginBusy} onClick={() => { setLoginDevice(false); void startLogin(); }}>
                      Sign in with ChatGPT
                    </Button>
                    <Button icon="key" loading={loginBusy && loginDevice} disabled={loginBusy} onClick={() => { setLoginDevice(true); void startLogin(); }}>
                      Device auth
                    </Button>
                  </div>
                </div>
                <div className="log-view" ref={logRef} style={{ minHeight: 120 }}>
                  {loginLog.length === 0 ? "Login output appears here (redacted)." : loginLog.join("\n")}
                </div>
                {loginBusy ? <Spinner label="Waiting for the Codex login to finish…" /> : null}
              </div>
            </div>
          </Card>

          <Card>
            <div className="section-title">
              <h2>Codex profiles</h2>
              <span>{profiles.data?.length ?? 0} profile(s) · isolated CODEX_HOME each</span>
            </div>
            {profiles.isLoading ? <Spinner label="Loading profiles…" /> : null}
            {profiles.data && profiles.data.length === 0 ? (
              <EmptyState
                icon="key"
                title="No Codex profile yet"
                description="Import auth.json or sign in with ChatGPT to create the first isolated profile. ARIA never stores token values in its database."
              />
            ) : null}
            <div className="list">
              {profiles.data?.map((profile) => (
                <div className="list-row" key={profile.id} style={{ alignItems: "flex-start", paddingBlock: 12 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                    <Icon name="user" size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row wrap" style={{ gap: 8 }}>
                      <span className="strong small">{profile.name}</span>
                      {profile.id === activeProfileId ? <Badge tone="accent">active</Badge> : null}
                      <Badge tone={profile.status === "authenticated" ? "ok" : profile.status === "credentials_present" ? "warn" : "default"}>
                        {profile.status.replace("_", " ")}
                      </Badge>
                      <Badge>{profile.auth_mode || "unknown"}</Badge>
                    </div>
                    <div className="muted tiny" style={{ marginTop: 4 }}>
                      last check: {formatDate(profile.last_checked)} · created {formatDate(profile.created_at)}
                    </div>
                    {statusMap[profile.id] ? <div className="tiny" style={{ marginTop: 4, color: "var(--text-soft)" }}>{statusMap[profile.id]}</div> : null}
                    {profile.last_error ? <div className="tiny" style={{ marginTop: 4, color: "#fecaca" }}>{profile.last_error}</div> : null}
                  </div>
                  <div className="row wrap" style={{ justifyContent: "flex-end", gap: 6 }}>
                    <Button size="sm" icon="activity" onClick={() => void checkStatus(profile)}>Check</Button>
                    {profile.id !== activeProfileId ? (
                      <Button size="sm" icon="check" onClick={async () => { await api.authSetActive(profile.id); await refresh(); profiles.refetch(); }}>Use</Button>
                    ) : null}
                    <Button size="sm" icon="refresh" onClick={() => { setReplaceFor(profile); setSourcePath(""); }}>Replace</Button>
                    <Button size="sm" icon="key" onClick={async () => {
                      try {
                        await api.authRestoreVault(profile.id);
                        toast("Credential restored from the DPAPI backup", "ok");
                        profiles.refetch();
                      } catch (error) { toast(errorText(error), "err"); }
                    }}>Restore</Button>
                    <Button size="sm" icon="trash" variant="danger" onClick={() => setConfirmDelete(profile)}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="section-title"><h2>Active session</h2></div>
            <div className="grid cols-3">
              <div>
                <div className="tiny muted">Login status</div>
                <div className="small strong">{activeProfile?.status ?? "no profile"}</div>
              </div>
              <div>
                <div className="tiny muted">Auth mode</div>
                <div className="small strong">{activeProfile?.auth_mode ?? "—"}</div>
              </div>
              <div>
                <div className="tiny muted">Last verified</div>
                <div className="small strong">{formatDate(activeProfile?.last_checked)}</div>
              </div>
            </div>
            <div className="row wrap" style={{ marginTop: 14 }}>
              <Button
                size="sm"
                variant="danger"
                icon="trash"
                disabled={!activeProfile}
                onClick={async () => {
                  if (!activeProfile) return;
                  try {
                    await api.authLogout(activeProfile.id);
                    toast("Signed out and local credentials wiped", "ok");
                    profiles.refetch();
                    void refresh();
                  } catch (error) { toast(errorText(error), "err"); }
                }}
              >
                Sign out
              </Button>
              <Button size="sm" variant="ghost" icon="terminal" onClick={() => setAdvancedOpen(true)}>Show CODEX_HOME layout</Button>
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <div className="section-title"><h2>Engine prerequisites</h2></div>
            <div className="list">
              {[
                { label: "Codex CLI installed", ok: Boolean(boot?.codex.found), detail: boot?.codex.version || "not detected" },
                { label: "Credentials present", ok: Boolean(boot?.codex.auth_present), detail: boot?.paths.codex_home ?? "" },
                { label: "imagegen skill in CODEX_HOME", ok: Boolean(boot?.codex.skill_present), detail: boot?.codex.skill_present ? "installed" : "install from AI Engine" },
              ].map((check) => (
                <div className="list-row" key={check.label}>
                  <span style={{ color: check.ok ? "var(--ok)" : "var(--warn)" }}><Icon name={check.ok ? "check" : "alert"} size={13} /></span>
                  <div style={{ flex: 1 }}>
                    <div className="small">{check.label}</div>
                    <div className="mono-path dim">{check.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="section-title"><h2>Security model</h2></div>
            <ul className="small muted" style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.8 }}>
              <li>Tokens are never parsed for display and never enter SQLite.</li>
              <li>auth.json is stored under an ARIA-owned profile folder with user-only ACLs.</li>
              <li>A DPAPI-encrypted backup allows recovery after a corrupted replace.</li>
              <li>Signing out wipes the local credential copy with an overwrite pass.</li>
              <li>Every generation runs in the workspace-write sandbox, not full access.</li>
            </ul>
          </Card>

          <Card tight>
            <div className="strong small" style={{ marginBottom: 6 }}>Official documentation</div>
            <div className="row wrap">
              <Button size="sm" icon="external" onClick={() => void api.openUrl("https://developers.openai.com/codex/auth").catch(() => undefined)}>Codex auth</Button>
              <Button size="sm" icon="external" onClick={() => void api.openUrl("https://github.com/openai/codex").catch(() => undefined)}>Codex repo</Button>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={advancedOpen}
        title="How ARIA uses Codex credentials"
        subtitle="No API key, no undocumented endpoints"
        onClose={() => setAdvancedOpen(false)}
      >
        <div className="stack">
          <p className="muted small" style={{ margin: 0 }}>
            ARIA runs the official CLI with a dedicated home. That home contains auth.json, config.toml, sessions and the
            <span className="mono"> generated_images</span> folder where the built-in tool writes its output.
          </p>
          <CodeBlock text={`%LOCALAPPDATA%\\ARIA\\ImageStudio\\
  profiles\\<profile-id>\\
    codex\\
      auth.json          (user-only ACL, never logged)
      auth.vault         (DPAPI-encrypted backup)
      config.toml        (per-profile Codex configuration)
      skills\\            (ARIA + imagegen skills)
      generated_images\\  (built-in tool output, imported by ARIA)
      sessions\\          (audit trail of runs)`} />
          <p className="muted small" style={{ margin: 0 }}>
            Login status is checked with <span className="mono">codex login status</span>; the raw output is redacted and
            only the presence of a session is recorded.
          </p>
        </div>
      </Modal>

      <Modal
        open={Boolean(replaceFor)}
        title="Replace credential"
        subtitle={replaceFor?.name}
        onClose={() => setReplaceFor(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReplaceFor(null)}>Cancel</Button>
            <Button
              variant="primary"
              loading={replaceAction.isPending}
              disabled={!sourcePath.trim()}
              onClick={() => { if (replaceFor) replaceAction.mutate([replaceFor.id, sourcePath]); }}
            >
              Replace auth.json
            </Button>
          </>
        }
      >
        <PickerField
          label="New auth.json"
          mode="file"
          value={sourcePath}
          onChange={setSourcePath}
          filter={(entry) => !entry.is_dir && entry.name.toLowerCase().endsWith(".json")}
        />
        <p className="muted tiny" style={{ marginTop: 10 }}>
          The previous credential is backed up with DPAPI before replacement, then the new file is validated and hardened.
        </p>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        title="Delete Codex account"
        subtitle="This cannot be undone"
        onClose={() => setConfirmDelete(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="danger"
              icon="trash"
              onClick={async () => {
                if (!confirmDelete) return;
                try {
                  await api.authDelete(confirmDelete.id, true);
                  toast("Profile and credentials securely deleted", "ok");
                  setConfirmDelete(null);
                  profiles.refetch();
                  void refresh();
                } catch (error) { toast(errorText(error), "err"); }
              }}
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="small muted">
          This runs <span className="mono">codex logout</span>, overwrites the stored credential files, deletes the encrypted
          backup and removes the profile folder. Images and prompts are not touched.
        </p>
      </Modal>
    </div>
  );
}
