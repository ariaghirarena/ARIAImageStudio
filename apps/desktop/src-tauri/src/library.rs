//! Projects, gallery, prompts, references and post-processing. All state is in
//! SQLite; files live in the workspace tree.

use crate::db;
use crate::error::{AppError, AppResult};
use crate::imageops::{self, TransformOps};
use crate::paths::{sanitize_segment, AppPaths};
use crate::security;
use rusqlite::Connection;
use serde::Deserialize;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(default)]
pub struct GalleryQuery {
    pub project_id: String,
    pub search: String,
    pub format: String,
    pub favorite_only: bool,
    pub tag: String,
    pub sort: String,
    pub limit: i64,
    pub offset: i64,
}

pub fn create_project(conn: &Connection, paths: &AppPaths, name: &str, description: &str) -> AppResult<Value> {
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::new("invalid_argument", "Project name is required"));
    }
    let id = uuid::Uuid::new_v4().to_string();
    let mut slug = sanitize_segment(name);
    let mut suffix = 2;
    while db::count(conn, "SELECT COUNT(*) FROM projects WHERE slug = ?1", &[Value::String(slug.clone())])? > 0 {
        slug = format!("{}-{}", sanitize_segment(name), suffix);
        suffix += 1;
    }
    let dir = paths.project_dir(&slug);
    for sub in ["Inputs", "References", "Generated", "Variations", "Edited", "Exports"] {
        std::fs::create_dir_all(dir.join(sub))?;
    }
    let now = db::now();
    db::execute(
        conn,
        "INSERT INTO projects (id, name, slug, description, created_at, updated_at, archived, output_dir, settings_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, '{}')",
        &[
            Value::String(id.clone()),
            Value::String(name.to_string()),
            Value::String(slug.clone()),
            Value::String(description.to_string()),
            Value::String(now.clone()),
            Value::String(now),
            Value::String(dir.join("Generated").to_string_lossy().to_string()),
        ],
    )?;
    Ok(json!({ "id": id, "slug": slug, "dir": dir.to_string_lossy() }))
}

pub fn list_projects(conn: &Connection) -> AppResult<Vec<Value>> {
    let mut rows = db::query_json(
        conn,
        "SELECT p.id, p.name, p.slug, p.description, p.created_at, p.updated_at, p.archived, p.output_dir,
                (SELECT COUNT(*) FROM images i WHERE i.project_id = p.id) AS image_count,
                (SELECT COUNT(*) FROM jobs j WHERE j.project_id = p.id) AS job_count
         FROM projects p ORDER BY p.archived ASC, p.updated_at DESC",
        &[],
        &["id", "name", "slug", "description", "created_at", "updated_at", "archived", "output_dir", "image_count", "job_count"],
    )?;
    for row in rows.iter_mut() {
        if let Some(obj) = row.as_object_mut() {
            let slug = db::text(obj.get("slug"));
            obj.insert("dir".into(), Value::String(String::new()));
            let _ = slug;
        }
    }
    Ok(rows)
}

pub fn update_project(conn: &Connection, paths: &AppPaths, id: &str, name: &str, description: &str, output_dir: &str) -> AppResult<()> {
    let slug = db::query_one(conn, "SELECT slug FROM projects WHERE id=?1", &[Value::String(id.into())], &["slug"])?
        .map(|v| db::text(v.get("slug")))
        .ok_or_else(|| AppError::new("project_not_found", "Project not found"))?;
    let out = if output_dir.trim().is_empty() {
        paths.project_dir(&slug).join("Generated").to_string_lossy().to_string()
    } else {
        output_dir.trim().to_string()
    };
    db::execute(
        conn,
        "UPDATE projects SET name=COALESCE(NULLIF(?1,''), name), description=?2, output_dir=?3, updated_at=?4 WHERE id=?5",
        &[
            Value::String(name.trim().into()),
            Value::String(description.into()),
            Value::String(out),
            Value::String(db::now()),
            Value::String(id.into()),
        ],
    )?;
    Ok(())
}

