//! ARIA Image Studio — Tauri backend entry point and command surface.

mod analytics;
mod auth;
mod codex;
mod db;
mod diagnostics;
mod engine;
mod error;
mod fsbrowse;
mod imageops;
mod library;
mod paths;
mod queue;
mod registry;
mod security;
mod settings;
mod updates;

use error::{AppError, AppResult};
use paths::AppPaths;
use rusqlite::Connection;
use serde_json::{json, Value};
use settings::Settings;
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

pub struct AppState {
    pub paths: AppPaths,
    pub db: Arc<Mutex<Connection>>,
    pub settings: Mutex<Settings>,
    pub queue: Arc<queue::QueueRuntime>,
}

impl AppState {
    fn conn(&self) -> AppResult<std::sync::MutexGuard<'_, Connection>> {
        self.db
            .lock()
            .map_err(|_| AppError::new("db_locked", "The database is busy; try again"))
    }

    fn settings(&self) -> Settings {
        self.settings
            .lock()
            .map(|s| s.clone())
            .unwrap_or_default()
    }

    fn ctx(&self, app: &AppHandle) -> engine::EngineCtx {
        engine::EngineCtx {
            app: app.clone(),
            paths: self.paths.clone(),
            settings: self.settings(),
            db: self.db.clone(),
        }
    }
}

fn open_external(target: &str, is_url: bool) -> AppResult<()> {
    #[cfg(windows)]
    {
        let mut cmd = std::process::Command::new("cmd");
        cmd.args(["/C", "start", ""]).arg(target);
        let _ = is_url;
        cmd.spawn()
            .map_err(|e| AppError::new("open_failed", format!("Could not open: {e}")))?;
    }
    #[cfg(not(windows))]
    {
        let _ = is_url;
        std::process::Command::new("xdg-open")
            .arg(target)
            .spawn()
            .map_err(|e| AppError::new("open_failed", format!("Could not open: {e}")))?;
    }
    Ok(())
}

// ---------------------------------------------------------------- app / system

#[tauri::command]
fn app_bootstrap(app: AppHandle, state: State<'_, AppState>) -> AppResult<Value> {
    let settings = state.settings();
    let home = if settings.active_profile_id.trim().is_empty() {
        state.paths.default_codex_home()
    } else {
        state.paths.profile_codex_home(&settings.active_profile_id)
    };
    let info = codex::info(&settings.codex_path, &home);
    let conn = state.conn()?;
    let profiles = db::query_json(
        &conn,
        "SELECT id, name, auth_mode, status, created_at, updated_at, last_checked FROM profiles ORDER BY created_at DESC",
        &[],
        &["id", "name", "auth_mode", "status", "created_at", "updated_at", "last_checked"],
    )?;
    let counts = json!({
        "projects": db::count(&conn, "SELECT COUNT(*) FROM projects", &[])?,
        "images": db::count(&conn, "SELECT COUNT(*) FROM images", &[])?,
        "prompts": db::count(&conn, "SELECT COUNT(*) FROM prompts", &[])?,
        "pending_jobs": db::count(&conn, "SELECT COUNT(*) FROM jobs WHERE status IN ('queued','running')", &[])?,
        "features": db::count(&conn, "SELECT COUNT(*) FROM feature_registry", &[])?,
    });
    let _ = app;
    Ok(json!({
        "version": env!("CARGO_PKG_VERSION"),
        "paths": {
            "root": state.paths.root.to_string_lossy(),
            "codex_home": home.to_string_lossy(),
            "projects": state.paths.projects.to_string_lossy(),
            "gallery": state.paths.gallery.to_string_lossy(),
            "exports": state.paths.exports.to_string_lossy(),
            "backups": state.paths.backups.to_string_lossy(),
        },
        "settings": settings,
        "codex": info,
        "counts": counts,
        "profiles": profiles,
        "platform": std::env::consts::OS,
    }))
}

#[tauri::command]
fn settings_get(state: State<'_, AppState>) -> AppResult<Value> {
    Ok(serde_json::to_value(state.settings())?)
}

#[tauri::command]
fn settings_save(state: State<'_, AppState>, settings: Value) -> AppResult<Value> {
    let mut parsed: Settings = serde_json::from_value(settings)?;
    if parsed.max_concurrent_jobs == 0 || parsed.max_concurrent_jobs > 4 {
        parsed.max_concurrent_jobs = 1;
    }
    parsed.generation_timeout_secs = parsed.generation_timeout_secs.clamp(60, 3600);
    parsed.thumbnail_size = parsed.thumbnail_size.clamp(120, 1024);
    parsed.save(&state.paths)?;
    if let Ok(mut guard) = state.settings.lock() {
        *guard = parsed.clone();
    }
    Ok(serde_json::to_value(parsed)?)
}

#[tauri::command]
fn open_path(path: String) -> AppResult<()> {
    open_external(&path, false)
}

#[tauri::command]
fn open_url(url: String) -> AppResult<()> {
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err(AppError::new("invalid_argument", "Only http(s) links can be opened"));
    }
    open_external(&url, true)
}

#[tauri::command]
fn picker_roots() -> Value {
    fsbrowse::roots()
}

#[tauri::command]
fn picker_list(path: String) -> AppResult<Value> {
    fsbrowse::list_dir(&path)
}

#[tauri::command]
fn picker_ensure_dir(path: String) -> AppResult<String> {
    fsbrowse::ensure_directory(&path)
}

// ---------------------------------------------------------------------- auth

#[tauri::command]
fn auth_profiles(state: State<'_, AppState>) -> AppResult<Vec<Value>> {
    let conn = state.conn()?;
    db::query_json(
        &conn,
        "SELECT id, name, auth_mode, status, created_at, updated_at, last_checked, last_error FROM profiles ORDER BY created_at DESC",
        &[],
        &["id", "name", "auth_mode", "status", "created_at", "updated_at", "last_checked", "last_error"],
    )
}

