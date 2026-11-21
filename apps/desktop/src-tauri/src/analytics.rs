use crate::db;
use crate::error::AppResult;
use rusqlite::Connection;
use serde_json::{json, Value};

pub fn summary(conn: &Connection) -> AppResult<Value> {
    let images = db::count(conn, "SELECT COUNT(*) FROM images", &[])?;
    let disk_bytes = db::count(conn, "SELECT COALESCE(SUM(size_bytes),0) FROM images", &[])?;
    let generations = db::count(conn, "SELECT COUNT(*) FROM generations", &[])?;
    let succeeded = db::count(conn, "SELECT COUNT(*) FROM generations WHERE status='succeeded'", &[])?;
    let failed = db::count(conn, "SELECT COUNT(*) FROM generations WHERE status='failed'", &[])?;
    let avg_duration = db::count(
        conn,
        "SELECT COALESCE(CAST(AVG(duration_ms) AS INTEGER),0) FROM generations WHERE status='succeeded'",
        &[],
    )?;
    let jobs_total = db::count(conn, "SELECT COUNT(*) FROM jobs", &[])?;
    let jobs_failed = db::count(conn, "SELECT COUNT(*) FROM jobs WHERE status='failed'", &[])?;
    let prompts = db::count(conn, "SELECT COUNT(*) FROM prompts", &[])?;
    let projects = db::count(conn, "SELECT COUNT(*) FROM projects", &[])?;
    let favorites = db::count(conn, "SELECT COUNT(*) FROM images WHERE favorite=1", &[])?;
    let features = db::count(conn, "SELECT COUNT(*) FROM feature_registry", &[])?;
    let features_done = db::count(
        conn,
        "SELECT COUNT(*) FROM feature_registry WHERE status IN ('implemented','tested')",
        &[],
    )?;
    Ok(json!({
        "images": images,
        "disk_bytes": disk_bytes,
        "generations": generations,
        "generations_succeeded": succeeded,
        "generations_failed": failed,
        "avg_duration_ms": avg_duration,
        "jobs": jobs_total,
        "jobs_failed": jobs_failed,
        "prompts": prompts,
        "projects": projects,
        "favorites": favorites,
        "features_registered": features,
        "features_implemented": features_done,
        "success_rate": if generations > 0 { (succeeded as f64 / generations as f64 * 1000.0).round() / 10.0 } else { 0.0 },
    }))
}

pub fn timeseries(conn: &Connection, days: i64) -> AppResult<Value> {
    let days = days.clamp(1, 90);
    let rows = db::query_json(
        conn,
        "SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS images FROM images GROUP BY day ORDER BY day DESC LIMIT ?1",
        &[json!(days)],
        &["day", "images"],
    )?;
    let jobs = db::query_json(
        conn,
        "SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS jobs, SUM(CASE WHEN status='succeeded' THEN 1 ELSE 0 END) AS succeeded FROM jobs GROUP BY day ORDER BY day DESC LIMIT ?1",
        &[json!(days)],
        &["day", "jobs", "succeeded"],
    )?;
    Ok(json!({ "images": rows, "jobs": jobs }))
}

pub fn export_markdown(conn: &Connection, dir: &std::path::Path) -> AppResult<String> {
    std::fs::create_dir_all(dir)?;
    let summary = summary(conn)?;
    let series = timeseries(conn, 14)?;
    let mut out = String::new();
    out.push_str("# ARIA Image Studio — Usage Report\n\n");
    out.push_str(&format!("Generated: {}\n\n", db::now()));
    out.push_str("## Summary\n\n| Metric | Value |\n|---|---|\n");
    if let Some(obj) = summary.as_object() {
        for (key, value) in obj {
            out.push_str(&format!("| {} | {} |\n", key, value));
        }
    }
    out.push_str("\n## Last 14 days (images)\n\n| Day | Images |\n|---|---|\n");
    if let Some(rows) = series.get("images").and_then(|v| v.as_array()) {
        for row in rows {
            out.push_str(&format!("| {} | {} |\n", db::text(row.get("day")), db::text(row.get("images"))));
        }
    }
    let path = dir.join("analytics.md");
    std::fs::write(&path, out)?;
    Ok(path.to_string_lossy().to_string())
}
