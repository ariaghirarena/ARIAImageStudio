import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorText, type GalleryQuery } from "@aria/core";
import { useApp } from "../store";

export function useProjects() {
  return useQuery({ queryKey: ["projects"], queryFn: api.projectList });
}

export function useGallery(query: Record<string, unknown>) {
  return useQuery({ queryKey: ["gallery", query], queryFn: () => api.galleryList(query) });
}

export function useQueueState() {
  return useQuery({ queryKey: ["queue-state"], queryFn: api.queueState, refetchInterval: 3000 });
}

export function useJobs(status = "all") {
  return useQuery({ queryKey: ["jobs", status], queryFn: () => api.jobsList(status, 80), refetchInterval: 4000 });
}

export function useProfiles() {
  return useQuery({ queryKey: ["profiles"], queryFn: api.authProfiles });
}

export function usePrompts(search = "") {
  return useQuery({ queryKey: ["prompts", search], queryFn: () => api.promptList(search) });
}

export function useWorkflows() {
  return useQuery({ queryKey: ["workflows"], queryFn: api.workflowList });
}

export function useAnalytics() {
  return useQuery({ queryKey: ["analytics"], queryFn: api.analyticsSummary });
}

export function useTimeseries(days = 14) {
  return useQuery({ queryKey: ["timeseries", days], queryFn: () => api.analyticsTimeseries(days) });
}

export function useRegistrySummary() {
  return useQuery({ queryKey: ["registry-summary"], queryFn: api.registrySummary });
}

export function useModels() {
  return useQuery({ queryKey: ["models"], queryFn: api.codexModels });
}

export function useGenerations() {
  return useQuery({ queryKey: ["generations"], queryFn: () => api.generationsList(80) });
}

export function useReferences(projectId: string) {
  return useQuery({ queryKey: ["references", projectId], queryFn: () => api.referenceList(projectId) });
}

export function useInvalidateAll() {
  const client = useQueryClient();
  return () => client.invalidateQueries();
}

export function useAction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options?: { success?: string | ((result: TResult) => string); onDone?: (result: TResult) => void; invalidate?: boolean },
) {
  const toast = useApp((state) => state.toast);
  const client = useQueryClient();
  return useMutation({
    mutationFn: (args: TArgs) => fn(...args),
    onSuccess: (result) => {
      if (options?.invalidate !== false) void client.invalidateQueries();
      if (options?.success) {
        toast(typeof options.success === "function" ? options.success(result) : options.success, "ok");
      }
      options?.onDone?.(result);
    },
    onError: (error) => {
      toast(errorText(error), "err");
    },
  });
}

export function useHandoff() {
  const handoff = useApp((state) => state.handoff);
  const setHandoff = useApp((state) => state.setHandoff);
  return { handoff, setHandoff };
}

export type { GalleryQuery };
