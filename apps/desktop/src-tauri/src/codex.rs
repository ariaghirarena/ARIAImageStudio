//! Codex runtime integration: locating the official CLI, streaming `codex exec`
//! JSONL, login/logout/status flows and model catalog discovery.
//!
//! All invocations run with an ARIA-owned `CODEX_HOME`, so the user's personal
//! Codex configuration is never modified.

use crate::error::{AppError, AppResult};
use crate::security::redact;
use serde::Serialize;
use serde_json::Value;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{channel, RecvTimeoutError};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime};

#[derive(Debug, Clone, Serialize, Default)]
pub struct CodexInfo {
    pub found: bool,
    pub path: String,
    pub version: String,
    pub source: String,
    pub auth_present: bool,
    pub skill_present: bool,
    pub codex_home: String,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct AuthStatus {
    pub authenticated: bool,
    pub mode: String,
    pub detail: String,
    pub checked_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CodexModel {
    pub id: String,
    pub label: String,
    pub source: String,
}

fn is_executable(path: &Path) -> bool {
    path.is_file()
}

/// Resolve the codex binary: explicit setting, PATH, npm global prefixes and
/// well-known install locations, then `where`/`which` as a last resort.
pub fn locate(manual: &str) -> Option<PathBuf> {
    if !manual.trim().is_empty() {
        let p = PathBuf::from(manual.trim().trim_matches('"'));
        if is_executable(&p) {
            return Some(p);
        }
    }
    let names = ["codex.exe", "codex.cmd", "codex"];
    if let Ok(path_var) = std::env::var("PATH") {
        for dir in std::env::split_paths(&path_var) {
            for name in names {
                let candidate = dir.join(name);
                if is_executable(&candidate) {
                    return Some(candidate);
                }
            }
        }
    }
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(appdata) = std::env::var("APPDATA") {
        candidates.push(PathBuf::from(&appdata).join("npm").join("codex.cmd"));
        candidates.push(PathBuf::from(&appdata).join("npm").join("codex.exe"));
    }
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        candidates.push(PathBuf::from(&local).join("Programs").join("codex").join("codex.exe"));
        candidates.push(PathBuf::from(&local).join("Microsoft").join("WinGet").join("Links").join("codex.exe"));
    }
    if let Ok(home) = std::env::var("USERPROFILE") {
        candidates.push(PathBuf::from(&home).join(".codex").join("bin").join("codex.exe"));
        candidates.push(PathBuf::from(&home).join(".local").join("bin").join("codex"));
    }
    for candidate in candidates {
        if is_executable(&candidate) {
            return Some(candidate);
        }
    }
    let finder = if cfg!(windows) { "where" } else { "which" };
    if let Ok(output) = crate::sysproc::new(finder).arg("codex").output() {
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            if let Some(first) = text.lines().map(str::trim).find(|l| !l.is_empty()) {
                let p = PathBuf::from(first);
                if is_executable(&p) {
                    return Some(p);
                }
            }
        }
    }
    None
}

/// Bypass npm's cmd shim when its official JS entry point is present.
/// This keeps paths with spaces, multiline prompts and shell metacharacters
/// in a native argument vector rather than interpolating them through cmd /C.
fn shell_command(exe: &Path) -> Command {
    #[cfg(windows)]
    if exe.extension().map(|ext| ext.eq_ignore_ascii_case("cmd") || ext.eq_ignore_ascii_case("bat")).unwrap_or(false) {
        if let Some(prefix) = exe.parent() {
            let script = prefix.join("node_modules").join("@openai").join("codex").join("bin").join("codex.js");
            if script.is_file() {
                let local_node = prefix.join("node.exe");
                let node = if local_node.is_file() { local_node } else { PathBuf::from("node.exe") };
                let mut cmd = crate::sysproc::new(node);
                cmd.arg(script);
                return cmd;
            }
        }
    }
    // Rust handles .bat/.cmd quoting on Windows itself. Do not manually
    // wrap in `cmd /C`: that loses the executable's outer quoting.
    crate::sysproc::new(exe)
}

pub fn info(manual_path: &str, codex_home: &Path) -> CodexInfo {
    let mut info = CodexInfo {
        codex_home: codex_home.to_string_lossy().to_string(),
        ..Default::default()
    };
    if let Some(path) = locate(manual_path) {
        info.found = true;
        info.source = "detected".into();
        info.path = path.to_string_lossy().to_string();
        let mut cmd = shell_command(&path);
        cmd.arg("--version");
        cmd.env("CODEX_HOME", codex_home);
        cmd.stdin(Stdio::null());
        if let Ok(out) = cmd.output() {
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
            info.version = if stdout.is_empty() { stderr } else { stdout };
            info.version = redact(&info.version);
        }
    }
    info.auth_present = codex_home.join("auth.json").is_file();
    info.skill_present = skill_installed(codex_home);
    info
}

