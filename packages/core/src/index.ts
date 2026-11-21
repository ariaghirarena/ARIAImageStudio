import { ERROR_MESSAGES_FA } from "./locale";
export { faLabel } from "./locale";
/**
 * @aria/core — typed bridge to the ARIA Image Studio Tauri backend.
 * Every call maps 1:1 to a registered Rust command; there is no mock data layer.
 */
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface AppError {
  code: string;
  message: string;
  hint?: string | null;
}

export interface ToastItem {
  id: string;
  text: string;
  tone: "info" | "ok" | "err" | "warn";
}

export interface Settings {
  language: string;
  theme: string;
  locale_direction: string;
  output_root: string;
  active_project_id: string;
  active_profile_id: string;
  preview_quality: number;
  thumbnail_size: number;
  cache_limit_mb: number;
  history_limit: number;
  autosave: boolean;
  notifications: boolean;
  prompt_enhance_default: boolean;
  generation_timeout_secs: number;
  max_concurrent_jobs: number;
  codex_path: string;
  codex_model: string;
  reasoning_effort: string;
  verbosity: string;
  approval_policy: string;
  sandbox_mode: string;
  network_access: boolean;
  working_dir: string;
  quality_preset: string;
  auto_post_process: boolean;
  keep_original: boolean;
  confirm_destructive: boolean;
  onboarded: boolean;
  store_credentials_in_keyring: boolean;
  enable_gif: boolean;
}

export interface CodexInfo {
  found: boolean;
  path: string;
  version: string;
  source: string;
  auth_present: boolean;
  skill_present: boolean;
  codex_home: string;
}

export interface Profile {
  id: string;
  name: string;
  auth_mode: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_checked: string;
  last_error?: string;
}

export interface Bootstrap {
  version: string;
  paths: Record<string, string>;
  settings: Settings;
  codex: CodexInfo;
  counts: { projects: number; images: number; prompts: number; pending_jobs: number; features: number };
  profiles: Profile[];
  platform: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  created_at: string;
  updated_at: string;
  archived: boolean;
  output_dir: string;
  dir?: string;
  image_count: number;
  job_count: number;
}

export interface ImageRecord {
  id: string;
  generation_id: string;
  project_id: string;
  path: string;
  thumb_path: string;
  file_name: string;
  format: string;
  width: number;
  height: number;
  size_bytes: number;
  sha256: string;
  created_at: string;
  favorite: boolean;
  tags_json: string;
  note: string;
  prompt: string;
  optimized_prompt: string;
  model_note: string;
  parent_image_id: string;
}

export interface GalleryQuery {
  project_id?: string;
  search?: string;
  format?: string;
  favorite_only?: boolean;
  tag?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}

export interface Job {
  id: string;
  project_id: string;
  kind: string;
  status: string;
  priority: number;
  prompt: string;
  error: string;
  attempts: number;
  max_attempts: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  result_json: string;
}

export interface Generation {
  id: string;
  job_id: string;
  project_id: string;
  prompt_original: string;
  prompt_final: string;
  status: string;
  engine: string;
  model_note: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number;
  error: string;
  result_count: number;
}

