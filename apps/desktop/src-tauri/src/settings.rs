use crate::error::AppResult;
use crate::paths::AppPaths;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    pub language: String,
    pub theme: String,
    pub locale_direction: String,
    pub output_root: String,
    pub active_project_id: String,
    pub active_profile_id: String,
    pub preview_quality: u32,
    pub thumbnail_size: u32,
    pub cache_limit_mb: u32,
    pub history_limit: u32,
    pub autosave: bool,
    pub notifications: bool,
    pub prompt_enhance_default: bool,
    pub generation_timeout_secs: u64,
    pub max_concurrent_jobs: u32,
    pub codex_path: String,
    pub codex_model: String,
    pub reasoning_effort: String,
    pub verbosity: String,
    pub approval_policy: String,
    pub sandbox_mode: String,
    pub network_access: bool,
    pub working_dir: String,
    pub quality_preset: String,
    pub auto_post_process: bool,
    pub keep_original: bool,
    pub confirm_destructive: bool,
    pub onboarded: bool,
    pub store_credentials_in_keyring: bool,
    pub enable_gif: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            language: "fa".into(),
            theme: "light".into(),
            locale_direction: "rtl".into(),
            output_root: String::new(),
            active_project_id: String::new(),
            active_profile_id: String::new(),
            preview_quality: 82,
            thumbnail_size: 360,
            cache_limit_mb: 512,
            history_limit: 2000,
            autosave: true,
            notifications: true,
            prompt_enhance_default: true,
            generation_timeout_secs: 900,
            max_concurrent_jobs: 1,
            codex_path: String::new(),
            codex_model: String::new(),
            reasoning_effort: String::new(),
            verbosity: String::new(),
            approval_policy: "on-request".into(),
            sandbox_mode: "workspace-write".into(),
            network_access: false,
            working_dir: String::new(),
            quality_preset: "aria-best-quality".into(),
            auto_post_process: false,
            keep_original: true,
            confirm_destructive: true,
            onboarded: false,
            store_credentials_in_keyring: false,
            enable_gif: false,
        }
    }
}

impl Settings {
    pub fn load(paths: &AppPaths) -> Self {
        let mut settings: Self = std::fs::read_to_string(&paths.settings_file)
            .ok()
            .and_then(|raw| serde_json::from_str::<Settings>(&raw).ok())
            .unwrap_or_default();
        settings.theme = "light".into();
        settings.language = "fa".into();
        settings.locale_direction = "rtl".into();
        settings
    }

    pub fn save(&self, paths: &AppPaths) -> AppResult<()> {
        let raw = serde_json::to_string_pretty(self)?;
        let tmp: PathBuf = paths.settings_file.with_extension("json.tmp");
        std::fs::write(&tmp, raw)?;
        std::fs::rename(&tmp, &paths.settings_file)?;
        Ok(())
    }
}