pub fn skill_installed(codex_home: &Path) -> bool {
    let skills = codex_home.join("skills");
    if !skills.is_dir() {
        return false;
    }
    for entry in walkdir::WalkDir::new(&skills).max_depth(4).into_iter().flatten() {
        if entry.file_type().is_file()
            && entry.file_name().to_string_lossy().eq_ignore_ascii_case("SKILL.md")
        {
            if let Ok(raw) = std::fs::read_to_string(entry.path()) {
                if raw.to_lowercase().contains("image_gen") {
                    return true;
                }
            }
        }
    }
    false
}

const ARIA_SKILL: &str = r#"---
name: "aria-imagegen"
description: "Generate or edit raster images with the built-in image_gen tool for ARIA Image Studio requests."
---

# ARIA Image Studio image skill

When a turn asks for an image, use the built-in `image_gen` tool.

Rules:
- Use the built-in `image_gen` tool only. Never run `image_gen.py`, never use `OPENAI_API_KEY` and never call an image API directly.
- Do not invent extra subjects, brand names, or text that the request does not contain.
- For edits, change only what the request asks for and keep every other element identical.
- For transparent output, ask `image_gen` for a genuinely transparent background and keep the alpha channel.
- Save project-bound results by copying the generated file into the working directory under `generated/`.
"#;

/// Install the ARIA skill plus the official imagegen skill placeholder into the
/// ARIA-owned CODEX_HOME so the built-in tool is discoverable in prompts.
pub fn install_skill(codex_home: &Path) -> AppResult<String> {
    let dir = codex_home.join("skills").join("aria-imagegen");
    std::fs::create_dir_all(&dir)?;
    let path = dir.join("SKILL.md");
    std::fs::write(&path, ARIA_SKILL)?;
    Ok(path.to_string_lossy().to_string())
}

pub fn models_from_cache(codex_home: &Path) -> Vec<CodexModel> {
    let candidates = [
        codex_home.join("models_cache.json"),
        codex_home.join("models.json"),
    ];
    for path in candidates {
        let Ok(raw) = std::fs::read_to_string(&path) else { continue };
        let Ok(json) = serde_json::from_str::<Value>(&raw) else { continue };
        let array = json
            .as_array()
            .cloned()
            .or_else(|| json.get("models").and_then(|v| v.as_array()).cloned())
            .or_else(|| json.get("data").and_then(|v| v.as_array()).cloned());
        let Some(array) = array else { continue };
        let mut models = Vec::new();
        for item in array {
            let id = ["slug", "id", "model", "name"]
                .iter()
                .find_map(|key| item.get(key).and_then(|v| v.as_str()))
                .unwrap_or_default()
                .to_string();
            if id.is_empty() {
                continue;
            }
            let label = ["display_name", "displayName", "title", "name"]
                .iter()
                .find_map(|key| item.get(key).and_then(|v| v.as_str()))
                .map(|s| s.to_string())
                .unwrap_or_else(|| id.clone());
            models.push(CodexModel { id, label, source: "codex models cache".into() });
        }
        if !models.is_empty() {
            return models;
        }
    }
    Vec::new()
}

#[derive(Debug, Clone, Serialize)]
pub struct LogLine {
    pub level: String,
    pub text: String,
}

#[derive(Debug, Default)]
pub struct ExecOutcome {
    pub exit_code: Option<i32>,
    pub timed_out: bool,
    pub cancelled: bool,
    pub last_message: String,
    pub log: Vec<LogLine>,
    pub stderr_tail: String,
}

#[derive(Debug, Clone)]
pub struct ExecOptions {
    pub codex_path: String,
    pub codex_home: PathBuf,
    pub workdir: PathBuf,
    pub model: Option<String>,
    pub reasoning_effort: Option<String>,
    pub verbosity: Option<String>,
    pub sandbox_mode: Option<String>,
    pub images: Vec<PathBuf>,
    pub timeout: Duration,
    pub extra_args: Vec<String>,
}