export interface Prompt {
  id: string;
  title: string;
  body: string;
  negative: string;
  category: string;
  tags_json: string;
  favorite: boolean;
  project_id: string;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface ReferenceAsset {
  id: string;
  project_id: string;
  path: string;
  role: string;
  thumb_path: string;
  width: number;
  height: number;
  created_at: string;
  note: string;
}

export interface Workflow {
  id: string;
  name: string;
  steps_json: string;
  created_at: string;
  updated_at: string;
  last_run_at: string;
  last_status: string;
}

export interface GenerationRequest {
  job_id?: string;
  generation_id?: string;
  project_id?: string;
  profile_id?: string;
  prompt_original: string;
  prompt_final: string;
  negative?: string;
  aspect?: string;
  style_notes?: string;
  count?: number;
  reference_images?: string[];
  output_dir?: string;
  model?: string;
  reasoning_effort?: string;
  verbosity?: string;
  sandbox_mode?: string;
  timeout_secs?: number;
  quality_preset?: string;
}

export interface GenerationOutcome {
  generation_id: string;
  status: string;
  images: ImageRecord[];
  last_message: string;
  log: string[];
  duration_ms: number;
  codex_exit: number | null;
  error: string;
}

export interface DiagnosticsCheck {
  id: string;
  label: string;
  status: "ok" | "warn" | "error" | "unknown";
  detail: string;
  hint: string;
}

export interface DiagnosticsReport {
  overall: "ok" | "warn" | "error";
  errors: number;
  warnings: number;
  checks: DiagnosticsCheck[];
  generated_at: string;
  app_version: string;
  platform: string;
  arch: string;
}

export interface PickerEntry {
  name: string;
  path: string;
  is_dir: boolean;
  is_image: boolean;
  is_json: boolean;
  size: number;
  modified: string;
}

export interface PickerListing {
  path: string;
  parent: string;
  dirs: PickerEntry[];
  files: PickerEntry[];
  count: number;
}

export interface AnalyticsSummary {
  images: number;
  disk_bytes: number;
  generations: number;
  generations_succeeded: number;
  generations_failed: number;
  avg_duration_ms: number;
  jobs: number;
  jobs_failed: number;
  prompts: number;
  projects: number;
  favorites: number;
  features_registered: number;
  features_implemented: number;
  success_rate: number;
}

export interface TransformOps {
  resize_width?: number | null;
  resize_height?: number | null;
  scale?: number | null;
  brightness?: number | null;
  contrast?: number | null;
  saturation?: number | null;
  sharpen_sigma?: number | null;
  sharpen_threshold?: number | null;
  denoise?: boolean;
  white_balance?: [number, number, number] | null;
  grayscale?: boolean;
  flip_horizontal?: boolean;
  flip_vertical?: boolean;
  rotate_degrees?: number | null;
  remove_background?: number | null;
  output_format?: string | null;
  quality?: number | null;
}

export function isDesktopRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function toAppError(error: unknown): AppError {
  if (error && typeof error === "object" && "message" in (error as Record<string, unknown>)) {
    const candidate = error as Partial<AppError>;
    return {
      code: candidate.code ?? "error",
      message: String(candidate.message),
      hint: candidate.hint ?? null,
    };
  }
  if (typeof error === "string") {
    return { code: "error", message: error, hint: null };
  }
  return { code: "unknown", message: "خطای پیش‌بینی‌نشده؛ گزارش عیب‌یابی را بررسی کنید", hint: null };
}

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isDesktopRuntime()) {
    throw {
      code: "no_desktop_runtime",
      message: "این کار فقط در نسخه نصب‌شده برنامه قابل انجام است",
      hint: "نسخه ویندوز را باز کنید؛ مرورگر به فایل‌ها و موتور دسکتاپ دسترسی ندارد",
    } satisfies AppError;
  }
  return invoke<T>(command, args);
}