pub fn archive_project(conn: &Connection, id: &str, archived: bool) -> AppResult<()> {
    db::execute(
        conn,
        "UPDATE projects SET archived=?1, updated_at=?2 WHERE id=?3",
        &[Value::from(if archived { 1 } else { 0 }), Value::String(db::now()), Value::String(id.into())],
    )?;
    Ok(())
}

fn copy_dir(src: &Path, dst: &Path) -> std::io::Result<u64> {
    let mut count = 0;
    for entry in walkdir::WalkDir::new(src).into_iter().flatten() {
        let rel = entry.path().strip_prefix(src).unwrap_or(entry.path());
        let target = dst.join(rel);
        if entry.file_type().is_dir() {
            std::fs::create_dir_all(&target)?;
        } else if entry.file_type().is_file() {
            if let Some(parent) = target.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::copy(entry.path(), &target)?;
            count += 1;
        }
    }
    Ok(count)
}

pub fn backup_project(conn: &Connection, paths: &AppPaths, id: &str) -> AppResult<Value> {
    let slug = db::query_one(conn, "SELECT slug FROM projects WHERE id=?1", &[Value::String(id.into())], &["slug"])?
        .map(|v| db::text(v.get("slug")))
        .ok_or_else(|| AppError::new("project_not_found", "Project not found"))?;
    let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S").to_string();
    let dst = paths.backups.join(format!("{slug}-{stamp}"));
    let files = copy_dir(&paths.project_dir(&slug), &dst)?;
    Ok(json!({ "backup_dir": dst.to_string_lossy(), "files": files }))
}

pub fn restore_project(paths: &AppPaths, backup_dir: &str) -> AppResult<Value> {
    let src = PathBuf::from(backup_dir);
    if !src.is_dir() {
        return Err(AppError::new("backup_missing", "Backup folder does not exist"));
    }
    let name = src
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .ok_or_else(|| AppError::new("invalid_argument", "Invalid backup path"))?;
    let slug = name.split('-').next().unwrap_or("restored").to_string();
    let dst = paths.project_dir(&slug);
    let files = copy_dir(&src, &dst)?;
    Ok(json!({ "restored_into": dst.to_string_lossy(), "files": files }))
}

pub fn gallery_list(conn: &Connection, q: &GalleryQuery) -> AppResult<Value> {
    let mut sql = String::from(
        "SELECT id, generation_id, project_id, path, thumb_path, file_name, format, width, height, size_bytes, sha256, created_at, favorite, tags_json, note, prompt, optimized_prompt, model_note, parent_image_id FROM images WHERE 1=1",
    );
    let mut params: Vec<Value> = Vec::new();
    if !q.project_id.trim().is_empty() {
        sql.push_str(" AND project_id = ?");
        params.push(Value::String(q.project_id.trim().to_string()));
    }
    if !q.format.trim().is_empty() {
        sql.push_str(" AND lower(format) = ?");
        params.push(Value::String(q.format.trim().to_lowercase()));
    }
    if q.favorite_only {
        sql.push_str(" AND favorite = 1");
    }
    if !q.tag.trim().is_empty() {
        sql.push_str(" AND tags_json LIKE ?");
        params.push(Value::String(format!("%\"{}\"%", q.tag.trim())));
    }
    if !q.search.trim().is_empty() {
        sql.push_str(" AND (file_name LIKE ? OR prompt LIKE ? OR optimized_prompt LIKE ? OR note LIKE ? OR tags_json LIKE ?)");
        let needle = format!("%{}%", q.search.trim());
        for _ in 0..5 {
            params.push(Value::String(needle.clone()));
        }
    }
    let order = match q.sort.as_str() {
        "oldest" => " ORDER BY created_at ASC",
        "largest" => " ORDER BY size_bytes DESC",
        "name" => " ORDER BY file_name ASC",
        _ => " ORDER BY created_at DESC",
    };
    let total_sql = format!("SELECT COUNT(*) FROM ({sql})");
    let total = db::count(conn, &total_sql, &params)?;
    sql.push_str(order);
    sql.push_str(" LIMIT ? OFFSET ?");
    let limit = if q.limit <= 0 { 60 } else { q.limit.min(500) };
    params.push(json!(limit));
    params.push(json!(q.offset.max(0)));
    let items = db::query_json(
        conn,
        &sql,
        &params,
        &["id", "generation_id", "project_id", "path", "thumb_path", "file_name", "format", "width", "height", "size_bytes", "sha256", "created_at", "favorite", "tags_json", "note", "prompt", "optimized_prompt", "model_note", "parent_image_id"],
    )?;
    Ok(json!({ "items": items, "total": total, "limit": limit, "offset": q.offset }))
}

