import { create } from "zustand";
import { api, errorText, isDesktopRuntime, type Bootstrap, type Settings, type ToastItem } from "@aria/core";

export type Route =
  | "welcome" | "auth" | "dashboard" | "create" | "edit" | "variations" | "gallery"
  | "prompt-studio" | "prompt-library" | "batch" | "workflows" | "projects"
  | "engine" | "models" | "codex" | "accounts" | "history" | "analytics"
  | "preferences" | "diagnostics";

export interface Handoff {
  imageId?: string;
  imagePath?: string;
  prompt?: string;
  negative?: string;
  presetId?: string;
  aspect?: string;
}

interface AppStore {
  boot: Bootstrap | null;
  settings: Settings;
  route: Route;
  booting: boolean;
  bootError: string;
  paletteOpen: boolean;
  helpOpen: boolean;
  toasts: ToastItem[];
  handoff: Handoff;
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  setRoute: (route: Route) => void;
  saveSettings: (patch: Partial<Settings>) => Promise<void>;
  toast: (text: string, tone?: ToastItem["tone"]) => void;
  dismiss: (id: string) => void;
  setPalette: (open: boolean) => void;
  setHelp: (open: boolean) => void;
  setHandoff: (handoff: Handoff) => void;
}

const fallbackSettings: Settings = {
  language: "fa",
  theme: "obsidian",
  locale_direction: "rtl",
  output_root: "",
  active_project_id: "",
  active_profile_id: "",
  preview_quality: 82,
  thumbnail_size: 360,
  cache_limit_mb: 512,
  history_limit: 2000,
  autosave: true,
  notifications: true,
  prompt_enhance_default: true,
  generation_timeout_secs: 900,
  max_concurrent_jobs: 1,
  codex_path: "",
  codex_model: "",
  reasoning_effort: "",
  verbosity: "",
  approval_policy: "on-request",
  sandbox_mode: "workspace-write",
  network_access: false,
  working_dir: "",
  quality_preset: "aria-best-quality",
  auto_post_process: false,
  keep_original: true,
  confirm_destructive: true,
  onboarded: false,
  store_credentials_in_keyring: false,
  enable_gif: false,
};

export const useApp = create<AppStore>((set, get) => ({
  boot: null,
  settings: fallbackSettings,
  route: "welcome",
  booting: true,
  bootError: "",
  paletteOpen: false,
  helpOpen: false,
  toasts: [],
  handoff: {},

  init: async () => {
    set({ booting: true, bootError: "" });
    if (!isDesktopRuntime()) {
      set({ booting: false, bootError: "no_desktop_runtime" });
      return;
    }
    try {
      const boot = await api.bootstrap();
      set({
        boot,
        settings: boot.settings,
        booting: false,
        route: boot.settings.onboarded ? "dashboard" : "welcome",
      });
      document.documentElement.dataset.theme = boot.settings.theme;
      document.documentElement.lang = boot.settings.language;
      document.documentElement.dir = boot.settings.locale_direction;
      if (boot.counts.features === 0) {
        const { FEATURES } = await import("@aria/feature-registry");
        void api.registrySync(FEATURES).catch(() => undefined);
      }
    } catch (error) {
      set({ booting: false, bootError: errorText(error) });
    }
  },

  refresh: async () => {
    if (!isDesktopRuntime()) return;
    try {
      const boot = await api.bootstrap();
      set({ boot, settings: boot.settings });
    } catch {
      /* keep the last known good snapshot */
    }
  },

  setRoute: (route) => set({ route }),
  saveSettings: async (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    document.documentElement.dataset.theme = next.theme;
    document.documentElement.lang = next.language;
    document.documentElement.dir = next.locale_direction;
    try {
      const saved = await api.settingsSave(next);
      set({ settings: saved });
    } catch (error) {
      get().toast(errorText(error), "err");
    }
  },
  toast: (text, tone = "info") => {
    const id = Math.random().toString(36).slice(2);
    set({ toasts: [...get().toasts, { id, text, tone }] });
    window.setTimeout(() => get().dismiss(id), tone === "err" ? 9000 : 4200);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((toast) => toast.id !== id) }),
  setPalette: (open) => set({ paletteOpen: open }),
  setHelp: (open) => set({ helpOpen: open }),
  setHandoff: (handoff) => set({ handoff }),
}));
