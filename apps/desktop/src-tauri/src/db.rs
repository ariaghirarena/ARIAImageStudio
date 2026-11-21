use crate::error::{AppError, AppResult};
use rusqlite::types::{ToSqlOutput, Value as SqlValue};
use rusqlite::{params_from_iter, Connection, ToSql};
use serde_json::{Map, Value};

/// Bridges `serde_json::Value` (used by the command layer) to rusqlite parameters.
pub struct JsonParam(pub Value);

impl ToSql for JsonParam {
    fn to_sql(&self) -> rusqlite::Result<ToSqlOutput<'_>> {
        let owned = match &self.0 {
            Value::Null => SqlValue::Null,
            Value::Bool(flag) => SqlValue::Integer(if *flag { 1 } else { 0 }),
            Value::Number(number) => {
                if let Some(int) = number.as_i64() {
                    SqlValue::Integer(int)
                } else if let Some(float) = number.as_f64() {
                    SqlValue::Real(float)
                } else {
                    SqlValue::Null
                }
            }
            Value::String(text) => SqlValue::Text(text.clone()),
            other => SqlValue::Text(other.to_string()),
        };
        Ok(ToSqlOutput::Owned(owned))
    }
}

fn bindable(params: &[Value]) -> impl Iterator<Item = JsonParam> + '_ {
    params.iter().cloned().map(JsonParam)
}

pub fn open(path: &std::path::Path) -> AppResult<Connection> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    migrate(&conn)?;
    Ok(conn)
}

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, auth_mode TEXT DEFAULT 'unknown',
    status TEXT DEFAULT 'unknown', created_at TEXT, updated_at TEXT,
    last_checked TEXT, last_error TEXT);
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '', created_at TEXT, updated_at TEXT,
    archived INTEGER DEFAULT 0, output_dir TEXT DEFAULT '', settings_json TEXT DEFAULT '{}');
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY, project_id TEXT DEFAULT '', kind TEXT DEFAULT 'generation',
    status TEXT DEFAULT 'queued', priority INTEGER DEFAULT 50, prompt TEXT DEFAULT '',
    params_json TEXT DEFAULT '{}', result_json TEXT DEFAULT '{}', error TEXT DEFAULT '',
    attempts INTEGER DEFAULT 0, max_attempts INTEGER DEFAULT 3,
    created_at TEXT, started_at TEXT, finished_at TEXT);