pub fn set_favorite(conn: &Connection, id: &str, favorite: bool) -> AppResult<()> {
    db::execute(
        conn,
        "UPDATE images SET favorite=?1 WHERE id=?2",
        &[Value::from(if favorite { 1 } else { 0 }), Value::String(id.into())],
    )?;
    Ok(())
}

pub fn set_tags(conn: &Connection, id: &str, tags: Vec<String>) -> AppResult<()> {
    let clean: Vec<String> = tags
        .into_iter()
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty())
        .take(24)
        .collect();
    db::execute(
        conn,
        "UPDATE images SET tags_json=?1 WHERE id=?2",
        &[Value::String(json!(clean).to_string()), Value::String(id.into())],
    )?;
    for tag in clean {
        db::execute(
            conn,
            "INSERT INTO tags (name, kind, use_count) VALUES (?1, 'image', 1) ON CONFLICT(name) DO UPDATE SET use_count=use_count+1",
            &[Value::String(tag)],
        )?;
    }
    Ok(())
}

pub fn set_note(conn: &Connection, id: &str, note: &str) -> AppResult<()> {
    db::execute(
        conn,
        "UPDATE images SET note=?1 WHERE id=?2",
        &[Value::String(note.chars().take(4000).collect()), Value::String(id.into())],
    )?;
    Ok(())
}

pub fn delete_image(conn: &Connection, id: &str, delete_file: bool) -> AppResult<()> {
    let row = db::query_one(conn, "SELECT path, thumb_path FROM images WHERE id=?1", &[Value::String(id.into())], &["path", "thumb_path"])?;
    if let Some(row) = row {
        if delete_file {
            let path = db::text(row.get("path"));
            let thumb = db::text(row.get("thumb_path"));
            let _ = security::secure_delete(Path::new(&path));
            if !thumb.is_empty() {
                let _ = security::secure_delete(Path::new(&thumb));
            }
        }
    }
    db::execute(conn, "DELETE FROM images WHERE id=?1", &[Value::String(id.into())])?;
    Ok(())
}

pub fn find_duplicates(conn: &Connection) -> AppResult<Value> {
    let rows = db::query_json(
        conn,
        "SELECT sha256, COUNT(*) AS copies, GROUP_CONCAT(path, '|') AS paths FROM images GROUP BY sha256 HAVING copies > 1",
        &[],
        &["sha256", "copies", "paths"],
    )?;
    Ok(json!({ "groups": rows }))
}

pub fn duplicates_for_hash(conn: &Connection, hash: &str) -> AppResult<i64> {
    db::count(conn, "SELECT COUNT(*) FROM images WHERE sha256=?1", &[Value::String(hash.into())])
}