export const api = {
  bootstrap: () => call<Bootstrap>("app_bootstrap"),
  settingsGet: () => call<Settings>("settings_get"),
  settingsSave: (settings: Settings) => call<Settings>("settings_save", { settings }),
  openPath: (path: string) => call<void>("open_path", { path }),
  openUrl: (url: string) => call<void>("open_url", { url }),

  pickerRoots: () => call<{ roots: { name: string; path: string }[]; shortcuts: { name: string; path: string }[] }>("picker_roots"),
  pickerList: (path: string) => call<PickerListing>("picker_list", { path }),
  pickerEnsureDir: (path: string) => call<string>("picker_ensure_dir", { path }),

  authProfiles: () => call<Profile[]>("auth_profiles"),
  authImport: (sourcePath: string, name: string) => call<Record<string, string>>("auth_import", { sourcePath, name }),
  authReplace: (profileId: string, sourcePath: string) => call<Record<string, string>>("auth_replace", { profileId, sourcePath }),
  authStatus: (profileId: string) =>
    call<{ authenticated: boolean; auth_mode: string; detail: string; checked_at: string; has_credentials: boolean }>("auth_status", { profileId }),
  authRestoreVault: (profileId: string) => call<{ restored: boolean; path: string }>("auth_restore_vault", { profileId }),
  authDelete: (profileId: string, purge: boolean) => call<void>("auth_delete", { profileId, purge }),
  authSetActive: (profileId: string) => call<void>("auth_set_active", { profileId }),
  authLoginStart: (profileId: string, device: boolean) => call<{ started: boolean }>("auth_login_start", { profileId, device }),
  authLogout: (profileId: string) => call<{ logged_out: boolean }>("auth_logout", { profileId }),

  codexInfo: () => call<CodexInfo>("codex_info"),
  codexInstallSkill: () => call<{ path: string }>("codex_install_skill"),
  codexModels: () => call<{ models: { id: string; label: string; source: string }[]; source: string; detail: string }>("codex_models"),
  codexConfigRead: () => call<{ path: string; content: string; exists: boolean }>("codex_config_read"),
  codexConfigWrite: (content: string) => call<{ path: string; written: boolean }>("codex_config_write", { content }),
  codexComplete: (prompt: string) => call<{ text: string }>("codex_complete", { prompt }),
  codexHealth: () =>
    call<{
      codex: CodexInfo;
      login: { authenticated: boolean; mode: string; detail: string; checked_at: string } | null;
      recent_failures: number;
      healthy: boolean;
    }>("codex_health"),

  generateNow: (request: GenerationRequest) => call<GenerationOutcome>("generate_now", { request }),
  generateQueue: (request: GenerationRequest) => call<{ job_id: string; generation_id: string }>("generate_queue", { request }),
  jobsList: (status: string, limit = 60) => call<Job[]>("jobs_list", { status, limit }),
  jobEvents: (jobId: string) => call<{ id: number; ts: string; level: string; message: string }[]>("job_events", { jobId }),
  jobCancel: (jobId: string) => call<void>("job_cancel", { jobId }),
  jobRetry: (jobId: string) => call<void>("job_retry", { jobId }),
  queuePause: (paused: boolean) => call<{ paused: boolean }>("queue_pause", { paused }),
  queueState: () => call<{ paused: boolean; queued: number; running: number; failed: number }>("queue_state"),
  generationsList: (limit = 60) => call<Generation[]>("generations_list", { limit }),

  galleryList: (query: GalleryQuery) =>
    call<{ items: ImageRecord[]; total: number; limit: number; offset: number }>("gallery_list", { query }),
  imageDetail: (id: string) => call<ImageRecord>("image_detail", { id }),
  imageImport: (sourcePath: string, projectId: string) => call<ImageRecord>("image_import", { sourcePath, projectId }),
  imageFavorite: (id: string, favorite: boolean) => call<void>("image_favorite", { id, favorite }),
  imageTags: (id: string, tags: string[]) => call<void>("image_tags", { id, tags }),
  imageNote: (id: string, note: string) => call<void>("image_note", { id, note }),
  imageDelete: (id: string, deleteFile: boolean) => call<void>("image_delete", { id, deleteFile }),
  imagesDuplicates: () => call<{ groups: { sha256: string; copies: number; paths: string }[] }>("images_duplicates"),
  imageCompare: (a: string, b: string) =>
    call<{
      width_a: number;
      height_a: number;
      width_b: number;
      height_b: number;
      same_dimensions: boolean;
      mean_absolute_difference: number;
      identical: boolean;
    }>("image_compare", { a, b }),
  imageProbe: (path: string) =>
    call<{ path: string; width: number; height: number; format: string; size_bytes: number; has_alpha: boolean; sha256: string }>("image_probe", { path }),
  postProcess: (imageId: string, ops: TransformOps, label: string) => call<Record<string, unknown>>("post_process", { imageId, ops, label }),
  bulkRename: (ids: string[], pattern: string) => call<{ renamed: number }>("bulk_rename", { ids, pattern }),

  projectCreate: (name: string, description: string) => call<{ id: string; slug: string; dir: string }>("project_create", { name, description }),
  projectList: () => call<Project[]>("project_list"),
  projectUpdate: (id: string, name: string, description: string, outputDir: string) => call<void>("project_update", { id, name, description, outputDir }),
  projectArchive: (id: string, archived: boolean) => call<void>("project_archive", { id, archived }),
  projectBackup: (id: string) => call<{ backup_dir: string; files: number }>("project_backup", { id }),
  projectRestore: (backupDir: string) => call<{ restored_into: string; files: number }>("project_restore", { backupDir }),

  promptSave: (prompt: Record<string, unknown>) => call<{ id: string; version?: number }>("prompt_save", { prompt }),
  promptList: (search = "") => call<Prompt[]>("prompt_list", { search }),
  promptDelete: (id: string) => call<void>("prompt_delete", { id }),
  promptVersions: (promptId: string) => call<{ id: string; body: string; note: string; created_at: string }[]>("prompt_versions", { promptId }),
  promptsExport: (path: string) => call<{ path: string; count: number }>("prompts_export", { path }),
  promptsImport: (path: string) => call<{ imported: number }>("prompts_import", { path }),

  referenceAdd: (path: string, projectId: string, role: string) => call<Record<string, unknown>>("reference_add", { path, projectId, role }),
  referenceList: (projectId: string) => call<ReferenceAsset[]>("reference_list", { projectId }),
  referenceDelete: (id: string) => call<void>("reference_delete", { id }),

  workflowList: () => call<Workflow[]>("workflow_list"),
  workflowSave: (workflow: { id?: string; name: string; steps: unknown[] }) => call<{ id: string }>("workflow_save", { workflow }),
  workflowDelete: (id: string) => call<void>("workflow_delete", { id }),
  workflowRun: (workflowId: string) =>
    call<{ run_id: string; status: string; log: string[]; images: number; last_image_id: string | null }>("workflow_run", { workflowId }),

  registrySync: (features: unknown[]) => call<{ synced: number }>("registry_sync", { features }),
  registryList: () => call<Record<string, string>[]>("registry_list"),
  registrySummary: () =>
    call<{ total: number; by_status: { status: string; count: number | string }[]; by_category: { category: string; count: number | string; done: number | string }[] }>(
      "registry_summary",
    ),
  registryExport: () => call<{ path: string }>("registry_export"),

  analyticsSummary: () => call<AnalyticsSummary>("analytics_summary"),
  analyticsTimeseries: (days = 14) => call<{ images: { day: string; images: number }[]; jobs: Record<string, unknown>[] }>("analytics_timeseries", { days }),
  analyticsExport: () => call<{ path: string }>("analytics_export"),

  diagnosticsRun: () => call<DiagnosticsReport>("diagnostics_run"),
  diagnosticsExport: () => call<{ dir: string; json: string; markdown: string }>("diagnostics_export"),
  updatesCheck: () =>
    call<{
      status: string;
      current: string;
      latest?: string;
      available?: boolean;
      release_url?: string;
      detail?: string;
      assets?: { name: string; url: string; size: number }[];
      auto_install?: boolean;
    }>("updates_check"),
  storageUsage: () => call<{ files: number; bytes: number; root: string }>("storage_usage"),
};