impl ExecOptions {
    pub fn build(&self, prompt: &str) -> AppResult<Command> {
        let exe = locate(&self.codex_path);
        let Some(exe) = exe else {
            return Err(AppError::new(
                "codex_not_found",
                "The Codex CLI was not found on this computer",
            )
            .with_hint("Install it with `npm install -g @openai/codex`, or set the codex.exe path in Settings."));
        };
        std::fs::create_dir_all(&self.workdir)?;
        let mut cmd = shell_command(&exe);
        cmd.arg("exec")
            .arg("--json")
            .arg("--skip-git-repo-check")
            .arg("-C")
            .arg(&self.workdir);
        if let Some(model) = &self.model {
            if !model.trim().is_empty() {
                cmd.arg("-m").arg(model.trim());
            }
        }
        if let Some(effort) = &self.reasoning_effort {
            if !effort.trim().is_empty() {
                cmd.arg("-c")
                    .arg(format!("model_reasoning_effort=\"{}\"", effort.trim()));
            }
        }
        if let Some(verbosity) = &self.verbosity {
            if !verbosity.trim().is_empty() {
                cmd.arg("-c")
                    .arg(format!("model_verbosity=\"{}\"", verbosity.trim()));
            }
        }
        if let Some(sandbox) = &self.sandbox_mode {
            if !sandbox.trim().is_empty() {
                cmd.arg("-s").arg(sandbox.trim());
            }
        }
        for image in &self.images {
            if image.is_file() {
                cmd.arg("-i").arg(image);
            }
        }
        for arg in &self.extra_args {
            cmd.arg(arg);
        }
        cmd.arg("--").arg(prompt);
        cmd.env("CODEX_HOME", &self.codex_home);
        cmd.env("RUST_BACKTRACE", "0");
        cmd.stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        Ok(cmd)
    }
}

/// Run `codex exec` and stream redacted output lines through `on_line`.
pub fn run(
    options: &ExecOptions,
    prompt: &str,
    cancel: Arc<AtomicBool>,
    mut on_line: impl FnMut(&LogLine),
) -> AppResult<ExecOutcome> {
    let mut cmd = options.build(prompt)?;
    let mut child: Child = cmd
        .spawn()
        .map_err(|e| AppError::new("codex_spawn_failed", format!("Could not start Codex: {e}")))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let (tx, rx) = channel::<(String, String)>();

    if let Some(stdout) = stdout {
        let tx = tx.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                let _ = tx.send(("stdout".to_string(), line));
            }
        });
    }
    if let Some(stderr) = stderr {
        let tx = tx.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                let _ = tx.send(("stderr".to_string(), line));
            }
        });
    }
    drop(tx);

    let start = Instant::now();
    let mut outcome = ExecOutcome::default();
    let mut stderr_tail: Vec<String> = Vec::new();
    let mut last_json_message = String::new();

    loop {
        if cancel.load(Ordering::Relaxed) {
            outcome.cancelled = true;
            terminate(&mut child);
            break;
        }
        if start.elapsed() > options.timeout {
            outcome.timed_out = true;
            terminate(&mut child);
            break;
        }
        match rx.recv_timeout(Duration::from_millis(200)) {
            Ok((stream, line)) => {
                let clean = redact(&line);
                if stream == "stdout" {
                    if let Ok(event) = serde_json::from_str::<Value>(&clean) {
                        if let Some(text) = extract_agent_text(&event) {
                            last_json_message = text;
                        }
                        if let Some(rendered) = render_event(&event) {
                            let log_line = LogLine { level: "info".into(), text: rendered };
                            on_line(&log_line);
                            outcome.log.push(log_line);
                        }
                    } else if !clean.trim().is_empty() {
                        let log_line = LogLine { level: "raw".into(), text: clean.clone() };
                        on_line(&log_line);
                        outcome.log.push(log_line);
                    }
                } else {
                    stderr_tail.push(clean.clone());
                    if stderr_tail.len() > 60 {
                        stderr_tail.remove(0);
                    }
                    if !clean.trim().is_empty() {
                        let log_line = LogLine { level: "stderr".into(), text: clean };
                        on_line(&log_line);
                        outcome.log.push(log_line);
                    }
                }
            }
            Err(RecvTimeoutError::Timeout) => {
                if let Ok(Some(status)) = child.try_wait() {
                    outcome.exit_code = status.code();
                    break;
                }
            }
            Err(RecvTimeoutError::Disconnected) => {
                let status = child.wait().ok();
                outcome.exit_code = status.and_then(|s| s.code());
                break;
            }
        }
    }

    if outcome.exit_code.is_none() && !outcome.cancelled && !outcome.timed_out {
        if let Ok(status) = child.wait() {
            outcome.exit_code = status.code();
        }
    }
    outcome.stderr_tail = stderr_tail.join("\n");
    outcome.last_message = last_json_message;
    Ok(outcome)
}

