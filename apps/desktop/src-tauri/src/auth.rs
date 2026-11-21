//! Codex account management. Credentials live only in an ARIA-owned CODEX_HOME
//! (one per profile), are ACL-hardened, backed up with DPAPI, and are never
//! inserted into SQLite, logs or UI payloads.

use crate::codex;
use crate::db;
use crate::error::{AppError, AppResult};
use crate::paths::AppPaths;
use crate::security;
use rusqlite::Connection;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

pub fn import_auth_file(
    paths: &AppPaths,
    db: &Mutex<Connection>,
    profile_name: &str,
    source: &Path,
    profile_id: Option<String>,
) -> AppResult<Value> {
    if !source.is_file() {
        return Err(AppError::new("auth_file_missing", "The selected auth.json file does not exist"));
    }
    let meta = std::fs::metadata(source)?;
    if meta.len() > 2 * 1024 * 1024 {
        return Err(AppError::new("auth_file_too_large", "auth.json is unexpectedly large; refusing to import"));
    }
    let auth_mode = codex::validate_auth_json(source)?;

    let id = profile_id
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let codex_home = paths.profile_codex_home(&id);
    std::fs::create_dir_all(&codex_home)?;
    let target = codex_home.join("auth.json");

    let raw = std::fs::read(source)?;
    std::fs::write(&target, &raw)?;
    security::harden_file(&target)?;

    // DPAPI-protected backup so a replaced or damaged credential can be restored.
    let vault = codex_home.join("auth.vault");
    if let Ok(encrypted) = security::protect_secret(&raw) {
        if std::fs::write(&vault, encrypted).is_ok() {
            let _ = security::harden_file(&vault);
        }
    }

    let name = if profile_name.trim().is_empty() {
        format!("Codex profile {}", &id[..8.min(id.len())])
    } else {
        profile_name.trim().to_string()
    };

    let now = db::now();
    {
        let conn = db.lock().map_err(|_| AppError::new("db_locked", "database busy"))?;
        db::execute(
            &conn,
            "INSERT INTO profiles (id, name, auth_mode, status, created_at, updated_at, last_checked, last_error)
             VALUES (?1, ?2, ?3, 'imported', ?4, ?5, '', '')
             ON CONFLICT(id) DO UPDATE SET name=?2, auth_mode=?3, status='imported', updated_at=?5, last_error=''",
            &[
                Value::String(id.clone()),
                Value::String(name.clone()),
                Value::String(auth_mode.clone()),
                Value::String(now.clone()),
                Value::String(now),
            ],
        )?;
    }

    Ok(json!({
        "profile_id": id,
        "name": name,
        "auth_mode": auth_mode,
        "codex_home": codex_home.to_string_lossy(),
        "token_values_exposed": false
    }))
}

pub fn profile_codex_home(paths: &AppPaths, db: &Mutex<Connection>, profile_id: &str) -> AppResult<PathBuf> {
    if profile_id.trim().is_empty() {
        return Ok(paths.default_codex_home());
    }
    let exists = {
        let conn = db.lock().map_err(|_| AppError::new("db_locked", "database busy"))?;
        db::query_one(
            &conn,
            "SELECT id FROM profiles WHERE id = ?1",
            &[Value::String(profile_id.to_string())],
            &["id"],
        )?
        .is_some()
    };
    if !exists {
        return Err(AppError::new("profile_not_found", "Unknown Codex profile"));
    }
    Ok(paths.profile_codex_home(profile_id))
}

pub fn refresh_status(paths: &AppPaths, db: &Mutex<Connection>, profile_id: &str, codex_path: &str) -> AppResult<Value> {
    let home = profile_codex_home(paths, db, profile_id)?;
    let status = codex::login_status(&home, codex_path);
    let now = db::now();
    {
        let conn = db.lock().map_err(|_| AppError::new("db_locked", "database busy"))?;
        let state = if status.authenticated {
            "authenticated"
        } else if home.join("auth.json").is_file() {
            "credentials_present"
        } else {
            "unauthenticated"
        };
        db::execute(
            &conn,
            "UPDATE profiles SET status=?1, last_checked=?2, last_error=?3, auth_mode=?4 WHERE id=?5",
            &[
                Value::String(state.into()),
                Value::String(now.clone()),
                Value::String(if status.authenticated { String::new() } else { status.detail.clone() }),
                Value::String(status.mode.clone()),
                Value::String(profile_id.to_string()),
            ],
        )?;
    }
    Ok(json!({
        "authenticated": status.authenticated,
        "auth_mode": status.mode,
        "detail": status.detail,
        "checked_at": status.checked_at,
        "has_credentials": home.join("auth.json").is_file(),
    }))
}

pub fn remove_profile(paths: &AppPaths, db: &Mutex<Connection>, profile_id: &str, purge: bool) -> AppResult<()> {
    let home = paths.profile_codex_home(profile_id);
    codex::logout(&home)?;
    if purge {
        let auth = home.join("auth.json");
        security::secure_delete(&auth)?;
        let vault = home.join("auth.vault");
        security::secure_delete(&vault)?;
        let _ = std::fs::remove_dir_all(home.parent().unwrap_or(&home));
    }
    {
        let conn = db.lock().map_err(|_| AppError::new("db_locked", "database busy"))?;
        db::execute(
            &conn,
            "DELETE FROM profiles WHERE id = ?1",
            &[Value::String(profile_id.to_string())],
        )?;
    }
    Ok(())
}

pub fn has_credentials(paths: &AppPaths, profile_id: &str) -> bool {
    let home = if profile_id.trim().is_empty() {
        paths.default_codex_home()
    } else {
        paths.profile_codex_home(profile_id)
    };
    home.join("auth.json").is_file()
}
