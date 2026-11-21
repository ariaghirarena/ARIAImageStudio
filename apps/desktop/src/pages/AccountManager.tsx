import { useState } from "react";
import { Badge, Button, Card, EmptyState, Icon, Modal, Spinner, ToggleRow } from "@aria/ui";
import { api, errorText, formatDate, type Profile } from "@aria/core";
import { useApp } from "../store";
import { useProfiles, useAction } from "../lib/hooks";
import { PageHeader } from "../components/shell";

export function AccountsPage() {
  const boot = useApp((state) => state.boot);
  const refresh = useApp((state) => state.refresh);
  const saveSettings = useApp((state) => state.saveSettings);
  const toast = useApp((state) => state.toast);
  const profiles = useProfiles();
  const [confirm, setConfirm] = useState<Profile | null>(null);

  const setActive = useAction((id: string) => api.authSetActive(id), { success: "Active account switched", onDone: () => { void refresh(); profiles.refetch(); } });
  const check = useAction((id: string) => api.authStatus(id), {
    success: (result) => result.authenticated ? "Session is valid" : `Not signed in — ${result.detail}`,
    onDone: () => profiles.refetch(),
  });
  const logout = useAction((id: string) => api.authLogout(id), { success: "Signed out; local credentials wiped", onDone: () => { void refresh(); profiles.refetch(); } });

  const activeId = boot?.settings.active_profile_id ?? "";

  return (
    <div className="page fade-in">
      <PageHeader
        title="Accounts"
        description="Multiple isolated Codex accounts, each with its own CODEX_HOME. Switching never copies credentials between them."
        actions={
          <>
            <Button icon="refresh" onClick={() => { profiles.refetch(); void refresh(); }}>Rescan</Button>
            <Button variant="primary" icon="plus" onClick={() => useApp.getState().setRoute("auth")}>Add account</Button>
          </>
        }
      />

      {profiles.isLoading ? <Spinner label="Loading accounts…" /> : null}
      {profiles.data && profiles.data.length === 0 ? (
        <EmptyState icon="user" title="No accounts connected" description="Import an auth.json or sign in with ChatGPT to add the first isolated Codex profile."
          action={<Button variant="primary" icon="key" onClick={() => useApp.getState().setRoute("auth")}>Connect account</Button>} />
      ) : null}

      <div className="grid cols-2">
        {profiles.data?.map((profile) => (
          <Card key={profile.id} highlight={profile.id === activeId}>
            <div className="row between" style={{ marginBottom: 10 }}>
              <div className="row" style={{ gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                  <Icon name="user" size={15} />
                </div>
                <div>
                  <div className="strong small">{profile.name}</div>
                  <div className="tiny muted">created {formatDate(profile.created_at)}</div>
                </div>
              </div>
              {profile.id === activeId ? <Badge tone="accent">active</Badge> : <Button size="sm" loading={setActive.isPending} onClick={() => setActive.mutate([profile.id])}>Use</Button>}
            </div>
            <div className="row wrap" style={{ gap: 6 }}>
              <Badge tone={profile.status === "authenticated" ? "ok" : profile.status === "credentials_present" ? "warn" : "err"}>{profile.status.replace("_", " ")}</Badge>
              <Badge>{profile.auth_mode || "unknown mode"}</Badge>
              <Badge>isolated home</Badge>
            </div>
            <div className="mono-path" style={{ marginTop: 8 }}>{boot?.paths.profiles ?? ""}\{profile.id}\codex</div>
            <div className="tiny muted" style={{ marginTop: 6 }}>last checked {formatDate(profile.last_checked)}</div>
            {profile.last_error ? <div className="tiny" style={{ color: "#fecaca", marginTop: 4 }}>{profile.last_error}</div> : null}
            <div className="row wrap" style={{ marginTop: 10, gap: 6 }}>
              <Button size="sm" icon="activity" loading={check.isPending} onClick={() => check.mutate([profile.id])}>Verify</Button>
              <Button size="sm" variant="ghost" icon="key" onClick={async () => {
                try { await api.authRestoreVault(profile.id); toast("Credentials restored from the DPAPI vault", "ok"); }
                catch (error) { toast(errorText(error), "err"); }
              }}>Restore</Button>
              <Button size="sm" variant="ghost" icon="trash" onClick={() => setConfirm(profile)}>Remove</Button>
            </div>
            {profile.id === activeId ? (
              <div className="row" style={{ marginTop: 8 }}>
                <Button size="sm" variant="danger" icon="close" loading={logout.isPending} onClick={() => logout.mutate([profile.id])}>Sign out of this account</Button>
              </div>
            ) : null}
          </Card>
        ))}
      </div>

      <div className="grid split" style={{ marginTop: 18 }}>
        <Card>
          <div className="section-title"><h2>Credential handling</h2></div>
          <ToggleRow
            label="Keep DPAPI-encrypted credential backups"
            description="When enabled, ARIA stores an encrypted copy of auth.json so a corrupted replace can be undone. Tokens never enter SQLite."
            checked={boot?.settings.store_credentials_in_keyring ?? false}
            onChange={async (value) => {
              try { await saveSettings({ store_credentials_in_keyring: value }); toast(value ? "Encrypted backups enabled" : "Encrypted backups disabled", "ok"); }
              catch (error) { toast(errorText(error), "err"); }
            }}
          />
          <div className="divider" style={{ margin: "10px 0" }} />
          <ul className="small muted" style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.8 }}>
            <li>One folder per account under <span className="mono">profiles/</span>.</li>
            <li>Removing an account runs logout, overwrites files and deletes the folder.</li>
            <li>No credential is ever displayed, exported or logged.</li>
          </ul>
        </Card>
        <Card>
          <div className="section-title"><h2>Privacy</h2></div>
          <p className="muted small" style={{ marginTop: 0 }}>
            ARIA has no telemetry endpoint. Diagnostics stay on disk unless you export them yourself. Codex requests go directly
            from this machine to OpenAI using your own session.
          </p>
          <div className="row wrap">
            <Button size="sm" icon="activity" onClick={() => useApp.getState().setRoute("diagnostics")}>Diagnostics</Button>
            <Button size="sm" variant="ghost" icon="lock" onClick={() => useApp.getState().setRoute("auth")}>Security model</Button>
          </div>
        </Card>
      </div>

      <Modal open={Boolean(confirm)} title="Remove account" subtitle="Credentials are destroyed" onClose={() => setConfirm(null)}
        footer={<>
          <Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant="danger" icon="trash" onClick={async () => {
            if (!confirm) return;
            try {
              await api.authDelete(confirm.id, true);
              toast("Account removed", "ok");
              setConfirm(null);
              profiles.refetch();
              void refresh();
            } catch (error) { toast(errorText(error), "err"); }
          }}>Remove permanently</Button>
        </>}
      >
        <p className="small muted">
          ARIA will run <span className="mono">codex logout</span>, overwrite the credential files, delete the encrypted backup and remove
          the profile folder. Generated images stay in your projects.
        </p>
      </Modal>
    </div>
  );
}
