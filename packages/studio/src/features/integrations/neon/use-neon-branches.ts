import { useEffect, useState } from "react";
import type { NeonBranch } from "@studio/lib/bindings";
import { formatBackendError } from "@studio/shared/utils/backend-error";
import { listNeonBranches } from "./neon-api";

// Fetches the branches of a single Neon project, re-fetching whenever the
// selected project changes. Passing `null` (no project selected) clears the
// list without hitting the API, so the picker only loads work it needs.
export function useNeonBranches(projectId: string | null) {
  const [branches, setBranches] = useState<NeonBranch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    function loadBranches() {
      if (!projectId) {
        setBranches([]);
        setError(null);
        setIsLoading(false);
        return;
      }
      let cancelled = false;
      setIsLoading(true);
      setError(null);
      void listNeonBranches(projectId)
        .then(function (resolved) {
          if (!cancelled) setBranches(resolved);
        })
        .catch(function (caught) {
          if (!cancelled) {
            setBranches([]);
            setError(formatBackendError(caught));
          }
        })
        .finally(function () {
          if (!cancelled) setIsLoading(false);
        });
      return function () {
        cancelled = true;
      };
    },
    [projectId],
  );

  return { branches, isLoading, error };
}