fn terminate(child: &mut Child) {
    #[cfg(windows)]
    {
        let pid = child.id();
        let _ = crate::sysproc::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    let _ = child.kill();
    let _ = child.wait();
}

/// Pull readable text out of an `item.completed` agent message event.
fn extract_agent_text(event: &Value) -> Option<String> {
    let item = event.get("item")?;
    let kind = item.get("item_type").or_else(|| item.get("type"))?.as_str()?;
    if kind.contains("agent_message") || kind == "assistant_message" {
        if let Some(text) = item.get("text").and_then(|v| v.as_str()) {
            return Some(text.to_string());
        }
    }
    None
}

/// Compact one-line rendering of a JSONL event for the live log panel.
fn render_event(event: &Value) -> Option<String> {
    let event_type = event.get("type")?.as_str()?;
    match event_type {
        "thread.started" => Some("نشست شروع شد".to_string()),
        "turn.started" => Some("پردازش شروع شد".to_string()),
        "turn.completed" => event
            .get("usage")
            .map(|usage| format!("turn completed {}", usage))
            .or_else(|| Some("turn completed".to_string())),
        "turn.failed" => event
            .get("error")
            .and_then(|e| e.get("message"))
            .and_then(|m| m.as_str())
            .map(|m| format!("turn failed: {m}")),
        "item.started" | "item.updated" | "item.completed" => {
            let item = event.get("item")?;
            let kind = item
                .get("item_type")
                .or_else(|| item.get("type"))
                .and_then(|v| v.as_str())
                .unwrap_or("item");
            let detail = item
                .get("text")
                .and_then(|v| v.as_str())
                .map(|t| t.chars().take(400).collect::<String>())
                .or_else(|| {
                    item.get("command")
                        .and_then(|v| v.as_str())
                        .map(|c| c.to_string())
                })
                .unwrap_or_default();
            let state = event_type.trim_start_matches("item.").to_string();
            Some(format!("{kind} [{state}] {detail}").trim_end().to_string())
        }
        "error" => event
            .get("message")
            .and_then(|v| v.as_str())
            .map(|m| format!("error: {m}")),
        other => Some(other.to_string()),
    }
}

pub fn login_status(codex_home: &Path, manual_path: &str) -> AuthStatus {
    let mut status = AuthStatus {
        authenticated: false,
        mode: "unknown".into(),
        detail: String::new(),
        checked_at: crate::db::now(),
    };
    let Some(exe) = locate(manual_path) else {
        status.detail = "ابزار Codex پیدا نشد".into();
        return status;
    };
    let mut cmd = shell_command(&exe);
    cmd.args(["login", "status"]);
    cmd.env("CODEX_HOME", codex_home);
    cmd.stdin(Stdio::null());
    let output = cmd.output();
    match output {
        Ok(out) => {
            let raw = format!(
                "{}\n{}",
                String::from_utf8_lossy(&out.stdout),
                String::from_utf8_lossy(&out.stderr)
            );
            let text = redact(&raw);
            let lower = text.to_lowercase();
            status.authenticated = out.status.success() && lower.contains("logged in");
            if lower.contains("chatgpt") {
                status.mode = "chatgpt".into();
            } else if lower.contains("api key") {
                status.mode = "api_key".into();
            }
            status.detail = if status.authenticated {
                "ورود به حساب تأیید شد".into()
            } else {
                "ورود به حساب تأیید نشد؛ دوباره وارد شوید یا نصب Codex را بررسی کنید".into()
            };
        }
        Err(err) => {
            status.detail = format!("بررسی وضعیت ورود انجام نشد: {err}");
        }
    }
    status
}

/// Start a login flow. `device` selects `codex login --device-auth`.
pub fn spawn_login(codex_home: &Path, device: bool) -> AppResult<Child> {
    let exe = locate("").ok_or_else(|| {
        AppError::new("codex_not_found", "The Codex CLI was not found on this computer")
            .with_hint("Install it with `npm install -g @openai/codex` first.")
    })?;
    std::fs::create_dir_all(codex_home)?;
    let mut cmd = shell_command(&exe);
    cmd.arg("login");
    if device {
        cmd.arg("--device-auth");
    }
    cmd.env("CODEX_HOME", codex_home);
    cmd.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    cmd.spawn()
        .map_err(|e| AppError::new("codex_spawn_failed", format!("Could not start Codex login: {e}")))
}

pub fn logout(codex_home: &Path) -> AppResult<()> {
    if let Some(exe) = locate("") {
        let mut cmd = shell_command(&exe);
        cmd.arg("logout");
        cmd.env("CODEX_HOME", codex_home);
        cmd.stdin(Stdio::null());
        let _ = cmd.output();
    }
    Ok(())
}

/// Validate auth.json structure without ever reading token values into a
/// response. Only null/non-null presence checks are performed.
pub fn validate_auth_json(path: &Path) -> AppResult<String> {
    let raw = std::fs::read_to_string(path)?;
    let json: Value = serde_json::from_str(&raw)
        .map_err(|_| AppError::new("invalid_auth_file", "The selected file is not valid JSON"))?;
    let obj = json
        .as_object()
        .ok_or_else(|| AppError::new("invalid_auth_file", "auth.json must contain a JSON object"))?;
    let has_tokens = obj.get("tokens").map(|v| !v.is_null()).unwrap_or(false);
    let has_api_key = obj
        .get("OPENAI_API_KEY")
        .map(|v| !v.is_null())
        .unwrap_or(false);
    let has_agent_identity = obj.get("agent_identity").map(|v| !v.is_null()).unwrap_or(false);
    if has_tokens {
        let tokens = obj.get("tokens").and_then(|v| v.as_object());
        let access = tokens
            .and_then(|t| t.get("access_token"))
            .and_then(|v| v.as_str())
            .map(|s| !s.is_empty())
            .unwrap_or(false);
        let refresh = tokens
            .and_then(|t| t.get("refresh_token"))
            .and_then(|v| v.as_str())
            .map(|s| !s.is_empty())
            .unwrap_or(false);
        if !access && !refresh {
            return Err(AppError::new(
                "invalid_auth_file",
                "auth.json contains a tokens object without usable token fields",
            ));
        }
        return Ok("chatgpt".into());
    }
    if has_api_key {
        return Ok("api_key".into());
    }
    if has_agent_identity {
        return Ok("agent_identity".into());
    }
    Err(AppError::new(
        "invalid_auth_file",
        "auth.json has no recognised authentication material",
    )
    .with_hint("Import the auth.json produced by `codex login` on a machine where Codex is signed in."))
}

/// Newest modification time in a directory tree (used to detect fresh output).
pub fn newest_mtime(root: &Path) -> Option<SystemTime> {
    walkdir::WalkDir::new(root)
        .into_iter()
        .flatten()
        .filter_map(|entry| entry.metadata().ok().and_then(|m| m.modified().ok()))
        .max()
}

#[cfg(all(test, windows))]
mod windows_launch_tests {
    use super::*;

    #[test]
    fn npm_shim_path_with_spaces_preserves_literal_arguments() {
        let root = std::env::temp_dir().join(format!("ARIA PARDAZESH user {}", uuid::Uuid::new_v4()));
        let prefix = root.join("npm global");
        let bin = prefix.join("node_modules/@openai/codex/bin");
        std::fs::create_dir_all(&bin).unwrap();
        let shim = prefix.join("codex.cmd");
        // If the shim is accidentally used, fail the test immediately.
        std::fs::write(&shim, "@exit /b 99\r\n").unwrap();
        std::fs::write(bin.join("codex.js"), "process.stdout.write(JSON.stringify(process.argv.slice(2)))").unwrap();
        let args = ["exec", "--json", "-C", root.to_str().unwrap(), "--", "ماشین رولزرویس\nquoted \"car\" & echo BAD | more < > %PATH% !VAR! ^ ()"];
        let output = shell_command(&shim).args(args).output().unwrap();
        assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
        let received: Vec<String> = serde_json::from_slice(&output.stdout).unwrap();
        assert_eq!(received, args);
        assert_eq!(locate(&format!("\"{}\"", shim.display())).unwrap(), shim);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn custom_batch_path_with_spaces_uses_rust_quoting() {
        let root = std::env::temp_dir().join(format!("ARIA custom cli {}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let shim = root.join("codex.cmd");
        std::fs::write(&shim, "@echo off\r\necho %~1\r\n").unwrap();
        let output = shell_command(&shim).arg("--version").output().unwrap();
        assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
        assert_eq!(String::from_utf8_lossy(&output.stdout).trim(), "--version");
        std::fs::remove_dir_all(root).unwrap();
    }
}