#[tauri::command]
fn auth_import(state: State<'_, AppState>, source_path: String, name: String) -> AppResult<Value> {
    let result = auth::import_auth_file(&state.paths, &state.db, &name, std::path::Path::new(&source_path), None)?;
    let profile_id = db::text(result.get("profile_id"));
    if state.settings().active_profile_id.trim().is_empty() {
        if let Ok(mut guard) = state.settings.lock() {
            guard.active_profile_id = profile_id.clone();
            let _ = guard.save(&state.paths);
        }
    }
    Ok(result)
}

#[tauri::command]
fn auth_replace(state: State<'_, AppState>, profile_id: String, source_path: String) -> AppResult<Value> {
    let name = {
        let conn = state.conn()?;
        db::query_one(&conn, "SELECT name FROM profiles WHERE id=?1", &[Value::String(profile_id.clone())], &["name"])?
            .map(|v| db::text(v.get("name")))
            .unwrap_or_default()
    };
    auth::import_auth_file(
        &state.paths,
        &state.db,
        &name,
        std::path::Path::new(&source_path),
        Some(profile_id),
    )
}

#[tauri::command]
fn auth_status(state: State<'_, AppState>, profile_id: String) -> AppResult<Value> {
    let settings = state.settings();
    auth::refresh_status(&state.paths, &state.db, &profile_id, &settings.codex_path)
}

#[tauri::command]
fn auth_restore_vault(state: State<'_, AppState>, profile_id: String) -> AppResult<Value> {
    let home = state.paths.profile_codex_home(&profile_id);
    let vault = home.join("auth.vault");
    if !vault.is_file() {
        return Err(AppError::new("vault_missing", "No encrypted credential backup exists for this profile"));
    }
    let encrypted = std::fs::read(&vault)?;
    let plain = security::unprotect_secret(&encrypted)
        .map_err(|e| AppError::new("vault_error", format!("Could not decrypt the backup: {e}")))?;
    let target = home.join("auth.json");
    std::fs::write(&target, plain)?;
    security::harden_file(&target)?;
    Ok(json!({ "restored": true, "path": target.to_string_lossy() }))
}

#[tauri::command]
fn auth_delete(state: State<'_, AppState>, profile_id: String, purge: bool) -> AppResult<()> {
    auth::remove_profile(&state.paths, &state.db, &profile_id, purge)?;
    if let Ok(mut guard) = state.settings.lock() {
        if guard.active_profile_id == profile_id {
            guard.active_profile_id.clear();
            let _ = guard.save(&state.paths);
        }
    }
    Ok(())
}

#[tauri::command]
fn auth_set_active(state: State<'_, AppState>, profile_id: String) -> AppResult<()> {
    if let Ok(mut guard) = state.settings.lock() {
        guard.active_profile_id = profile_id;
        guard.save(&state.paths)?;
    }
    Ok(())
}

#[tauri::command]
fn auth_login_start(app: AppHandle, state: State<'_, AppState>, profile_id: String, device: bool) -> AppResult<Value> {
    let home = auth::profile_codex_home(&state.paths, &state.db, &profile_id)?;
    std::fs::create_dir_all(&home)?;
    let mut child = codex::spawn_login(&home, device)?;
    let app_handle = app.clone();
    let db = state.db.clone();
    let paths = state.paths.clone();
    let codex_path = state.settings().codex_path.clone();
    let pid = profile_id.clone();
    std::thread::spawn(move || {
        use std::io::BufRead;
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        let emit = |line: &str| {
            let text = security::redact(line);
            let _ = app_handle.emit("aria://login-line", json!({ "text": text }));
        };
        emit(if device {
            "Starting device authentication with Codex…"
        } else {
            "Opening the official Codex browser login…"
        });
        if let Some(stdout) = stdout {
            for line in std::io::BufReader::new(stdout).lines().map_while(Result::ok) {
                emit(&line);
            }
        }
        if let Some(stderr) = stderr {
            for line in std::io::BufReader::new(stderr).lines().map_while(Result::ok) {
                emit(&line);
            }
        }
        let status = child.wait().ok();
        let result = auth::refresh_status(&paths, &db, &pid, &codex_path).unwrap_or_else(|e| json!({ "error": e.message }));
        let _ = app_handle.emit(
            "aria://login-finished",
            json!({ "exit_code": status.and_then(|s| s.code()), "status": result }),
        );
    });
    Ok(json!({ "started": true, "codex_home": home.to_string_lossy(), "device": device }))
}

#[tauri::command]
fn auth_logout(state: State<'_, AppState>, profile_id: String) -> AppResult<Value> {
    let home = auth::profile_codex_home(&state.paths, &state.db, &profile_id)?;
    codex::logout(&home)?;
    security::secure_delete(&home.join("auth.json"))?;
    {
        let conn = state.conn()?;
        db::execute(
            &conn,
            "UPDATE profiles SET status='unauthenticated', last_checked=?1 WHERE id=?2",
            &[Value::String(db::now()), Value::String(profile_id)],
        )?;
    }
    Ok(json!({ "logged_out": true }))
}

// --------------------------------------------------------------------- codex

#[tauri::command]
fn codex_info(state: State<'_, AppState>) -> AppResult<Value> {
    let settings = state.settings();
    let home = if settings.active_profile_id.trim().is_empty() {
        state.paths.default_codex_home()
    } else {
        state.paths.profile_codex_home(&settings.active_profile_id)
    };
    Ok(serde_json::to_value(codex::info(&settings.codex_path, &home))?)
}

#[tauri::command]
fn codex_install_skill(state: State<'_, AppState>) -> AppResult<Value> {
    let settings = state.settings();
    let home = if settings.active_profile_id.trim().is_empty() {
        state.paths.default_codex_home()
    } else {
        state.paths.profile_codex_home(&settings.active_profile_id)
    };
    let path = codex::install_skill(&home)?;
    Ok(json!({ "path": path }))
}

