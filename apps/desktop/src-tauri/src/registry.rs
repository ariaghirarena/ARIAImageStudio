//! Feature registry persistence (the single source of truth for the 300
//! product capabilities is the TypeScript registry; this mirror enables SQL
//! reporting and honest status tracking).

use crate::db;
use crate::error::AppResult;
use rusqlite::Connection;
use serde_json::{json, Value};

pub fn sync(conn: &Connection, features: &[Value]) -> AppResult<usize> {
    let mut count = 0;
    for feature in features {
        let id = db::text(feature.get("id"));
        if id.is_empty() {
            continue;
        }
        db::execute(
            conn,
            "INSERT INTO feature_registry (id, category, name, description, status, availability, dependencies, test_status, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
             ON CONFLICT(id) DO UPDATE SET category=?2, name=?3, description=?4, status=?5, availability=?6, dependencies=?7, test_status=?8, updated_at=?9",
            &[
                Value::String(id),
                Value::String(db::text(feature.get("category"))),
                Value::String(db::text(feature.get("name"))),
                Value::String(db::text(feature.get("description"))),
                Value::String(db::text(feature.get("status"))),
                Value::String(db::text(feature.get("availability"))),
                Value::String(db::text(feature.get("dependencies"))),
                Value::String(db::text(feature.get("testStatus"))),
                Value::String(db::now()),
            ],
        )?;
        count += 1;
    }
    Ok(count)
}

pub fn summary(conn: &Connection) -> AppResult<Value> {
    let by_status = db::query_json(
        conn,
        "SELECT status, COUNT(*) AS count FROM feature_registry GROUP BY status ORDER BY count DESC",
        &[],
        &["status", "count"],
    )?;
    let by_category = db::query_json(
        conn,
        "SELECT category, COUNT(*) AS count, SUM(CASE WHEN status IN ('implemented','tested') THEN 1 ELSE 0 END) AS done FROM feature_registry GROUP BY category ORDER BY category",
        &[],
        &["category", "count", "done"],
    )?;
    let total = db::count(conn, "SELECT COUNT(*) FROM feature_registry", &[])?;
    Ok(json!({ "total": total, "by_status": by_status, "by_category": by_category }))
}

pub fn list(conn: &Connection) -> AppResult<Vec<Value>> {
    db::query_json(
        conn,
        "SELECT id, category, name, description, status, availability, dependencies, test_status FROM feature_registry ORDER BY id ASC",
        &[],
        &["id", "category", "name", "description", "status", "availability", "dependencies", "test_status"],
    )
}

pub fn export_markdown(conn: &Connection, dir: &std::path::Path, version: &str) -> AppResult<String> {
    std::fs::create_dir_all(dir)?;
    let features = list(conn)?;
    let summary_value = summary(conn)?;
    let mut out = String::new();
    out.push_str("# ARIA Image Studio — Feature Registry (300 capabilities)\n\n");
    out.push_str(&format!("App version: {version}\n\n"));
    out.push_str("| Status | Count |\n|---|---|\n");
    if let Some(rows) = summary_value.get("by_status").and_then(|v| v.as_array()) {
        for row in rows {
            out.push_str(&format!(
                "| {} | {} |\n",
                db::text(row.get("status")),
                db::text(row.get("count"))
            ));
        }
    }
    out.push_str("\n## Capabilities\n\n| ID | Category | Feature | Status | Availability | Test |\n|---|---|---|---|---|---|\n");
    for feature in features {
        out.push_str(&format!(
            "| {} | {} | {} | {} | {} | {} |\n",
            db::text(feature.get("id")),
            db::text(feature.get("category")),
            db::text(feature.get("name")).replace('|', "/"),
            db::text(feature.get("status")),
            db::text(feature.get("availability")),
            db::text(feature.get("test_status")),
        ));
    }
    let path = dir.join("FEATURES-300.md");
    std::fs::write(&path, out)?;
    Ok(path.to_string_lossy().to_string())
}
