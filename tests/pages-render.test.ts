import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

// TSX modules use the app's automatic JSX runtime in production; Vitest's
// root transform may use the classic runtime when loading workspace sources.
vi.stubGlobal("React", React);
const pages: Record<string, string> = {
  Welcome: "WelcomePage", Authentication: "AuthPage", Dashboard: "DashboardPage",
  CreateImage: "CreatePage", EditImage: "EditPage", Variations: "VariationsPage",
  Gallery: "GalleryPage", PromptStudio: "PromptStudioPage", PromptLibrary: "PromptLibraryPage",
  BatchStudio: "BatchPage", WorkflowBuilder: "WorkflowPage", ProjectManager: "ProjectsPage",
  AIEngine: "EnginePage", ModelSettings: "ModelsPage", CodexSettings: "CodexSettingsPage",
  AccountManager: "AccountsPage", History: "HistoryPage", Analytics: "AnalyticsPage",
  Preferences: "PreferencesPage", Diagnostics: "DiagnosticsPage",
};

describe("page render smoke tests without account or desktop IPC", () => {
  for (const [file, exported] of Object.entries(pages)) {
    it(`renders ${file} with Persian interface text`, async () => {
      const module = await import(`../apps/desktop/src/pages/${file}.tsx`);
      const client = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
      try {
        const markup = renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, React.createElement(module[exported])));
        expect(markup).toMatch(/[\u0600-\u06ff]/);
        if (file === "CreateImage") {
          expect(markup).toContain("چه تصویری می‌خواهید بسازید؟");
          expect(markup).toContain("prompt-settings\" hidden");
        }
      } finally { client.clear(); }
    });
  }
});
