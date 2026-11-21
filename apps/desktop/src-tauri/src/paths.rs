use crate::error::{AppError, AppResult};
use std::path::{Path, PathBuf};

/// Every directory the app owns lives under a single root.
#[derive(Clone, Debug)]
pub struct AppPaths {
    pub root: PathBuf,
    pub codex_root: PathBuf,
    pub profiles: PathBuf,
    pub projects: PathBuf,
    pub gallery: PathBuf,
    pub backups: PathBuf,
    pub logs: PathBuf,
    pub exports: PathBuf,
    pub db: PathBuf,
    pub settings_file: PathBuf,
}

impl AppPaths {
    pub fn resolve() -> AppResult<Self> {
        let base = dirs::data_local_dir()
            .or_else(dirs::home_dir)
            .ok_or_else(|| AppError::new("no_data_dir", "Could not resolve the local application data directory"))?;
        let root = base.join("ARIA").join("ImageStudio");
        Ok(Self::from_root(root))
    }

    pub fn from_root(root: PathBuf) -> Self {
        Self {
            codex_root: root.join("codex"),
            profiles: root.join("profiles"),
            projects: root.join("Projects"),
            gallery: root.join("Gallery"),
            backups: root.join("Backups"),
            logs: root.join("logs"),
            exports: root.join("Exports"),
            db: root.join("Database").join("aria.db"),
            settings_file: root.join("settings.json"),
            root,
        }
    }

    pub fn ensure(&self) -> AppResult<()> {
        for dir in [
            &self.root,
            &self.codex_root,
            &self.profiles,
            &self.projects,
            &self.gallery,
            &self.backups,
            &self.logs,
            &self.exports,
        ] {
            std::fs::create_dir_all(dir)?;
        }
        if let Some(parent) = self.db.parent() {
            std::fs::create_dir_all(parent)?;
        }
        Ok(())
    }

    /// CODEX_HOME used when no account profile is active.
    pub fn default_codex_home(&self) -> PathBuf {
        self.codex_root.clone()
    }

    pub fn profile_codex_home(&self, profile_id: &str) -> PathBuf {
        self.profiles.join(sanitize_segment(profile_id)).join("codex")
    }

    pub fn project_dir(&self, slug: &str) -> PathBuf {
        self.projects.join(sanitize_segment(slug))
    }
}

/// Keep filesystem segments safe: no traversal, no reserved characters.
pub fn sanitize_segment(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    for ch in raw.chars() {
        if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
            out.push(ch);
        } else if ch == ' ' || ch == '.' {
            out.push('-');
        }
    }
    let trimmed = out.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "item".to_string()
    } else {
        trimmed.chars().take(64).collect()
    }
}

pub fn file_name_of(path: &Path) -> String {
    path.file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".to_string())
}