export function onEvent<T>(name: string, handler: (payload: T) => void): Promise<UnlistenFn> {
  if (!isDesktopRuntime()) {
    return Promise.resolve(() => undefined);
  }
  return listen<T>(name, (event) => handler(event.payload));
}

// ---------------------------------------------------------------- formatting

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "۰ بایت";
  const units = ["بایت", "کیلوبایت", "مگابایت", "گیگابایت", "ترابایت"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value >= 100 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  if (ms < 1000) return `${Math.round(ms)} میلی‌ثانیه`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} ثانیه`;
  return `${Math.floor(ms / 60_000)} دقیقه و ${Math.round((ms % 60_000) / 1000)} ثانیه`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" });
}

export function toFileUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("data:") || path.startsWith("http") || path.startsWith("asset:")) return path;
  if (isDesktopRuntime()) {
    try {
      return convertFileSrc(path);
    } catch {
      return "";
    }
  }
  const normalized = path.replace(/\\/g, "/");
  return `file:///${normalized.replace(/^\//, "")}`;
}

export function parseTags(raw: string | undefined | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

export function errorText(error: unknown): string {
  const appError = toAppError(error);
  if (ERROR_MESSAGES_FA[appError.code]) return ERROR_MESSAGES_FA[appError.code];
  return appError.hint ? `${appError.message} — ${appError.hint}` : appError.message;
}
