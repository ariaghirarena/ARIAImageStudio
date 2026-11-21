//! Update checking without extra dependencies: Windows ships curl.exe, and
//! PowerShell is always available as a fallback. Signature-verified silent
//! updates require a signing key, so ARIA deliberately hands the download to
//! the user instead of installing something unverified.

use crate::error::{AppError, AppResult};
use crate::settings::Settings;
use serde_json::{json, Value};
use std::process::{Command, Stdio};

const RELEASES_API: &str = "https://api.github.com/repos/ariaghirarena/ARIAImageStudio/releases/latest";

fn http_get(url: &str) -> Option<String> {
    let attempts: Vec<Command> = if cfg!(windows) {
        vec![
            {
                let mut c = crate::sysproc::new("curl.exe");
                c.args(["-sL", "--max-time", "12", "-H", "User-Agent: ARIA-Image-Studio", url]);
                c
            },
            {
                let mut c = crate::sysproc::new("powershell");
                let script = format!(
                    "(Invoke-WebRequest -UseBasicParsing -Uri '{}' -Headers @{{'User-Agent'='ARIA-Image-Studio'}}).Content",
                    url
                );
                c.args(["-NoProfile", "-Command", script.as_str()]);
                c
            },
        ]
    } else {
        vec![{
            let mut c = crate::sysproc::new("curl");
            c.args(["-sL", "--max-time", "12", "-H", "User-Agent: ARIA-Image-Studio", url]);
            c
        }]
    };
    for mut cmd in attempts {
        cmd.stdin(Stdio::null()).stderr(Stdio::null());
        if let Ok(out) = cmd.output() {
            if out.status.success() {
                let body = String::from_utf8_lossy(&out.stdout).to_string();
                if body.trim_start().starts_with('{') {
                    return Some(body);
                }
            }
        }
    }
    None
}

fn parse_version(raw: &str) -> Vec<u32> {
    raw.trim()
        .trim_start_matches('v')
        .split(['.', '-', '+'])
        .take(3)
        .map(|part| part.parse::<u32>().unwrap_or(0))
        .collect()
}

pub fn is_newer(latest: &str, current: &str) -> bool {
    let a = parse_version(latest);
    let b = parse_version(current);
    for i in 0..3 {
        let x = a.get(i).copied().unwrap_or(0);
        let y = b.get(i).copied().unwrap_or(0);
        if x != y {
            return x > y;
        }
    }
    false
}

pub fn check(_settings: &Settings) -> AppResult<Value> {
    let current = env!("CARGO_PKG_VERSION").to_string();
    let Some(body) = http_get(RELEASES_API) else {
        return Ok(json!({
            "status": "unavailable",
            "current": current,
            "detail": "GitHub releases could not be reached (offline or blocked).",
            "release_url": "https://github.com/ariaghirarena/ARIAImageStudio/releases",
        }));
    };
    let Ok(json_body) = serde_json::from_str::<Value>(&body) else {
        return Err(AppError::new("update_parse_failed", "The release response was not valid JSON"));
    };
    let tag = json_body
        .get("tag_name")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();
    let html_url = json_body
        .get("html_url")
        .and_then(|v| v.as_str())
        .unwrap_or("https://github.com/ariaghirarena/ARIAImageStudio/releases")
        .to_string();
    let assets: Vec<Value> = json_body
        .get("assets")
        .and_then(|v| v.as_array())
        .map(|list| {
            list.iter()
                .filter_map(|a| {
                    Some(json!({
                        "name": a.get("name").and_then(|v| v.as_str())?,
                        "url": a.get("browser_download_url").and_then(|v| v.as_str())?,
                        "size": a.get("size").and_then(|v| v.as_u64()).unwrap_or(0),
                    }))
                })
                .collect()
        })
        .unwrap_or_default();
    let available = !tag.is_empty() && is_newer(&tag, &current);
    Ok(json!({
        "status": "ok",
        "current": current,
        "latest": tag,
        "available": available,
        "release_url": html_url,
        "assets": assets,
        "detail": if available { "A newer version is available." } else { "You are running the latest published version." },
        "auto_install": false,
        "auto_install_reason": "Silent updates need a signed update feed; ARIA opens the verified GitHub release instead.",
    }))
}