pub fn add_reference(conn: &Connection, paths: &AppPaths, project_id: &str, path: &str, role: &str) -> AppResult<Value> {
    let source = PathBuf::from(path);
    if !source.is_file() {
        return Err(AppError::new("file_missing", "Reference image not found"));
    }
    let id = uuid::Uuid::new_v4().to_string();
    let project_slug = if project_id.trim().is_empty() {
        "default".to_string()
    } else {
        db::query_one(conn, "SELECT slug FROM projects WHERE id=?1", &[Value::String(project_id.into())], &["slug"])?
            .map(|v| db::text(v.get("slug")))
            .unwrap_or_else(|| "default".into())
    };
    let dir = paths.project_dir(&project_slug).join("References");
    std::fs::create_dir_all(&dir)?;
    let info = imageops::inspect(&source)?;
    let ext = source.extension().map(|e| e.to_string_lossy().to_string()).unwrap_or_else(|| "png".into());
    let target = imageops::unique_path(&dir, &format!("ref-{}-{}", chrono::Local::now().format("%Y%m%d-%H%M%S"), &id[..6]), &ext);
    std::fs::copy(&source, &target)?;
    let thumb_dir = paths.project_dir(&project_slug).join(".thumbs");
    std::fs::create_dir_all(&thumb_dir)?;
    let thumb = thumb_dir.join(format!("ref-{id}.webp"));
    let thumb_str = if imageops::make_thumbnail(&target, &thumb, 320, 80).is_ok() {
        thumb.to_string_lossy().to_string()
    } else {
        String::new()
    };
    db::execute(
        conn,
        "INSERT INTO reference_assets (id, project_id, path, role, thumb_path, width, height, created_at, note) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,'')",
        &[
            Value::String(id.clone()),
            Value::String(project_id.into()),
            Value::String(target.to_string_lossy().to_string()),
            Value::String(if role.trim().is_empty() { "reference".into() } else { role.trim().to_string() }),
            Value::String(thumb_str),
            json!(info.width),
            json!(info.height),
            Value::String(db::now()),
        ],
    )?;
    Ok(json!({ "id": id, "path": target.to_string_lossy(), "width": info.width, "height": info.height }))
}

pub fn list_references(conn: &Connection, project_id: &str) -> AppResult<Vec<Value>> {
    let mut params: Vec<Value> = Vec::new();
    let mut sql = String::from("SELECT id, project_id, path, role, thumb_path, width, height, created_at, note FROM reference_assets WHERE 1=1");
    if !project_id.trim().is_empty() {
        sql.push_str(" AND project_id = ?");
        params.push(Value::String(project_id.into()));
    }
    sql.push_str(" ORDER BY created_at DESC LIMIT 200");
    db::query_json(conn, &sql, &params, &["id", "project_id", "path", "role", "thumb_path", "width", "height", "created_at", "note"])
}

// ---------- prompts ----------

