import { useCallback, useEffect, useState } from "react";
import type { PlanetscaleDatabase } from "@studio/lib/bindings";
import { formatBackendError } from "@studio/shared/utils/backend-error";
import { listPlanetscaleDatabases } from "./planetscale-api";

// Lists the databases for the given organization. Disabled (and reset) until both
// a connection exists and an organization is chosen.
export function usePlanetscaleDatabases(enabled: boolean, organization: string | null) {
  const [databases, setDatabases] = useState<PlanetscaleDatabase[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async function refresh() {
    if (!enabled || !organization) return;
    setIsLoading(true);
    setError(null);
    try {
      setDatabases(await listPlanetscaleDatabases(organization));
    } catch (error) {
      setError(formatBackendError(error));
    } finally {
      setIsLoading(false);
    }
  }, [enabled, organization]);

  useEffect(function loadDatabases() {
    void refresh();
  }, [refresh]);

  const reset = useCallback(function reset() {
    setDatabases([]);
    setError(null);
  }, []);

  return { databases, isLoading, error, refresh, reset };
}