#[tauri::command]
fn codex_models(state: State<'_, AppState>) -> AppResult<Value> {
    let settings = state.settings();
    let home = if settings.active_profile_id.trim().is_empty() {
        state.paths.default_codex_home()
    } else {
        state.paths.profile_codex_home(&settings.active_profile_id)
    };
    let models = codex::models_from_cache(&home);
    Ok(json!({
        "models": models,
        "source": if models.is_empty() { "unavailable" } else { "codex models cache" },
        "detail": if models.is_empty() {
            "This Codex installation has not published a model catalog to the ARIA CODEX_HOME. Leave the model empty to use the account default."
        } else {
            "Models reported by the installed Codex CLI."
        },
    }))
}

#[tauri::command]
fn codex_config_read(state: State<'_, AppState>) -> AppResult<Value> {
    let settings = state.settings();
    let home = if settings.active_profile_id.trim().is_empty() {
        state.paths.default_codex_home()
    } else {
        state.paths.profile_codex_home(&settings.active_profile_id)
    };
    let path = home.join("config.toml");
    let content = std::fs::read_to_string(&path).unwrap_or_default();
    let sanitized = security::redact(&content);
    Ok(json!({ "path": path.to_string_lossy(), "content": sanitized, "exists": path.is_file() }))
}

#[tauri::command]
fn codex_config_write(state: State<'_, AppState>, content: String) -> AppResult<Value> {
    let settings = state.settings();
    let home = if settings.active_profile_id.trim().is_empty() {
        state.paths.default_codex_home()
    } else {
        state.paths.profile_codex_home(&settings.active_profile_id)
    };
    std::fs::create_dir_all(&home)?;
    let path = home.join("config.toml");
    if path.is_file() {
        let backup = home.join("config.toml.bak");
        let _ = std::fs::copy(&path, backup);
    }
    std::fs::write(&path, content)?;
    Ok(json!({ "path": path.to_string_lossy(), "written": true }))
}

#[tauri::command]
async fn codex_complete(app: AppHandle, prompt: String) -> AppResult<Value> {
    let (ctx, home) = {
        let state = app.state::<AppState>();
        let settings = state.settings();
        let home = if settings.active_profile_id.trim().is_empty() {
            state.paths.default_codex_home()
        } else {
            state.paths.profile_codex_home(&settings.active_profile_id)
        };
        (state.ctx(&app), home)
    };
    let text = tauri::async_runtime::spawn_blocking(move || {
        engine::run_text(
            &ctx.settings,
            &home,
            &ctx.paths.exports,
            &prompt,
            std::time::Duration::from_secs(240),
        )
    })
    .await
    .map_err(|e| AppError::new("join_error", e.to_string()))??;
    Ok(json!({ "text": text }))
}

#[tauri::command]
fn codex_health(state: State<'_, AppState>) -> AppResult<Value> {
    let settings = state.settings();
    let home = if settings.active_profile_id.trim().is_empty() {
        state.paths.default_codex_home()
    } else {
        state.paths.profile_codex_home(&settings.active_profile_id)
    };
    let info = codex::info(&settings.codex_path, &home);
    let status = if info.auth_present {
        Some(codex::login_status(&home, &settings.codex_path))
    } else {
        None
    };
    let conn = state.conn()?;
    let failures = db::count(
        &conn,
        "SELECT COUNT(*) FROM generations WHERE status='failed' AND started_at > datetime('now','-1 day')",
        &[],
    )?;
    Ok(json!({
        "codex": info,
        "login": status,
        "recent_failures": failures,
        "healthy": info.found && info.auth_present,
    }))
}

// ---------------------------------------------------------------- generation

fn insert_generation(ctx: &engine::EngineCtx, req: &engine::GenerationRequest, status: &str) -> AppResult<()> {
    let conn = ctx.db.lock().map_err(|_| AppError::new("db_locked", "database busy"))?;
    db::execute(
        &conn,
        "INSERT OR REPLACE INTO generations (id, job_id, project_id, prompt_original, prompt_final, status, engine, model_note, started_at, finished_at, duration_ms, error, result_count)
         VALUES (?1,?2,?3,?4,?5,?6,'codex-image_gen',?7,?8,'',0,'',0)",
        &[
            Value::String(req.generation_id.clone()),
            Value::String(req.job_id.clone()),
            Value::String(req.project_id.clone()),
            Value::String(req.prompt_original.clone()),
            Value::String(req.prompt_final.clone()),
            Value::String(status.into()),
            Value::String(req.model.clone()),
            Value::String(db::now()),
        ],
    )?;
    Ok(())
}

#[tauri::command]
async fn generate_now(app: AppHandle, request: Value) -> AppResult<Value> {
    let (ctx, runtime, mut req) = {
        let state = app.state::<AppState>();
        let req: engine::GenerationRequest = serde_json::from_value(request)?;
        (state.ctx(&app), state.queue.clone(), req)
    };
    if req.generation_id.trim().is_empty() {
        req.generation_id = uuid::Uuid::new_v4().to_string();
    }
    if req.job_id.trim().is_empty() {
        req.job_id = format!("direct-{}", req.generation_id);
    }
    insert_generation(&ctx, &req, "running")?;
    let cancel = runtime.cancel_flag(&req.job_id);
    let ctx_clone = ctx.clone();
    let req_clone = req.clone();
    let outcome = tauri::async_runtime::spawn_blocking(move || engine::execute(&ctx_clone, &req_clone, cancel))
        .await
        .map_err(|e| AppError::new("join_error", e.to_string()))?;
    if let Ok(conn) = ctx.db.lock() {
        match &outcome {
            Ok(result) => {
                let _ = db::execute(
                    &conn,
                    "INSERT INTO analytics_events (ts, kind, payload_json) VALUES (?1, 'direct_generation', ?2)",
                    &[
                        Value::String(db::now()),
                        Value::String(json!({ "status": result.status, "images": result.images.len() }).to_string()),
                    ],
                );
            }
            Err(err) => {
                let _ = db::execute(
                    &conn,
                    "UPDATE generations SET status='failed', error=?1, finished_at=?2 WHERE id=?3",
                    &[Value::String(err.message.clone()), Value::String(db::now()), Value::String(req.generation_id)],
                );
            }
        }
    }
    Ok(serde_json::to_value(outcome?)?)
}

