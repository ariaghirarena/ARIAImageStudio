//! Self-checks with concrete, actionable remediation advice. Reports never
//! include credentials or private image content.

use crate::codex;
use crate::db;
use crate::paths::AppPaths;
use crate::settings::Settings;
use rusqlite::Connection;
use serde_json::{json, Value};
use std::path::Path;

#[cfg(windows)]
fn disk_free_bytes(path: &Path) -> Option<u64> {
    use std::os::windows::ffi::OsStrExt;
    extern "system" {
        fn GetDiskFreeSpaceExW(
            dir: *const u16,
            free_to_caller: *mut u64,
            total: *mut u64,
            total_free: *mut u64,
        ) -> i32;
    }
    let mut wide: Vec<u16> = path.as_os_str().encode_wide().collect();
    wide.push(0);
    let mut free = 0u64;
    let mut total = 0u64;
    let mut total_free = 0u64;
    let ok = unsafe { GetDiskFreeSpaceExW(wide.as_ptr(), &mut free, &mut total, &mut total_free) };
    if ok != 0 {
        Some(free)
    } else {
        None
    }
}

#[cfg(not(windows))]
fn disk_free_bytes(_path: &Path) -> Option<u64> {
    None
}

fn check(id: &str, label: &str, status: &str, detail: impl Into<String>, hint: impl Into<String>) -> Value {
    json!({
        "id": id,
        "label": label,
        "status": status,
        "detail": detail.into(),
        "hint": hint.into(),
    })
}

pub fn run_all(paths: &AppPaths, settings: &Settings, db: &Connection) -> Value {
    let mut checks: Vec<Value> = Vec::new();
    let home = if settings.active_profile_id.trim().is_empty() {
        paths.default_codex_home()
    } else {
        paths.profile_codex_home(&settings.active_profile_id)
    };

    let info = codex::info(&settings.codex_path, &home);
    if info.found {
        checks.push(check(
            "codex_installed",
            "Codex CLI",
            "ok",
            format!("{} ({})", if info.version.is_empty() { "version unknown" } else { &info.version }, info.path),
            "",
        ));
    } else {
        checks.push(check(
            "codex_installed",
            "Codex CLI",
            "error",
            "The official Codex CLI was not found",
            "Run: npm install -g @openai/codex, then use Rescan or set the codex.exe path in Settings.",
        ));
    }

    let has_auth = home.join("auth.json").is_file();
    checks.push(check(
        "auth_present",
        "Codex credentials",
        if has_auth { "ok" } else { "error" },
        if has_auth { "ARIA-owned CODEX_HOME contains credentials" } else { "No credentials in the ARIA CODEX_HOME" },
        if has_auth { "" } else { "Import auth.json in Authentication, or sign in with ChatGPT." },
    ));

    if info.found && has_auth {
        let status = codex::login_status(&home, &settings.codex_path);
        checks.push(check(
            "login_status",
            "Session status",
            if status.authenticated { "ok" } else { "warn" },
            status.detail.clone(),
            if status.authenticated { "" } else { "Run `codex login status` diagnostics, or sign in again." },
        ));
    }

    checks.push(check(
        "imagegen_skill",
        "Image generation skill",
        if info.skill_present { "ok" } else { "warn" },
        if info.skill_present { "An image_gen skill is installed in the ARIA CODEX_HOME" } else { "No image_gen skill found in the ARIA CODEX_HOME" },
        if info.skill_present { "" } else { "Use Install skill on the AI Engine page (the built-in image_gen tool itself is provided by Codex, not by the skill)." },
    ));

    let generated = home.join("generated_images");
    checks.push(check(
        "generated_dir",
        "Generated image directory",
        if generated.is_dir() { "ok" } else { "warn" },
        generated.to_string_lossy(),
        if generated.is_dir() { "" } else { "The folder appears after the first successful generation." },
    ));

    let out = if settings.output_root.trim().is_empty() {
        paths.projects.clone()
    } else {
        std::path::PathBuf::from(&settings.output_root)
    };
    checks.push(check(
        "output_dir",
        "Output directory",
        if out.is_dir() { "ok" } else { "warn" },
        out.to_string_lossy(),
        if out.is_dir() { "" } else { "Choose an existing output folder in Preferences." },
    ));

    match disk_free_bytes(&paths.root) {
        Some(free) => {
            let gb = free as f64 / 1024.0 / 1024.0 / 1024.0;
            checks.push(check(
                "disk_space",
                "Free disk space",
                if gb < 1.0 { "error" } else if gb < 5.0 { "warn" } else { "ok" },
                format!("{gb:.1} GB available"),
                if gb < 5.0 { "Free up space before large batches." } else { "" },
            ));
        }
        None => checks.push(check("disk_space", "Free disk space", "unknown", "Not reported on this platform", "")),
    }

    let db_ok = db::count(db, "SELECT COUNT(*) FROM sqlite_master", &[]).is_ok();
    checks.push(check(
        "database",
        "Database",
        if db_ok { "ok" } else { "error" },
        paths.db.to_string_lossy(),
        if db_ok { "" } else { "Delete the Database folder to rebuild; projects images stay on disk." },
    ));

    let pending = db::count(db, "SELECT COUNT(*) FROM jobs WHERE status IN ('queued','running')", &[]).unwrap_or(0);
    checks.push(check(
        "queue",
        "Queue",
        "ok",
        format!("{pending} job(s) pending or running"),
        "",
    ));

    let errors = checks.iter().filter(|c| c.get("status").and_then(|s| s.as_str()) == Some("error")).count();
    let warnings = checks.iter().filter(|c| c.get("status").and_then(|s| s.as_str()) == Some("warn")).count();
    let overall = if errors > 0 { "error" } else if warnings > 0 { "warn" } else { "ok" };

    json!({
        "overall": overall,
        "errors": errors,
        "warnings": warnings,
        "checks": checks,
        "generated_at": db::now(),
        "app_version": env!("CARGO_PKG_VERSION"),
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
    })
}