pub fn save_prompt(conn: &Connection, payload: &Value) -> AppResult<Value> {
    let body = db::require_text(payload.get("body"), "body")?;
    let title = db::text(payload.get("title"));
    let id = db::text(payload.get("id"));
    let negative = db::text(payload.get("negative"));
    let category = if db::text(payload.get("category")).is_empty() { "general".into() } else { db::text(payload.get("category")) };
    let tags = payload.get("tags").cloned().unwrap_or_else(|| json!([]));
    let favorite = payload.get("favorite").and_then(|v| v.as_bool()).unwrap_or(false);
    let project_id = db::text(payload.get("project_id"));
    let now = db::now();
    if id.is_empty() {
        let new_id = uuid::Uuid::new_v4().to_string();
        db::execute(
            conn,
            "INSERT INTO prompts (id, title, body, negative, category, tags_json, favorite, project_id, created_at, updated_at, version) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?9,1)",
            &[
                Value::String(new_id.clone()),
                Value::String(if title.is_empty() { body.chars().take(48).collect() } else { title }),
                Value::String(body.clone()),
                Value::String(negative.clone()),
                Value::String(category),
                Value::String(tags.to_string()),
                Value::from(if favorite { 1 } else { 0 }),
                Value::String(project_id),
                Value::String(now.clone()),
            ],
        )?;
        db::execute(
            conn,
            "INSERT INTO prompt_versions (id, prompt_id, body, note, created_at) VALUES (?1,?2,?3,'initial',?4)",
            &[Value::String(uuid::Uuid::new_v4().to_string()), Value::String(new_id.clone()), Value::String(body), Value::String(now)],
        )?;
        return Ok(json!({ "id": new_id }));
    }
    let version = db::count(conn, "SELECT COALESCE(MAX(version),1) FROM prompts WHERE id=?1", &[Value::String(id.clone())])? + 1;
    db::execute(
        conn,
        "UPDATE prompts SET title=?1, body=?2, negative=?3, category=?4, tags_json=?5, favorite=?6, updated_at=?7, version=?8 WHERE id=?9",
        &[
            Value::String(title),
            Value::String(body.clone()),
            Value::String(negative),
            Value::String(category),
            Value::String(tags.to_string()),
            Value::from(if favorite { 1 } else { 0 }),
            Value::String(now.clone()),
            json!(version),
            Value::String(id.clone()),
        ],
    )?;
    db::execute(
        conn,
        "INSERT INTO prompt_versions (id, prompt_id, body, note, created_at) VALUES (?1,?2,?3,'edit',?4)",
        &[Value::String(uuid::Uuid::new_v4().to_string()), Value::String(id.clone()), Value::String(body), Value::String(now)],
    )?;
    Ok(json!({ "id": id, "version": version }))
}

pub fn list_prompts(conn: &Connection, search: &str) -> AppResult<Vec<Value>> {
    let mut params: Vec<Value> = Vec::new();
    let mut sql = String::from("SELECT id, title, body, negative, category, tags_json, favorite, project_id, created_at, updated_at, version FROM prompts WHERE 1=1");
    if !search.trim().is_empty() {
        sql.push_str(" AND (title LIKE ? OR body LIKE ? OR tags_json LIKE ?)");
        let needle = format!("%{}%", search.trim());
        for _ in 0..3 {
            params.push(Value::String(needle.clone()));
        }
    }
    sql.push_str(" ORDER BY favorite DESC, updated_at DESC LIMIT 300");
    db::query_json(conn, &sql, &params, &["id", "title", "body", "negative", "category", "tags_json", "favorite", "project_id", "created_at", "updated_at", "version"])
}

pub fn prompt_versions(conn: &Connection, prompt_id: &str) -> AppResult<Vec<Value>> {
    db::query_json(
        conn,
        "SELECT id, prompt_id, body, note, created_at FROM prompt_versions WHERE prompt_id=?1 ORDER BY created_at DESC",
        &[Value::String(prompt_id.into())],
        &["id", "prompt_id", "body", "note", "created_at"],
    )
}

// ---------- post processing ----------