#[tauri::command]
fn generate_queue(app: AppHandle, state: State<'_, AppState>, request: Value) -> AppResult<Value> {
    let mut req: engine::GenerationRequest = serde_json::from_value(request)?;
    if req.generation_id.trim().is_empty() {
        req.generation_id = uuid::Uuid::new_v4().to_string();
    }
    let job_id = uuid::Uuid::new_v4().to_string();
    req.job_id = job_id.clone();
    if req.count == 0 {
        req.count = 1;
    }
    {
        let conn = state.conn()?;
        db::execute(
            &conn,
            "INSERT INTO jobs (id, project_id, kind, status, priority, prompt, params_json, result_json, error, attempts, max_attempts, created_at)
             VALUES (?1,?2,'generation','queued',50,?3,?4,'{}','',0,3,?5)",
            &[
                Value::String(job_id.clone()),
                Value::String(req.project_id.clone()),
                Value::String(req.prompt_final.chars().take(400).collect()),
                Value::String(serde_json::to_string(&req)?),
                Value::String(db::now()),
            ],
        )?;
    }
    let _ = app.emit("aria://queue-changed", json!({ "reason": "enqueued", "job_id": job_id }));
    Ok(json!({ "job_id": job_id, "generation_id": req.generation_id }))
}

#[tauri::command]
fn jobs_list(state: State<'_, AppState>, status: String, limit: i64) -> AppResult<Vec<Value>> {
    let conn = state.conn()?;
    let mut params: Vec<Value> = Vec::new();
    let mut sql = String::from(
        "SELECT id, project_id, kind, status, priority, prompt, error, attempts, max_attempts, created_at, started_at, finished_at, result_json FROM jobs",
    );
    if !status.trim().is_empty() && status != "all" {
        sql.push_str(" WHERE status = ?");
        params.push(Value::String(status));
    }
    sql.push_str(" ORDER BY CASE status WHEN 'running' THEN 0 WHEN 'queued' THEN 1 ELSE 2 END, priority DESC, created_at DESC LIMIT ?");
    params.push(json!(limit.clamp(1, 500)));
    db::query_json(
        &conn,
        &sql,
        &params,
        &["id", "project_id", "kind", "status", "priority", "prompt", "error", "attempts", "max_attempts", "created_at", "started_at", "finished_at", "result_json"],
    )
}

#[tauri::command]
fn job_events(state: State<'_, AppState>, job_id: String) -> AppResult<Vec<Value>> {
    let conn = state.conn()?;
    db::query_json(
        &conn,
        "SELECT id, job_id, ts, level, message FROM job_events WHERE job_id=?1 ORDER BY id DESC LIMIT 400",
        &[Value::String(job_id)],
        &["id", "job_id", "ts", "level", "message"],
    )
}

#[tauri::command]
fn job_cancel(app: AppHandle, state: State<'_, AppState>, job_id: String) -> AppResult<()> {
    let flag = state.queue.cancel_flag(&job_id);
    flag.store(true, Ordering::Relaxed);
    {
        let conn = state.conn()?;
        db::execute(
            &conn,
            "UPDATE jobs SET status='cancelled', finished_at=?1 WHERE id=?2 AND status IN ('queued','running')",
            &[Value::String(db::now()), Value::String(job_id.clone())],
        )?;
    }
    let _ = app.emit("aria://queue-changed", json!({ "reason": "cancelled", "job_id": job_id }));
    Ok(())
}

#[tauri::command]
fn job_retry(app: AppHandle, state: State<'_, AppState>, job_id: String) -> AppResult<()> {
    {
        let conn = state.conn()?;
        db::execute(
            &conn,
            "UPDATE jobs SET status='queued', error='', finished_at=NULL WHERE id=?1",
            &[Value::String(job_id.clone())],
        )?;
    }
    if let Ok(mut map) = state.queue.cancels.lock() {
        if let Some(flag) = map.get(&job_id) {
            flag.store(false, Ordering::Relaxed);
        }
    }
    let _ = app.emit("aria://queue-changed", json!({ "reason": "retried", "job_id": job_id }));
    Ok(())
}

#[tauri::command]
fn queue_pause(state: State<'_, AppState>, paused: bool) -> AppResult<Value> {
    state.queue.paused.store(paused, Ordering::Relaxed);
    Ok(json!({ "paused": paused }))
}

#[tauri::command]
fn queue_state(state: State<'_, AppState>) -> AppResult<Value> {
    let conn = state.conn()?;
    let queued = db::count(&conn, "SELECT COUNT(*) FROM jobs WHERE status='queued'", &[])?;
    let running = db::count(&conn, "SELECT COUNT(*) FROM jobs WHERE status='running'", &[])?;
    let failed = db::count(&conn, "SELECT COUNT(*) FROM jobs WHERE status='failed'", &[])?;
    Ok(json!({
        "paused": state.queue.paused.load(Ordering::Relaxed),
        "queued": queued,
        "running": running,
        "failed": failed,
    }))
}

#[tauri::command]
fn generations_list(state: State<'_, AppState>, limit: i64) -> AppResult<Vec<Value>> {
    let conn = state.conn()?;
    db::query_json(
        &conn,
        "SELECT id, job_id, project_id, prompt_original, prompt_final, status, engine, model_note, started_at, finished_at, duration_ms, error, result_count FROM generations ORDER BY started_at DESC LIMIT ?1",
        &[json!(limit.clamp(1, 500))],
        &["id", "job_id", "project_id", "prompt_original", "prompt_final", "status", "engine", "model_note", "started_at", "finished_at", "duration_ms", "error", "result_count"],
    )
}

// -------------------------------------------------------------------- images