pub fn export_report(paths: &AppPaths, settings: &Settings, db: &Connection) -> crate::error::AppResult<Value> {
    let report = run_all(paths, settings, db);
    let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S").to_string();
    let dir = paths.exports.join(format!("diagnostics-{stamp}"));
    std::fs::create_dir_all(&dir)?;
    let json_path = dir.join("diagnostics.json");
    std::fs::write(&json_path, serde_json::to_string_pretty(&report)?)?;
    let mut markdown = String::new();
    markdown.push_str("# ARIA Image Studio — Diagnostics\n\n");
    markdown.push_str(&format!("Generated: {}\n\n", db::now()));
    markdown.push_str(&format!("Overall: **{}**\n\n", report.get("overall").and_then(|v| v.as_str()).unwrap_or("unknown")));
    if let Some(checks) = report.get("checks").and_then(|v| v.as_array()) {
        markdown.push_str("| Check | Status | Detail | Hint |\n|---|---|---|---|\n");
        for c in checks {
            markdown.push_str(&format!(
                "| {} | {} | {} | {} |\n",
                c.get("label").and_then(|v| v.as_str()).unwrap_or(""),
                c.get("status").and_then(|v| v.as_str()).unwrap_or(""),
                c.get("detail").and_then(|v| v.as_str()).unwrap_or("").replace('|', "/"),
                c.get("hint").and_then(|v| v.as_str()).unwrap_or("").replace('|', "/"),
            ));
        }
    }
    markdown.push_str("\nNo credentials, tokens or image pixels are included in this report.\n");
    let md_path = dir.join("diagnostics.md");
    std::fs::write(&md_path, markdown)?;
    db::execute(
        db,
        "INSERT INTO diagnostics (ts, check_name, status, detail) VALUES (?1,'support_bundle','ok',?2)",
        &[serde_json::Value::String(db::now()), serde_json::Value::String(dir.to_string_lossy().to_string())],
    )?;
    Ok(json!({ "dir": dir.to_string_lossy(), "json": json_path.to_string_lossy(), "markdown": md_path.to_string_lossy() }))
}