pub fn apply_post_process(
    conn: &Connection,
    paths: &AppPaths,
    image_id: &str,
    ops: &TransformOps,
    label: &str,
) -> AppResult<Value> {
    let row = db::query_one(
        conn,
        "SELECT path, project_id, generation_id, prompt, optimized_prompt FROM images WHERE id=?1",
        &[Value::String(image_id.into())],
        &["path", "project_id", "generation_id", "prompt", "optimized_prompt"],
    )?
    .ok_or_else(|| AppError::new("image_not_found", "Image not found"))?;
    let src = PathBuf::from(db::text(row.get("path")));
    if !src.is_file() {
        return Err(AppError::new("file_missing", "The original image file is missing on disk"));
    }
    let project_id = db::text(row.get("project_id"));
    let slug = if project_id.is_empty() {
        "default".to_string()
    } else {
        db::query_one(conn, "SELECT slug FROM projects WHERE id=?1", &[Value::String(project_id.clone())], &["slug"])?
            .map(|v| db::text(v.get("slug")))
            .unwrap_or_else(|| "default".into())
    };
    let dir = paths.project_dir(&slug).join("Edited");
    std::fs::create_dir_all(&dir)?;
    let ext = ops
        .output_format
        .clone()
        .unwrap_or_else(|| src.extension().map(|e| e.to_string_lossy().to_string()).unwrap_or_else(|| "png".into()));
    let stem = format!(
        "{}-{}",
        src.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_else(|| "image".into()),
        sanitize_segment(if label.is_empty() { "edit" } else { label })
    );
    let target = imageops::unique_path(&dir, &stem, &ext);
    let info = imageops::apply_ops(&src, &target, ops)?;
    let id = uuid::Uuid::new_v4().to_string();
    let thumb_dir = paths.project_dir(&slug).join(".thumbs");
    std::fs::create_dir_all(&thumb_dir)?;
    let thumb = thumb_dir.join(format!("{id}.webp"));
    let thumb_str = if imageops::make_thumbnail(&target, &thumb, 360, 82).is_ok() {
        thumb.to_string_lossy().to_string()
    } else {
        String::new()
    };
    let history = json!([{
        "at": db::now(),
        "operation": if label.is_empty() { "post-process" } else { label },
        "source": src.to_string_lossy(),
        "ops": ops,
    }]);
    db::execute(
        conn,
        "INSERT INTO images (id, generation_id, project_id, path, thumb_path, file_name, format, width, height, size_bytes, sha256, created_at, favorite, tags_json, note, prompt, optimized_prompt, engine, model_note, references_json, edit_history_json, parent_image_id)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,0,'[]','',?13,?14,'local-processing','', '[]', ?15, ?16)",
        &[
            Value::String(id.clone()),
            row.get("generation_id").cloned().unwrap_or(Value::String(String::new())),
            Value::String(project_id),
            Value::String(info.path.clone()),
            Value::String(thumb_str.clone()),
            Value::String(info.file_name.clone()),
            Value::String(info.format.clone()),
            json!(info.width),
            json!(info.height),
            json!(info.size_bytes),
            Value::String(info.sha256.clone()),
            Value::String(db::now()),
            row.get("prompt").cloned().unwrap_or(Value::String(String::new())),
            row.get("optimized_prompt").cloned().unwrap_or(Value::String(String::new())),
            Value::String(history.to_string()),
            Value::String(image_id.to_string()),
        ],
    )?;
    Ok(json!({
        "id": id,
        "path": info.path,
        "thumb_path": thumb_str,
        "width": info.width,
        "height": info.height,
        "format": info.format,
        "size_bytes": info.size_bytes,
        "sha256": info.sha256,
    }))
}

pub fn bulk_rename(conn: &Connection, ids: &[String], pattern: &str) -> AppResult<Value> {
    let mut renamed = 0;
    for (index, id) in ids.iter().enumerate() {
        let Some(row) = db::query_one(conn, "SELECT path FROM images WHERE id=?1", &[Value::String(id.clone())], &["path"])? else {
            continue;
        };
        let path = PathBuf::from(db::text(row.get("path")));
        if !path.is_file() {
            continue;
        }
        let ext = path.extension().map(|e| e.to_string_lossy().to_string()).unwrap_or_else(|| "png".into());
        let base = pattern
            .replace("{n}", &format!("{:03}", index + 1))
            .replace("{ext}", &ext);
        let stem = sanitize_segment(&base);
        let Some(parent) = path.parent() else { continue };
        let target = imageops::unique_path(parent, &stem, &ext);
        if std::fs::rename(&path, &target).is_ok() {
            db::execute(
                conn,
                "UPDATE images SET path=?1, file_name=?2 WHERE id=?3",
                &[
                    Value::String(target.to_string_lossy().to_string()),
                    Value::String(target.file_name().map(|f| f.to_string_lossy().to_string()).unwrap_or_default()),
                    Value::String(id.clone()),
                ],
            )?;
            renamed += 1;
        }
    }
    Ok(json!({ "renamed": renamed }))
}