#[tauri::command]
fn gallery_list(state: State<'_, AppState>, query: Value) -> AppResult<Value> {
    let parsed: library::GalleryQuery = serde_json::from_value(query).unwrap_or_default();
    let conn = state.conn()?;
    library::gallery_list(&conn, &parsed)
}

#[tauri::command]
fn image_detail(state: State<'_, AppState>, id: String) -> AppResult<Value> {
    let conn = state.conn()?;
    db::query_one(
        &conn,
        "SELECT * FROM images WHERE id=?1",
        &[Value::String(id)],
        &["id", "generation_id", "project_id", "path", "thumb_path", "file_name", "format", "width", "height", "size_bytes", "sha256", "created_at", "favorite", "tags_json", "note", "prompt", "optimized_prompt", "engine", "model_note", "references_json", "edit_history_json", "parent_image_id"],
    )?
    .ok_or_else(|| AppError::new("image_not_found", "Image not found"))
}

#[tauri::command]
fn image_favorite(state: State<'_, AppState>, id: String, favorite: bool) -> AppResult<()> {
    let conn = state.conn()?;
    library::set_favorite(&conn, &id, favorite)
}

#[tauri::command]
fn image_tags(state: State<'_, AppState>, id: String, tags: Vec<String>) -> AppResult<()> {
    let conn = state.conn()?;
    library::set_tags(&conn, &id, tags)
}

#[tauri::command]
fn image_note(state: State<'_, AppState>, id: String, note: String) -> AppResult<()> {
    let conn = state.conn()?;
    library::set_note(&conn, &id, &note)
}

#[tauri::command]
fn image_delete(state: State<'_, AppState>, id: String, delete_file: bool) -> AppResult<()> {
    let conn = state.conn()?;
    library::delete_image(&conn, &id, delete_file)
}

#[tauri::command]
fn images_duplicates(state: State<'_, AppState>) -> AppResult<Value> {
    let conn = state.conn()?;
    library::find_duplicates(&conn)
}

#[tauri::command]
fn image_compare(a: String, b: String) -> AppResult<Value> {
    let result = imageops::compare(std::path::Path::new(&a), std::path::Path::new(&b))?;
    Ok(serde_json::to_value(result)?)
}

#[tauri::command]
fn image_probe(path: String) -> AppResult<Value> {
    let info = imageops::inspect(std::path::Path::new(&path))?;
    Ok(serde_json::to_value(info)?)
}

#[tauri::command]
fn post_process(state: State<'_, AppState>, image_id: String, ops: Value, label: String) -> AppResult<Value> {
    let parsed: imageops::TransformOps = serde_json::from_value(ops)?;
    let conn = state.conn()?;
    library::apply_post_process(&conn, &state.paths, &image_id, &parsed, &label)
}

#[tauri::command]
fn bulk_rename(state: State<'_, AppState>, ids: Vec<String>, pattern: String) -> AppResult<Value> {
    let conn = state.conn()?;
    library::bulk_rename(&conn, &ids, &pattern)
}

// ------------------------------------------------------------------ projects

#[tauri::command]
fn project_create(state: State<'_, AppState>, name: String, description: String) -> AppResult<Value> {
    let conn = state.conn()?;
    let created = library::create_project(&conn, &state.paths, &name, &description)?;
    if let (Ok(mut guard), Some(id)) = (state.settings.lock(), created.get("id")) {
        if guard.active_project_id.trim().is_empty() {
            guard.active_project_id = db::text(Some(id));
            let _ = guard.save(&state.paths);
        }
    }
    Ok(created)
}

#[tauri::command]
fn project_list(state: State<'_, AppState>) -> AppResult<Vec<Value>> {
    let conn = state.conn()?;
    library::list_projects(&conn)
}

#[tauri::command]
fn project_update(state: State<'_, AppState>, id: String, name: String, description: String, output_dir: String) -> AppResult<()> {
    let conn = state.conn()?;
    library::update_project(&conn, &state.paths, &id, &name, &description, &output_dir)
}

#[tauri::command]
fn project_archive(state: State<'_, AppState>, id: String, archived: bool) -> AppResult<()> {
    let conn = state.conn()?;
    library::archive_project(&conn, &id, archived)
}

#[tauri::command]
fn project_backup(state: State<'_, AppState>, id: String) -> AppResult<Value> {
    let conn = state.conn()?;
    library::backup_project(&conn, &state.paths, &id)
}

#[tauri::command]
fn project_restore(state: State<'_, AppState>, backup_dir: String) -> AppResult<Value> {
    library::restore_project(&state.paths, &backup_dir)
}

// ------------------------------------------------------------------- prompts

#[tauri::command]
fn prompt_save(state: State<'_, AppState>, prompt: Value) -> AppResult<Value> {
    let conn = state.conn()?;
    library::save_prompt(&conn, &prompt)
}

#[tauri::command]
fn prompt_list(state: State<'_, AppState>, search: String) -> AppResult<Vec<Value>> {
    let conn = state.conn()?;
    library::list_prompts(&conn, &search)
}

#[tauri::command]
fn prompt_delete(state: State<'_, AppState>, id: String) -> AppResult<()> {
    let conn = state.conn()?;
    db::execute(&conn, "DELETE FROM prompts WHERE id=?1", &[Value::String(id.clone())])?;
    db::execute(&conn, "DELETE FROM prompt_versions WHERE prompt_id=?1", &[Value::String(id)])?;
    Ok(())
}

#[tauri::command]
fn prompt_versions(state: State<'_, AppState>, prompt_id: String) -> AppResult<Vec<Value>> {
    let conn = state.conn()?;
    library::prompt_versions(&conn, &prompt_id)
}