CREATE TABLE IF NOT EXISTS job_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT, ts TEXT, level TEXT, message TEXT);
CREATE TABLE IF NOT EXISTS generations (
    id TEXT PRIMARY KEY, job_id TEXT DEFAULT '', project_id TEXT DEFAULT '',
    prompt_original TEXT DEFAULT '', prompt_final TEXT DEFAULT '',
    status TEXT DEFAULT 'running', engine TEXT DEFAULT '', model_note TEXT DEFAULT '',
    started_at TEXT, finished_at TEXT, duration_ms INTEGER DEFAULT 0,
    error TEXT DEFAULT '', result_count INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY, generation_id TEXT DEFAULT '', project_id TEXT DEFAULT '',
    path TEXT NOT NULL UNIQUE, thumb_path TEXT DEFAULT '', file_name TEXT DEFAULT '',
    format TEXT DEFAULT '', width INTEGER DEFAULT 0, height INTEGER DEFAULT 0,
    size_bytes INTEGER DEFAULT 0, sha256 TEXT DEFAULT '', created_at TEXT,
    favorite INTEGER DEFAULT 0, tags_json TEXT DEFAULT '[]', note TEXT DEFAULT '',
    prompt TEXT DEFAULT '', optimized_prompt TEXT DEFAULT '', engine TEXT DEFAULT '',
    model_note TEXT DEFAULT '', references_json TEXT DEFAULT '[]',
    edit_history_json TEXT DEFAULT '[]', parent_image_id TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS reference_assets (
    id TEXT PRIMARY KEY, project_id TEXT DEFAULT '', path TEXT NOT NULL,
    role TEXT DEFAULT 'reference', thumb_path TEXT DEFAULT '', width INTEGER DEFAULT 0,
    height INTEGER DEFAULT 0, created_at TEXT, note TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS prompts (
    id TEXT PRIMARY KEY, title TEXT DEFAULT '', body TEXT DEFAULT '',
    negative TEXT DEFAULT '', category TEXT DEFAULT 'general',
    tags_json TEXT DEFAULT '[]', favorite INTEGER DEFAULT 0, project_id TEXT DEFAULT '',
    created_at TEXT, updated_at TEXT, version INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS prompt_versions (
    id TEXT PRIMARY KEY, prompt_id TEXT, body TEXT, note TEXT DEFAULT '', created_at TEXT);
CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY, name TEXT, steps_json TEXT DEFAULT '[]', created_at TEXT,
    updated_at TEXT, last_run_at TEXT, last_status TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS workflow_runs (
    id TEXT PRIMARY KEY, workflow_id TEXT, status TEXT DEFAULT 'running',
    started_at TEXT, finished_at TEXT, log TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS tags (name TEXT PRIMARY KEY, kind TEXT DEFAULT 'image', use_count INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS feature_registry (
    id TEXT PRIMARY KEY, category TEXT, name TEXT, description TEXT,
    status TEXT DEFAULT 'planned', availability TEXT DEFAULT 'unknown',
    dependencies TEXT DEFAULT '', test_status TEXT DEFAULT 'not-tested', updated_at TEXT);
CREATE TABLE IF NOT EXISTS diagnostics (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, check_name TEXT, status TEXT, detail TEXT);
CREATE TABLE IF NOT EXISTS settings_kv (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, kind TEXT, payload_json TEXT DEFAULT '{}');
CREATE INDEX IF NOT EXISTS idx_images_created ON images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_sha ON images(sha256);
CREATE INDEX IF NOT EXISTS idx_images_project ON images(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_generations_created ON generations(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_updated ON prompts(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_job ON job_events(job_id, id);
"#;

fn migrate(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(SCHEMA)?;
    conn.execute(
        "INSERT INTO schema_meta(key, value) VALUES('version', '1') ON CONFLICT(key) DO UPDATE SET value='1'",
        [],
    )?;
    Ok(())
}

fn bool_columns(name: &str) -> bool {
    matches!(name, "favorite" | "archived" | "enabled" | "pinned" | "is_favorite")
}

pub fn row_to_json(row: &rusqlite::Row<'_>, cols: &[&str]) -> Value {
    use rusqlite::types::ValueRef;
    let mut map = Map::new();
    for (i, name) in cols.iter().enumerate() {
        let value = match row.get_ref(i) {
            Ok(ValueRef::Null) => Value::Null,
            Ok(ValueRef::Integer(n)) => {
                if bool_columns(name) {
                    Value::Bool(n != 0)
                } else {
                    Value::Number(n.into())
                }
            }
            Ok(ValueRef::Real(f)) => serde_json::Number::from_f64(f)
                .map(Value::Number)
                .unwrap_or(Value::Null),
            Ok(ValueRef::Text(t)) => Value::String(String::from_utf8_lossy(t).to_string()),
            Ok(ValueRef::Blob(_)) => Value::Null,
            Err(_) => Value::Null,
        };
        map.insert(name.to_string(), value);
    }
    Value::Object(map)
}

pub fn query_json(
    conn: &Connection,
    sql: &str,
    params: &[Value],
    cols: &[&str],
) -> AppResult<Vec<Value>> {
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map(params_from_iter(bindable(params)), |row| {
        Ok(row_to_json(row, cols))
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn query_one(
    conn: &Connection,
    sql: &str,
    params: &[Value],
    cols: &[&str],
) -> AppResult<Option<Value>> {
    Ok(query_json(conn, sql, params, cols)?.into_iter().next())
}

pub fn execute(conn: &Connection, sql: &str, params: &[Value]) -> AppResult<usize> {
    let n = conn.execute(sql, params_from_iter(bindable(params)))?;
    Ok(n)
}

pub fn count(conn: &Connection, sql: &str, params: &[Value]) -> AppResult<i64> {
    let mut stmt = conn.prepare(sql)?;
    let value: i64 = stmt.query_row(params_from_iter(bindable(params)), |row| row.get(0))?;
    Ok(value)
}

pub fn text(v: Option<&Value>) -> String {
    match v {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Number(n)) => n.to_string(),
        Some(Value::Bool(b)) => b.to_string(),
        _ => String::new(),
    }
}

pub fn require_text(v: Option<&Value>, field: &str) -> AppResult<String> {
    let s = text(v);
    if s.trim().is_empty() {
        Err(AppError::new("invalid_argument", format!("field '{}' is required", field)))
    } else {
        Ok(s)
    }
}

pub fn now() -> String {
    chrono::Utc::now().to_rfc3339()
}
