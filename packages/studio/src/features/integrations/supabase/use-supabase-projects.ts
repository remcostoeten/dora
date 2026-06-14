import { useCallback, useEffect, useState } from "react";
import type { SupabaseProject } from "@studio/lib/bindings";
import { listSupabaseProjects } from "./supabase-api";

export function useSupabaseProjects(enabled: boolean) {
  const [projects, setProjects] = useState<SupabaseProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async function refresh() {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);
    try {
      setProjects(await listSupabaseProjects());
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(function loadProjects() {
    void refresh();
  }, [refresh]);

  const reset = useCallback(function reset() {
    setProjects([]);
    setError(null);
  }, []);

  return { projects, isLoading, error, refresh, reset };
}