#[tauri::command]
fn prompts_export(state: State<'_, AppState>, path: String) -> AppResult<Value> {
    let conn = state.conn()?;
    let prompts = db::query_json(
        &conn,
        "SELECT id, title, body, negative, category, tags_json, favorite, created_at, updated_at, version FROM prompts",
        &[],
        &["id", "title", "body", "negative", "category", "tags_json", "favorite", "created_at", "updated_at", "version"],
    )?;
    let target = std::path::PathBuf::from(&path);
    if let Some(parent) = target.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)?;
        }
    }
    std::fs::write(&target, serde_json::to_string_pretty(&prompts)?)?;
    Ok(json!({ "path": target.to_string_lossy(), "count": prompts.len() }))
}

#[tauri::command]
fn prompts_import(state: State<'_, AppState>, path: String) -> AppResult<Value> {
    let raw = std::fs::read_to_string(&path)?;
    let items: Vec<Value> = serde_json::from_str(&raw)
        .map_err(|_| AppError::new("invalid_import", "The prompt file must contain a JSON array"))?;
    let conn = state.conn()?;
    let mut imported = 0;
    for mut item in items {
        if let Some(obj) = item.as_object_mut() {
            obj.remove("id");
            obj.remove("created_at");
            obj.remove("updated_at");
        }
        if library::save_prompt(&conn, &item).is_ok() {
            imported += 1;
        }
    }
    Ok(json!({ "imported": imported }))
}

// ---------------------------------------------------------------- references

#[tauri::command]
fn reference_add(state: State<'_, AppState>, path: String, project_id: String, role: String) -> AppResult<Value> {
    let conn = state.conn()?;
    library::add_reference(&conn, &state.paths, &project_id, &path, &role)
}

#[tauri::command]
fn reference_list(state: State<'_, AppState>, project_id: String) -> AppResult<Vec<Value>> {
    let conn = state.conn()?;
    library::list_references(&conn, &project_id)
}

#[tauri::command]
fn reference_delete(state: State<'_, AppState>, id: String) -> AppResult<()> {
    let conn = state.conn()?;
    if let Some(row) = db::query_one(&conn, "SELECT path, thumb_path FROM reference_assets WHERE id=?1", &[Value::String(id.clone())], &["path", "thumb_path"])? {
        let path = db::text(row.get("path"));
        if !path.is_empty() {
            let _ = std::fs::remove_file(path);
        }
        let thumb = db::text(row.get("thumb_path"));
        if !thumb.is_empty() {
            let _ = std::fs::remove_file(thumb);
        }
    }
    db::execute(&conn, "DELETE FROM reference_assets WHERE id=?1", &[Value::String(id)])?;
    Ok(())
}

// ----------------------------------------------------------------- workflows

fn parse_steps(steps: &Value) -> Vec<Value> {
    steps.as_array().cloned().unwrap_or_default()
}

#[tauri::command]
fn workflow_list(state: State<'_, AppState>) -> AppResult<Vec<Value>> {
    let conn = state.conn()?;
    db::query_json(
        &conn,
        "SELECT id, name, steps_json, created_at, updated_at, last_run_at, last_status FROM workflows ORDER BY updated_at DESC",
        &[],
        &["id", "name", "steps_json", "created_at", "updated_at", "last_run_at", "last_status"],
    )
}

#[tauri::command]
fn workflow_save(state: State<'_, AppState>, workflow: Value) -> AppResult<Value> {
    let name = db::require_text(workflow.get("name"), "name")?;
    let steps = workflow.get("steps").cloned().unwrap_or_else(|| json!([]));
    let id = db::text(workflow.get("id"));
    let now = db::now();
    let conn = state.conn()?;
    if id.is_empty() {
        let new_id = uuid::Uuid::new_v4().to_string();
        db::execute(
            &conn,
            "INSERT INTO workflows (id, name, steps_json, created_at, updated_at, last_run_at, last_status) VALUES (?1,?2,?3,?4,?4,'','')",
            &[
                Value::String(new_id.clone()),
                Value::String(name),
                Value::String(steps.to_string()),
                Value::String(now),
            ],
        )?;
        return Ok(json!({ "id": new_id }));
    }
    db::execute(
        &conn,
        "UPDATE workflows SET name=?1, steps_json=?2, updated_at=?3 WHERE id=?4",
        &[
            Value::String(name),
            Value::String(steps.to_string()),
            Value::String(now),
            Value::String(id.clone()),
        ],
    )?;
    Ok(json!({ "id": id }))
}

#[tauri::command]
fn workflow_delete(state: State<'_, AppState>, id: String) -> AppResult<()> {
    let conn = state.conn()?;
    db::execute(&conn, "DELETE FROM workflows WHERE id=?1", &[Value::String(id)])?;
    Ok(())
}

