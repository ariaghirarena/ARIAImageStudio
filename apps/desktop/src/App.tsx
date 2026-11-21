import { useEffect } from "react";
import { Toasts, useHotkeys } from "@aria/ui";
import { useApp } from "./store";
import { CommandPalette, HelpDrawer, LoadingScreen, NAV, RuntimeGate, Sidebar, Topbar } from "./components/shell";
import { WelcomePage } from "./pages/Welcome";
import { AuthPage } from "./pages/Authentication";
import { DashboardPage } from "./pages/Dashboard";
import { CreatePage } from "./pages/CreateImage";
import { EditPage } from "./pages/EditImage";
import { VariationsPage } from "./pages/Variations";
import { GalleryPage } from "./pages/Gallery";
import { PromptStudioPage } from "./pages/PromptStudio";
import { PromptLibraryPage } from "./pages/PromptLibrary";
import { BatchPage } from "./pages/BatchStudio";
import { WorkflowPage } from "./pages/WorkflowBuilder";
import { ProjectsPage } from "./pages/ProjectManager";
import { EnginePage } from "./pages/AIEngine";
import { ModelsPage } from "./pages/ModelSettings";
import { CodexSettingsPage } from "./pages/CodexSettings";
import { AccountsPage } from "./pages/AccountManager";
import { HistoryPage } from "./pages/History";
import { AnalyticsPage } from "./pages/Analytics";
import { PreferencesPage } from "./pages/Preferences";
import { DiagnosticsPage } from "./pages/Diagnostics";

const PAGES = {
  welcome: WelcomePage,
  auth: AuthPage,
  dashboard: DashboardPage,
  create: CreatePage,
  edit: EditPage,
  variations: VariationsPage,
  gallery: GalleryPage,
  "prompt-studio": PromptStudioPage,
  "prompt-library": PromptLibraryPage,
  batch: BatchPage,
  workflows: WorkflowPage,
  projects: ProjectsPage,
  engine: EnginePage,
  models: ModelsPage,
  codex: CodexSettingsPage,
  accounts: AccountsPage,
  history: HistoryPage,
  analytics: AnalyticsPage,
  preferences: PreferencesPage,
  diagnostics: DiagnosticsPage,
} as const;

export function App() {
  const init = useApp((state) => state.init);
  const booting = useApp((state) => state.booting);
  const route = useApp((state) => state.route);
  const toasts = useApp((state) => state.toasts);
  const dismiss = useApp((state) => state.dismiss);
  const settings = useApp((state) => state.settings);
  const bootError = useApp((state) => state.bootError);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.lang = settings.language;
    document.documentElement.dir = settings.locale_direction;
  }, [settings.theme, settings.language, settings.locale_direction]);

  const fastRoutes = NAV.flatMap((group) => group.items.map((item) => item.route)).slice(0, 5);

  useHotkeys({
    "mod+k": () => useApp.getState().setPalette(true),
    "mod+1": () => useApp.getState().setRoute(fastRoutes[0] ?? "dashboard"),
    "mod+2": () => useApp.getState().setRoute(fastRoutes[1] ?? "create"),
    "mod+3": () => useApp.getState().setRoute(fastRoutes[2] ?? "gallery"),
    "mod+4": () => useApp.getState().setRoute(fastRoutes[3] ?? "engine"),
    "mod+5": () => useApp.getState().setRoute(fastRoutes[4] ?? "preferences"),
    "shift+?": () => useApp.getState().setHelp(true),
  });

  if (booting) return <LoadingScreen label="در حال آماده‌سازی استودیو آریا…" />;

  if (bootError) {
    return (
      <>
        <RuntimeGate>{null}</RuntimeGate>
        <Toasts items={toasts} onDismiss={dismiss} />
      </>
    );
  }

  const Page = PAGES[route] ?? DashboardPage;
  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <Topbar />
        <div className="main-scroll">
          <div hidden={route !== "create"}><CreatePage /></div>
          {route !== "create" ? <Page /> : null}
        </div>
      </div>
      <CommandPalette />
      <HelpDrawer />
      <Toasts items={toasts} onDismiss={dismiss} />
    </div>
  );
}
