import { useCallback, useEffect, useState } from "react";
import type { VercelStore } from "@studio/lib/bindings";
import { formatBackendError } from "@studio/shared/utils/backend-error";
import { listVercelStores } from "./vercel-api";

export function useVercelStores(enabled: boolean) {
  const [stores, setStores] = useState<VercelStore[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async function refresh() {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);
    try {
      setStores(await listVercelStores());
    } catch (error) {
      setError(formatBackendError(error));
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(function loadStores() {
    void refresh();
  }, [refresh]);

  const reset = useCallback(function reset() {
    setStores([]);
    setError(null);
  }, []);

  return { stores, isLoading, error, refresh, reset };
}
