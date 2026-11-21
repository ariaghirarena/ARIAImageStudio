//! Durable generation queue. Jobs live in SQLite, so pending work survives an
//! app restart. A small pool of worker threads executes them sequentially
//! against the Codex engine.

use crate::db;
use crate::engine::{self, EngineCtx, GenerationRequest};
use crate::error::AppResult;
use rusqlite::Connection;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

#[derive(Default)]
pub struct QueueRuntime {
    pub paused: AtomicBool,
    pub cancels: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl QueueRuntime {
    pub fn cancel_flag(&self, job_id: &str) -> Arc<AtomicBool> {
        let mut map = self.cancels.lock().unwrap_or_else(|e| e.into_inner());
        map.entry(job_id.to_string())
            .or_insert_with(|| Arc::new(AtomicBool::new(false)))
            .clone()
    }
}

fn next_job(conn: &Connection) -> Option<String> {
    db::query_one(
        conn,
        "SELECT id FROM jobs WHERE status = 'queued' ORDER BY priority DESC, created_at ASC LIMIT 1",
        &[],
        &["id"],
    )
    .ok()
    .flatten()
    .map(|v| db::text(v.get("id")))
}

fn load_job(conn: &Connection, job_id: &str) -> Option<Value> {
    db::query_one(
        conn,
        "SELECT id, project_id, kind, status, prompt, params_json, attempts, max_attempts FROM jobs WHERE id = ?1",
        &[Value::String(job_id.to_string())],
        &["id", "project_id", "kind", "status", "prompt", "params_json", "attempts", "max_attempts"],
    )
    .ok()
    .flatten()
}

fn set_status(conn: &Connection, job_id: &str, status: &str, error: &str) {
    let _ = db::execute(
        conn,
        "UPDATE jobs SET status=?1, error=?2, finished_at=CASE WHEN ?1 IN ('succeeded','failed','cancelled') THEN ?3 ELSE finished_at END WHERE id=?4",
        &[
            Value::String(status.into()),
            Value::String(error.into()),
            Value::String(db::now()),
            Value::String(job_id.into()),
        ],
    );
}

fn log_event(conn: &Connection, job_id: &str, level: &str, message: &str) {
    let _ = db::execute(
        conn,
        "INSERT INTO job_events (job_id, ts, level, message) VALUES (?1, ?2, ?3, ?4)",
        &[
            Value::String(job_id.into()),
            Value::String(db::now()),
            Value::String(level.into()),
            Value::String(message.chars().take(4000).collect()),
        ],
    );
}

pub fn execute_job(ctx: &EngineCtx, runtime: &QueueRuntime, job_id: &str) {
    let job = {
        let Ok(conn) = ctx.db.lock() else { return };
        load_job(&conn, job_id)
    };
    let Some(job) = job else { return };
    if db::text(job.get("status")) != "queued" {
        return;
    }
    let params: GenerationRequest = job
        .get("params_json")
        .and_then(|v| v.as_str())
        .and_then(|raw| serde_json::from_str(raw).ok())
        .unwrap_or_default();

    let mut request = params;
    if request.generation_id.trim().is_empty() {
        request.generation_id = uuid::Uuid::new_v4().to_string();
    }
    request.job_id = job_id.to_string();
    if request.project_id.trim().is_empty() {
        request.project_id = db::text(job.get("project_id"));
    }
    request.timeout_secs = request.timeout_secs.max(ctx.settings.generation_timeout_secs);
    if request.count == 0 {
        request.count = 1;
    }

    {
        let Ok(conn) = ctx.db.lock() else { return };
        set_status(&conn, job_id, "running", "");
        let _ = db::execute(
            &conn,
            "UPDATE jobs SET started_at=?1, attempts=attempts+1 WHERE id=?2",
            &[Value::String(db::now()), Value::String(job_id.into())],
        );
        log_event(&conn, job_id, "info", "Generation started");
        let _ = db::execute(
            &conn,
            "INSERT OR REPLACE INTO generations (id, job_id, project_id, prompt_original, prompt_final, status, engine, model_note, started_at, finished_at, duration_ms, error, result_count)
             VALUES (?1, ?2, ?3, ?4, ?5, 'running', 'codex-image_gen', ?6, ?7, '', 0, '', 0)",
            &[
                Value::String(request.generation_id.clone()),
                Value::String(job_id.into()),
                Value::String(request.project_id.clone()),
                Value::String(request.prompt_original.clone()),
                Value::String(request.prompt_final.clone()),
                Value::String(request.model.clone()),
                Value::String(db::now()),
            ],
        );
    }

    let cancel = runtime.cancel_flag(job_id);
    let outcome = engine::execute(ctx, &request, cancel);
    {
        let Ok(conn) = ctx.db.lock() else { return };
        match outcome {
            Ok(result) => {
                set_status(&conn, job_id, &result.status, &result.error);
                let _ = db::execute(
                    &conn,
                    "UPDATE jobs SET result_json=?1 WHERE id=?2",
                    &[
                        Value::String(
                            json!({
                                "generation_id": result.generation_id,
                                "images": result.images,
                                "duration_ms": result.duration_ms,
                                "status": result.status,
                            })
                            .to_string(),
                        ),
                        Value::String(job_id.into()),
                    ],
                );
                log_event(
                    &conn,
                    job_id,
                    if result.status == "succeeded" { "info" } else { "error" },
                    &format!("Generation {} in {} ms ({} image(s))", result.status, result.duration_ms, result.images.len()),
                );
            }
            Err(err) => {
                set_status(&conn, job_id, "failed", &err.message);
                log_event(&conn, job_id, "error", &err.message);
                let _ = db::execute(
                    &conn,
                    "UPDATE generations SET status='failed', finished_at=?1, error=?2 WHERE id=?3",
                    &[
                        Value::String(db::now()),
                        Value::String(err.message.clone()),
                        Value::String(request.generation_id.clone()),
                    ],
                );
            }
        }
    }
    if let Ok(mut map) = runtime.cancels.lock() {
        map.remove(job_id);
    }
}

/// Start the worker pool. Safe to call once during setup.
pub fn start_workers(ctx: EngineCtx, runtime: Arc<QueueRuntime>, workers: usize) {
    for worker_index in 0..workers.max(1) {
        let ctx = EngineCtx {
            app: ctx.app.clone(),
            paths: ctx.paths.clone(),
            settings: ctx.settings.clone(),
            db: ctx.db.clone(),
        };
        let runtime = runtime.clone();
        std::thread::Builder::new()
            .name(format!("aria-queue-{worker_index}"))
            .spawn(move || loop {
                if runtime.paused.load(Ordering::Relaxed) {
                    std::thread::sleep(Duration::from_millis(600));
                    continue;
                }
                let candidate = {
                    let Ok(conn) = ctx.db.lock() else {
                        std::thread::sleep(Duration::from_millis(1000));
                        continue;
                    };
                    next_job(&conn)
                };
                match candidate {
                    Some(job_id) => execute_job(&ctx, &runtime, &job_id),
                    None => std::thread::sleep(Duration::from_millis(700)),
                }
            })
            .ok();
    }
}

/// Requeue jobs that were running when the app last closed.
pub fn recover_interrupted(conn: &Connection) -> AppResult<usize> {
    db::execute(
        conn,
        "UPDATE jobs SET status='queued', error='requeued after restart' WHERE status='running'",
        &[],
    )
}
