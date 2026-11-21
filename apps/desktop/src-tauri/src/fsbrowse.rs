//! A dependency-free file browser used by the in-app pickers (auth.json import,
//! reference images, output folders). Only names and metadata are exposed.

use crate::error::{AppError, AppResult};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

fn entry_json(path: &Path) -> Option<Value> {
    let meta = std::fs::metadata(path).ok()?;
    let name = path.file_name()?.to_string_lossy().to_string();
    let is_dir = meta.is_dir();
    let modified = meta
        .modified()
        .ok()
        .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339())
        .unwrap_or_default();
    Some(json!({
        "name": name,
        "path": path.to_string_lossy(),
        "is_dir": is_dir,
        "size": if is_dir { 0 } else { meta.len() },
        "modified": modified,
        "is_image": !is_dir && crate::imageops::is_image_file(path),
        "is_json": !is_dir && path.extension().map(|e| e.eq_ignore_ascii_case("json")).unwrap_or(false),
    }))
}

pub fn roots() -> Value {
    let mut roots: Vec<Value> = Vec::new();
    if cfg!(windows) {
        for letter in 'A'..='Z' {
            let drive = format!("{}:\\", letter);
            if Path::new(&drive).is_dir() {
                roots.push(json!({ "name": drive, "path": drive }));
            }
        }
    } else {
        roots.push(json!({ "name": "/", "path": "/" }));
    }
    let mut shortcuts = Vec::new();
    if let Some(home) = dirs::home_dir() {
        for (label, path) in [
            ("خانه", Some(home.clone())),
            ("میز کار", Some(home.join("Desktop"))),
            ("دریافت‌ها", Some(home.join("Downloads"))),
            ("اسناد", Some(home.join("Documents"))),
        ] {
            if let Some(path) = path {
                if path.is_dir() {
                    shortcuts.push(json!({ "name": label, "path": path.to_string_lossy() }));
                }
            }
        }
    }
    if let Some(local) = dirs::data_local_dir() {
        shortcuts.push(json!({ "name": "داده‌های محلی برنامه‌ها", "path": local.to_string_lossy() }));
    }
    json!({ "roots": roots, "shortcuts": shortcuts })
}

pub fn list_dir(path: &str) -> AppResult<Value> {
    let dir: PathBuf = if path.trim().is_empty() {
        dirs::home_dir().ok_or_else(|| AppError::new("no_home", "Home directory unavailable"))?
    } else {
        PathBuf::from(path)
    };
    if !dir.is_dir() {
        return Err(AppError::new("not_a_directory", format!("{} is not a folder", dir.to_string_lossy())));
    }
    let mut dirs: Vec<Value> = Vec::new();
    let mut files: Vec<Value> = Vec::new();
    let read = std::fs::read_dir(&dir)?;
    for entry in read.flatten() {
        if let Some(json) = entry_json(&entry.path()) {
            let is_hidden = entry
                .file_name()
                .to_string_lossy()
                .starts_with('.');
            if is_hidden && !dir.starts_with(dirs::home_dir().unwrap_or_default().join(".codex")) {
                continue;
            }
            if json.get("is_dir").and_then(|v| v.as_bool()).unwrap_or(false) {
                dirs.push(json);
            } else {
                files.push(json);
            }
        }
    }
    dirs.sort_by(|a, b| {
        a.get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_lowercase()
            .cmp(&b.get("name").and_then(|v| v.as_str()).unwrap_or("").to_lowercase())
    });
    files.sort_by(|a, b| {
        a.get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_lowercase()
            .cmp(&b.get("name").and_then(|v| v.as_str()).unwrap_or("").to_lowercase())
    });
    let parent = dir.parent().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
    let total = dirs.len() + files.len();
    Ok(json!({
        "path": dir.to_string_lossy(),
        "parent": parent,
        "dirs": dirs,
        "files": files,
        "count": total,
    }))
}

pub fn ensure_directory(path: &str) -> AppResult<String> {
    let dir = PathBuf::from(path);
    std::fs::create_dir_all(&dir)?;
    Ok(dir.to_string_lossy().to_string())
}
