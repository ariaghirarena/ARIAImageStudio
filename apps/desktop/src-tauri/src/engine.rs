//! ARIA Codex Image Engine.
//!
//! Generation is delegated to the official Codex CLI and its built-in
//! `image_gen` tool. ARIA never calls an image API, never needs an
//! OPENAI_API_KEY, and never invents engine parameters. Outputs are detected in
//! the ARIA-owned `$CODEX_HOME/generated_images` tree (the documented built-in
//! save location) and imported into the project workspace.

use crate::codex::{self, ExecOptions};
use crate::db;
use crate::error::{AppError, AppResult};
use crate::imageops;
use crate::paths::AppPaths;
use crate::settings::Settings;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct GenerationRequest {
    pub job_id: String,
    pub generation_id: String,
    pub project_id: String,
    pub profile_id: String,
    pub prompt_original: String,
    pub prompt_final: String,
    pub negative: String,
    pub aspect: String,
    pub style_notes: String,
    pub count: u32,
    pub reference_images: Vec<String>,
    pub output_dir: String,
    pub model: String,
    pub reasoning_effort: String,
    pub verbosity: String,
    pub sandbox_mode: String,
    pub timeout_secs: u64,
    pub quality_preset: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ImportedImage {
    pub id: String,
    pub path: String,
    pub thumb_path: String,
    pub file_name: String,
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub size_bytes: u64,
    pub sha256: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct GenerationOutcome {
    pub generation_id: String,
    pub status: String,
    pub images: Vec<ImportedImage>,
    pub last_message: String,
    pub log: Vec<String>,
    pub duration_ms: u64,
    pub codex_exit: Option<i32>,
    pub error: String,
}

#[derive(Clone)]
pub struct EngineCtx {
    pub app: AppHandle,
    pub paths: AppPaths,
    pub settings: Settings,
    pub db: Arc<Mutex<Connection>>,
}

fn engine_prompt(req: &GenerationRequest) -> String {
    let count = req.count.clamp(1, 8);
    let mut lines = Vec::new();
    lines.push("You are the image generation engine of ARIA Image Studio.".to_string());
    lines.push("Use ONLY the built-in image_gen tool to create the requested raster image(s).".to_string());
    lines.push("Hard rules:".to_string());
    lines.push("- Never run scripts/image_gen.py or any other script.".to_string());
    lines.push("- Never use OPENAI_API_KEY and never call an image API or SDK directly.".to_string());
    lines.push("- Do not ask questions; the specification below is final. Do not add subjects, brands or text that the specification does not contain.".to_string());
    lines.push(format!("- Produce exactly {count} image(s)."));
    lines.push("- After the images exist, reply with one single line: ARIA_DONE".to_string());
    lines.push(String::new());
    lines.push("IMAGE SPECIFICATION".to_string());
    lines.push(req.prompt_final.trim().to_string());
    if !req.negative.trim().is_empty() {
        lines.push(format!("Avoid strictly: {}", req.negative.trim()));
    }
    if !req.aspect.trim().is_empty() {
        lines.push(format!("Composition / aspect guidance: {}", req.aspect.trim()));
    }
    if !req.style_notes.trim().is_empty() {
        lines.push(format!("Style directives: {}", req.style_notes.trim()));
    }
    for (index, reference) in req.reference_images.iter().enumerate() {
        lines.push(format!(
            "Input image {} is a reference: preserve its subject identity and do not treat it as an edit target.",
            index + 1
        ));
        let _ = reference;
    }
    lines.push(String::new());
    lines.push(format!("Quality preset: {}", req.quality_preset));
    lines.join("\n")
}

fn snapshot_tree(root: &Path) -> HashSet<PathBuf> {
    let mut out = HashSet::new();
    if !root.is_dir() {
        return out;
    }
    for entry in walkdir::WalkDir::new(root).into_iter().flatten() {
        if entry.file_type().is_file() && imageops::is_image_file(entry.path()) {
            out.insert(entry.path().to_path_buf());
        }
    }
    out
}

fn collect_new_images(roots: &[PathBuf], before: &HashSet<PathBuf>, since: SystemTime) -> Vec<PathBuf> {
    let mut found: Vec<(SystemTime, PathBuf)> = Vec::new();
    for root in roots {
        if !root.is_dir() {
            continue;
        }
        for entry in walkdir::WalkDir::new(root).into_iter().flatten() {
            if !entry.file_type().is_file() || !imageops::is_image_file(entry.path()) {
                continue;
            }
            let path = entry.path().to_path_buf();
            if before.contains(&path) {
                continue;
            }
            let modified = entry
                .metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .unwrap_or(SystemTime::UNIX_EPOCH);
            if modified + Duration::from_secs(2) >= since {
                found.push((modified, path));
            }
        }
    }
    found.sort_by(|a, b| a.0.cmp(&b.0));
    found.into_iter().map(|(_, path)| path).collect()
}

fn project_output_dir(paths: &AppPaths, project_slug: &str, requested: &str) -> PathBuf {
    if !requested.trim().is_empty() {
        return PathBuf::from(requested.trim());
    }
    paths.project_dir(project_slug).join("Generated")
}

fn project_thumb_dir(paths: &AppPaths, project_slug: &str) -> PathBuf {
    paths.project_dir(project_slug).join(".thumbs")
}

fn slug_for(conn: &Connection, project_id: &str) -> String {
    if project_id.is_empty() {
        return "default".to_string();
    }
    db::query_one(
        conn,
        "SELECT slug FROM projects WHERE id = ?1",
        &[Value::String(project_id.to_string())],
        &["slug"],
    )
    .ok()
    .flatten()
    .map(|v| db::text(v.get("slug")))
    .filter(|s| !s.is_empty())
    .unwrap_or_else(|| "default".into())
}

/// Execute one generation request synchronously (queue worker calls this).
pub fn execute(ctx: &EngineCtx, req: &GenerationRequest, cancel: Arc<AtomicBool>) -> AppResult<GenerationOutcome> {
    let started = std::time::Instant::now();
    let started_at = db::now();

    let (codex_home, slug) = {
        let conn = ctx.db.lock().map_err(|_| AppError::new("db_locked", "database busy"))?;
        let home = if req.profile_id.is_empty() {
            ctx.paths.default_codex_home()
        } else {
            ctx.paths.profile_codex_home(&req.profile_id)
        };
        (home, slug_for(&conn, &req.project_id))
    };
    std::fs::create_dir_all(&codex_home)?;

    if !codex_home.join("auth.json").is_file() {
        return Err(AppError::new(
            "not_authenticated",
            "No Codex account is connected for this profile",
        )
        .with_hint("Open Authentication and import auth.json or sign in with ChatGPT."));
    }

    let output_dir = project_output_dir(&ctx.paths, &slug, &req.output_dir);
    let thumb_dir = project_thumb_dir(&ctx.paths, &slug);
    std::fs::create_dir_all(&output_dir)?;
    std::fs::create_dir_all(&thumb_dir)?;
    let workdir = ctx.paths.project_dir(&slug).join("work");
    std::fs::create_dir_all(&workdir)?;

    let generated_root = codex_home.join("generated_images");
    let before = snapshot_tree(&generated_root);
    let before_work = snapshot_tree(&workdir);
    let since = SystemTime::now();

    let prompt = engine_prompt(req);
    let options = ExecOptions {
        codex_path: ctx.settings.codex_path.clone(),
        codex_home: codex_home.clone(),
        workdir: workdir.clone(),
        model: if req.model.trim().is_empty() { None } else { Some(req.model.clone()) },
        reasoning_effort: if req.reasoning_effort.trim().is_empty() { None } else { Some(req.reasoning_effort.clone()) },
        verbosity: if req.verbosity.trim().is_empty() { None } else { Some(req.verbosity.clone()) },
        sandbox_mode: if req.sandbox_mode.trim().is_empty() {
            Some("workspace-write".into())
        } else {
            Some(req.sandbox_mode.clone())
        },
        images: req.reference_images.iter().map(PathBuf::from).collect(),
        timeout: Duration::from_secs(req.timeout_secs.max(60)),
        extra_args: Vec::new(),
    };

    let job_id_for_event = req.job_id.clone();
    let app_handle = ctx.app.clone();
    let outcome = codex::run(&options, &prompt, cancel, |line| {
        let _ = app_handle.emit(
            "aria://generation-line",
            json!({ "job_id": job_id_for_event, "level": line.level, "text": line.text }),
        );
    })?;

    let mut roots = vec![generated_root.clone(), workdir.join("generated"), workdir.clone()];
    roots.dedup();
    let mut new_files = collect_new_images(&roots[..2], &before_work, since);
    let generated_new = collect_new_images(&roots[0..1], &before, since);
    for path in generated_new {
        if !new_files.contains(&path) {
            new_files.push(path);
        }
    }
    new_files.retain(|p| !p.starts_with(&output_dir));

    let mut images: Vec<ImportedImage> = Vec::new();
    for (index, source) in new_files.iter().enumerate() {
        let ext = source
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_else(|| "png".into());
        let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S").to_string();
        let stem = format!("aria-{stamp}-{:02}", index + 1);
        let target = imageops::unique_path(&output_dir, &stem, &ext);
        if std::fs::copy(source, &target).is_err() {
            continue;
        }
        let info = match imageops::inspect(&target) {
            Ok(info) => info,
            Err(_) => continue,
        };
        let thumb_path = thumb_dir.join(format!("{}.webp", stem));
        let mut thumb_string = String::new();
        if imageops::make_thumbnail(&target, &thumb_path, ctx.settings.thumbnail_size.clamp(120, 1024), 82).is_ok() {
            thumb_string = thumb_path.to_string_lossy().to_string();
        }
        let image_id = uuid::Uuid::new_v4().to_string();
        if let Ok(conn) = ctx.db.lock() {
            let inserted = db::execute(
                &conn,
                "INSERT OR IGNORE INTO images (id, generation_id, project_id, path, thumb_path, file_name, format, width, height, size_bytes, sha256, created_at, favorite, tags_json, note, prompt, optimized_prompt, engine, model_note, references_json, edit_history_json, parent_image_id)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,0,'[]','',?13,?14,'codex-image_gen',?15,?16,'[]','')",
                &[
                    Value::String(image_id.clone()),
                    Value::String(req.generation_id.clone()),
                    Value::String(req.project_id.clone()),
                    Value::String(info.path.clone()),
                    Value::String(thumb_string.clone()),
                    Value::String(info.file_name.clone()),
                    Value::String(info.format.clone()),
                    json!(info.width),
                    json!(info.height),
                    json!(info.size_bytes),
                    Value::String(info.sha256.clone()),
                    Value::String(started_at.clone()),
                    Value::String(req.prompt_original.clone()),
                    Value::String(req.prompt_final.clone()),
                    Value::String(req.model.clone()),
                    Value::String(json!(&req.reference_images).to_string()),
                ],
            );
            if inserted.is_err() {
                continue;
            }
        }
        images.push(ImportedImage {
            id: image_id,
            path: info.path,
            thumb_path: thumb_string,
            file_name: info.file_name,
            width: info.width,
            height: info.height,
            format: info.format,
            size_bytes: info.size_bytes,
            sha256: info.sha256,
        });
    }

    let duration_ms = started.elapsed().as_millis() as u64;
    let mut status = (if outcome.cancelled {
        "cancelled"
    } else if outcome.timed_out {
        "timeout"
    } else if !images.is_empty() {
        "succeeded"
    } else {
        "failed"
    })
    .to_string();

    let mut error = String::new();
    if images.is_empty() {
        if outcome.exit_code.unwrap_or(1) != 0 {
            error = format!(
                "Codex با کد {:?} متوقف شد. {}",
                outcome.exit_code,
                outcome
                    .stderr_tail
                    .lines()
                    .rev()
                    .take(4)
                    .collect::<Vec<_>>()
                    .into_iter()
                    .rev()
                    .collect::<Vec<_>>()
                    .join(" ")
            );
        } else {
            error = "Codex بدون ساخت تصویر پایان یافت. ممکن است حساب شما در این مدل به ابزار داخلی تصویرسازی دسترسی نداشته باشد.".into();
        }
        status = if outcome.cancelled { "cancelled".into() } else { "failed".into() };
    }

    if let Ok(conn) = ctx.db.lock() {
        let _ = db::execute(
            &conn,
            "UPDATE generations SET status=?1, finished_at=?2, duration_ms=?3, error=?4, result_count=?5 WHERE id=?6",
            &[
                Value::String(status.clone()),
                Value::String(db::now()),
                json!(duration_ms),
                Value::String(error.clone()),
                json!(images.len()),
                Value::String(req.generation_id.clone()),
            ],
        );
        let _ = db::execute(
            &conn,
            "INSERT INTO analytics_events (ts, kind, payload_json) VALUES (?1, 'generation', ?2)",
            &[
                Value::String(db::now()),
                Value::String(
                    json!({
                        "status": &status,
                        "duration_ms": duration_ms,
                        "images": images.len(),
                        "project_id": &req.project_id,
                        "preset": &req.quality_preset,
                    })
                    .to_string(),
                ),
            ],
        );
    }

    Ok(GenerationOutcome {
        generation_id: req.generation_id.clone(),
        status,
        images,
        last_message: outcome.last_message,
        log: outcome.log.iter().map(|l| l.text.clone()).collect(),
        duration_ms,
        codex_exit: outcome.exit_code,
        error,
    })
}

/// Text-only Codex turn used by prompt intelligence, verification and
/// thumbnail-free analysis. Returns the agent's final message.
pub fn run_text(
    settings: &Settings,
    codex_home: &Path,
    workdir: &Path,
    prompt: &str,
    timeout: Duration,
) -> AppResult<String> {
    std::fs::create_dir_all(workdir)?;
    if !codex_home.join("auth.json").is_file() {
        return Err(AppError::new("not_authenticated", "Connect a Codex account first"));
    }
    let options = ExecOptions {
        codex_path: settings.codex_path.clone(),
        codex_home: codex_home.to_path_buf(),
        workdir: workdir.to_path_buf(),
        model: if settings.codex_model.trim().is_empty() { None } else { Some(settings.codex_model.clone()) },
        reasoning_effort: if settings.reasoning_effort.trim().is_empty() { None } else { Some(settings.reasoning_effort.clone()) },
        verbosity: if settings.verbosity.trim().is_empty() { None } else { Some(settings.verbosity.clone()) },
        sandbox_mode: Some("read-only".into()),
        images: Vec::new(),
        timeout,
        extra_args: Vec::new(),
    };
    let outcome = codex::run(&options, prompt, Arc::new(AtomicBool::new(false)), |_| {})?;
    let message = if !outcome.last_message.trim().is_empty() {
        outcome.last_message.trim().to_string()
    } else {
        outcome
            .log
            .iter()
            .rev()
            .find(|l| l.text.contains("agent_message"))
            .map(|l| l.text.clone())
            .unwrap_or_default()
    };
    if message.is_empty() {
        return Err(AppError::new("empty_response", "Codex returned no text").with_hint("Check the Diagnostics page for details."));
    }
    Ok(message)
}