#[tauri::command]
async fn workflow_run(app: AppHandle, workflow_id: String) -> AppResult<Value> {
    let (ctx, workflow) = {
        let state = app.state::<AppState>();
        let conn = state.conn()?;
        let row = db::query_one(
            &conn,
            "SELECT id, name, steps_json FROM workflows WHERE id=?1",
            &[Value::String(workflow_id.clone())],
            &["id", "name", "steps_json"],
        )?
        .ok_or_else(|| AppError::new("workflow_not_found", "Workflow not found"))?;
        (state.ctx(&app), row)
    };
    let run_id = uuid::Uuid::new_v4().to_string();
    let steps = parse_steps(&workflow.get("steps_json").cloned().unwrap_or_else(|| json!([])));
    let settings = ctx.settings.clone();
    {
        let conn = ctx.db.lock().map_err(|_| AppError::new("db_locked", "database busy"))?;
        db::execute(
            &conn,
            "INSERT INTO workflow_runs (id, workflow_id, status, started_at, finished_at, log) VALUES (?1,?2,'running',?3,'','')",
            &[Value::String(run_id.clone()), Value::String(workflow_id.clone()), Value::String(db::now())],
        )?;
    }

    let run_id_clone = run_id.clone();
    let workflow_id_clone = workflow_id.clone();
    let result = tauri::async_runtime::spawn_blocking(move || -> AppResult<Value> {
        let mut log: Vec<String> = Vec::new();
        let mut last_image_id: Option<String> = None;
        let mut produced = 0usize;
        for (index, step) in steps.iter().enumerate() {
            let kind = db::text(step.get("type"));
            log.push(format!("step {}: {}", index + 1, if kind.is_empty() { "unknown" } else { &kind }));
            match kind.as_str() {
                "generate" => {
                    let params = step.get("params").cloned().unwrap_or_else(|| json!({}));
                    let prompt = db::text(params.get("prompt"));
                    if prompt.trim().is_empty() {
                        log.push("  skipped: no prompt".into());
                        continue;
                    }
                    let optimized = db::text(params.get("optimized_prompt"));
                    let final_prompt = if optimized.trim().is_empty() { prompt.clone() } else { optimized };
                    let mut request = engine::GenerationRequest {
                        job_id: format!("workflow-{run_id_clone}-{index}"),
                        generation_id: uuid::Uuid::new_v4().to_string(),
                        project_id: db::text(params.get("project_id")),
                        profile_id: settings.active_profile_id.clone(),
                        prompt_original: prompt.clone(),
                        prompt_final: final_prompt,
                        negative: db::text(params.get("negative")),
                        aspect: db::text(params.get("aspect")),
                        style_notes: db::text(params.get("style")),
                        count: params.get("count").and_then(|v| v.as_u64()).unwrap_or(1) as u32,
                        reference_images: params
                            .get("references")
                            .and_then(|v| v.as_array())
                            .map(|a| a.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                            .unwrap_or_default(),
                        output_dir: String::new(),
                        model: settings.codex_model.clone(),
                        reasoning_effort: settings.reasoning_effort.clone(),
                        verbosity: settings.verbosity.clone(),
                        sandbox_mode: settings.sandbox_mode.clone(),
                        timeout_secs: settings.generation_timeout_secs,
                        quality_preset: settings.quality_preset.clone(),
                    };
                    if request.count == 0 {
                        request.count = 1;
                    }
                    insert_generation(&ctx, &request, "running")?;
                    let cancel = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
                    match engine::execute(&ctx, &request, cancel) {
                        Ok(outcome) => {
                            log.push(format!("  generated {} image(s) in {} ms", outcome.images.len(), outcome.duration_ms));
                            produced += outcome.images.len();
                            if let Some(first) = outcome.images.first() {
                                last_image_id = Some(first.id.clone());
                            }
                            if outcome.status != "succeeded" && !outcome.error.is_empty() {
                                log.push(format!("  engine error: {}", outcome.error));
                            }
                        }
                        Err(err) => log.push(format!("  engine failed: {}", err.message)),
                    }
                }
                "upscale" => {
                    let Some(image_id) = last_image_id.clone() else {
                        log.push("  skipped: no image from a previous step".into());
                        continue;
                    };
                    let factor = step
                        .get("params")
                        .and_then(|p| p.get("scale"))
                        .and_then(|v| v.as_f64())
                        .unwrap_or(2.0);
                    let ops = imageops::TransformOps {
                        scale: Some(factor.clamp(1.05, 4.0) as f32),
                        sharpen_sigma: Some(0.8),
                        ..Default::default()
                    };
                    let conn = ctx.db.lock().map_err(|_| AppError::new("db_locked", "database busy"))?;
                    match library::apply_post_process(&conn, &ctx.paths, &image_id, &ops, "upscale") {
                        Ok(value) => {
                            last_image_id = value.get("id").map(|v| db::text(Some(v)));
                            log.push("  upscaled with Lanczos3".into());
                        }
                        Err(err) => log.push(format!("  upscale failed: {}", err.message)),
                    }
                }
                "remove_background" => {
                    let Some(image_id) = last_image_id.clone() else {
                        log.push("  skipped: no image from a previous step".into());
                        continue;
                    };
                    let tolerance = step
                        .get("params")
                        .and_then(|p| p.get("tolerance"))
                        .and_then(|v| v.as_u64())
                        .unwrap_or(12) as u8;
                    let ops = imageops::TransformOps {
                        remove_background: Some(tolerance),
                        output_format: Some("png".into()),
                        ..Default::default()
                    };
                    let conn = ctx.db.lock().map_err(|_| AppError::new("db_locked", "database busy"))?;
                    match library::apply_post_process(&conn, &ctx.paths, &image_id, &ops, "background") {
                        Ok(value) => {
                            last_image_id = value.get("id").map(|v| db::text(Some(v)));
                            log.push("  background keyed out to transparent PNG".into());
                        }
                        Err(err) => log.push(format!("  background removal failed: {}", err.message)),
                    }
                }
                "convert" => {
                    let Some(image_id) = last_image_id.clone() else {
                        log.push("  skipped: no image from a previous step".into());
                        continue;
                    };
                    let format = step
                        .get("params")
                        .and_then(|p| p.get("format"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("webp")
                        .to_string();
                    let quality = step
                        .get("params")
                        .and_then(|p| p.get("quality"))
                        .and_then(|v| v.as_u64())
                        .unwrap_or(90) as u8;
                    let ops = imageops::TransformOps {
                        output_format: Some(format.clone()),
                        quality: Some(quality),
                        ..Default::default()
                    };
                    let conn = ctx.db.lock().map_err(|_| AppError::new("db_locked", "database busy"))?;
                    match library::apply_post_process(&conn, &ctx.paths, &image_id, &ops, "convert") {
                        Ok(value) => {
                            last_image_id = value.get("id").map(|v| db::text(Some(v)));
                            log.push(format!("  converted to {}", format));
                        }
                        Err(err) => log.push(format!("  conversion failed: {}", err.message)),
                    }
                }
                other => log.push(format!("  unknown step type '{}' skipped", other)),
            }
        }
        let status = if produced > 0 || last_image_id.is_some() { "succeeded" } else { "failed" };
        let log_text = log.join("\n");
        if let Ok(conn) = ctx.db.lock() {
            let _ = db::execute(
                &conn,
                "UPDATE workflow_runs SET status=?1, finished_at=?2, log=?3 WHERE id=?4",
                &[
                    Value::String(status.into()),
                    Value::String(db::now()),
                    Value::String(log_text.clone()),
                    Value::String(run_id_clone.clone()),
                ],
            );
            let _ = db::execute(
                &conn,
                "UPDATE workflows SET last_run_at=?1, last_status=?2 WHERE id=?3",
                &[
                    Value::String(db::now()),
                    Value::String(status.into()),
                    Value::String(workflow_id_clone),
                ],
            );
        }
        Ok(json!({
            "run_id": run_id_clone,
            "status": status,
            "log": log,
            "images": produced,
            "last_image_id": last_image_id,
        }))
    })
    .await
    .map_err(|e| AppError::new("join_error", e.to_string()))??;
    Ok(result)
}

// ------------------------------------------------------------------ registry

#[tauri::command]
fn registry_sync(state: State<'_, AppState>, features: Vec<Value>) -> AppResult<Value> {
    let conn = state.conn()?;
    let count = registry::sync(&conn, &features)?;
    Ok(json!({ "synced": count }))
}

#[tauri::command]
fn registry_list(state: State<'_, AppState>) -> AppResult<Vec<Value>> {
    let conn = state.conn()?;
    registry::list(&conn)
}

#[tauri::command]
fn registry_summary(state: State<'_, AppState>) -> AppResult<Value> {
    let conn = state.conn()?;
    registry::summary(&conn)
}

#[tauri::command]
fn registry_export(state: State<'_, AppState>) -> AppResult<Value> {
    let conn = state.conn()?;
    let path = registry::export_markdown(&conn, &state.paths.exports, env!("CARGO_PKG_VERSION"))?;
    Ok(json!({ "path": path }))
}

// ----------------------------------------------------------------- analytics

#[tauri::command]
fn analytics_summary(state: State<'_, AppState>) -> AppResult<Value> {
    let conn = state.conn()?;
    analytics::summary(&conn)
}

#[tauri::command]
fn analytics_timeseries(state: State<'_, AppState>, days: i64) -> AppResult<Value> {
    let conn = state.conn()?;
    analytics::timeseries(&conn, days)
}

#[tauri::command]
fn analytics_export(state: State<'_, AppState>) -> AppResult<Value> {
    let conn = state.conn()?;
    let path = analytics::export_markdown(&conn, &state.paths.exports)?;
    Ok(json!({ "path": path }))
}

// --------------------------------------------------------------- diagnostics

#[tauri::command]
fn diagnostics_run(state: State<'_, AppState>) -> AppResult<Value> {
    let conn = state.conn()?;
    let settings = state.settings();
    Ok(diagnostics::run_all(&state.paths, &settings, &conn))
}

#[tauri::command]
fn diagnostics_export(state: State<'_, AppState>) -> AppResult<Value> {
    let conn = state.conn()?;
    let settings = state.settings();
    diagnostics::export_report(&state.paths, &settings, &conn)
}

#[tauri::command]
fn updates_check(state: State<'_, AppState>) -> AppResult<Value> {
    updates::check(&state.settings())
}

#[tauri::command]
fn storage_usage(state: State<'_, AppState>) -> AppResult<Value> {
    let mut files = 0u64;
    let mut bytes = 0u64;
    for entry in walkdir::WalkDir::new(&state.paths.root).into_iter().flatten() {
        if entry.file_type().is_file() {
            files += 1;
            bytes += entry.metadata().map(|m| m.len()).unwrap_or(0);
        }
    }
    Ok(json!({ "files": files, "bytes": bytes, "root": state.paths.root.to_string_lossy() }))
}

// ---------------------------------------------------------------------- boot

pub fn run() {
    tauri::Builder::default()
        .setup(|app| -> Result<(), Box<dyn std::error::Error>> {
            let paths = AppPaths::resolve()?;
            paths.ensure()?;
            let settings = Settings::load(&paths);
            let conn = db::open(&paths.db)?;
            let _ = queue::recover_interrupted(&conn);
            let state = AppState {
                paths: paths.clone(),
                db: Arc::new(Mutex::new(conn)),
                settings: Mutex::new(settings.clone()),
                queue: Arc::new(queue::QueueRuntime::default()),
            };
            let runtime = state.queue.clone();
            let workers = settings.max_concurrent_jobs.clamp(1, 4) as usize;
            app.manage(state);
            let handle = app.handle().clone();
            let ctx = {
                let managed = app.state::<AppState>();
                managed.ctx(&handle)
            };
            queue::start_workers(ctx, runtime, workers);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_bootstrap,
            settings_get,
            settings_save,
            open_path,
            open_url,
            picker_roots,
            picker_list,
            picker_ensure_dir,
            auth_profiles,
            auth_import,
            auth_replace,
            auth_status,
            auth_restore_vault,
            auth_delete,
            auth_set_active,
            auth_login_start,
            auth_logout,
            codex_info,
            codex_install_skill,
            codex_models,
            codex_config_read,
            codex_config_write,
            codex_complete,
            codex_health,
            generate_now,
            generate_queue,
            jobs_list,
            job_events,
            job_cancel,
            job_retry,
            queue_pause,
            queue_state,
            generations_list,
            gallery_list,
            image_detail,
            image_favorite,
            image_tags,
            image_note,
            image_delete,
            images_duplicates,
            image_compare,
            image_probe,
            post_process,
            bulk_rename,
            project_create,
            project_list,
            project_update,
            project_archive,
            project_backup,
            project_restore,
            prompt_save,
            prompt_list,
            prompt_delete,
            prompt_versions,
            prompts_export,
            prompts_import,
            reference_add,
            reference_list,
            reference_delete,
            workflow_list,
            workflow_save,
            workflow_delete,
            workflow_run,
            registry_sync,
            registry_list,
            registry_summary,
            registry_export,
            analytics_summary,
            analytics_timeseries,
            analytics_export,
            diagnostics_run,
            diagnostics_export,
            updates_check,
            storage_usage,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ARIA Image Studio");
}
