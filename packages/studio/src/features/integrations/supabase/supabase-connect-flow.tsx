import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Loader2, LogOut, PlugZap, Search } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import type { SupabaseProject } from "@studio/lib/bindings";
import { Button } from "@studio/shared/ui/button";
import { Input } from "@studio/shared/ui/input";
import { Label } from "@studio/shared/ui/label";
import { toast } from "@studio/shared/ui/notifier";
import { cn } from "@studio/shared/utils/cn";
import type { Connection } from "../../connections/types";
import {
  buildSupabaseConnectionUrl,
  disconnectSupabase,
  isSupabaseConnected,
  saveSupabaseToken,
  type SupabaseConnectionMode,
} from "./supabase-api";
import { useSupabaseProjects } from "./use-supabase-projects";

type Props = {
  onComplete: (connection: Omit<Connection, "id" | "createdAt">) => void;
};

const TOKENS_URL = "https://supabase.com/dashboard/account/tokens";

const MODES: Array<{
  id: SupabaseConnectionMode;
  label: string;
  hint: string;
}> = [
  { id: "session", label: "Session pooler", hint: "Recommended" },
  { id: "direct", label: "Direct", hint: "Persistent" },
  { id: "transaction", label: "Transaction", hint: "High concurrency" },
];

export function SupabaseConnectFlow({ onComplete }: Props) {
  const [isConnected, setIsConnected] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState<SupabaseProject | null>(null);
  const [mode, setMode] = useState<SupabaseConnectionMode>("session");
  const [password, setPassword] = useState("");
  const { projects, isLoading, error, refresh, reset } = useSupabaseProjects(isConnected);

  // Hydrate from any token stored in a previous session so a returning user
  // lands straight on the project picker instead of re-entering a token.
  useEffect(function hydrateConnectionState() {
    let cancelled = false;
    void isSupabaseConnected().then(function (connected) {
      if (!cancelled) setIsConnected(connected);
    });
    return function () {
      cancelled = true;
    };
  }, []);

  const filteredProjects = useMemo(function filterProjects() {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return projects;
    return projects.filter(function (project) {
      return (
        project.name.toLowerCase().includes(normalizedQuery) ||
        project.id.toLowerCase().includes(normalizedQuery) ||
        project.region.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [projects, query]);

  async function handleConnect() {
    const token = tokenInput.trim();
    if (!token) return;
    setIsAuthorizing(true);
    setAuthError(null);
    try {
      await saveSupabaseToken(token);
      setTokenInput("");
      setIsConnected(true);
      await refresh();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsAuthorizing(false);
    }
  }

  async function handleDisconnect() {
    try {
      await disconnectSupabase();
      setIsConnected(false);
      setSelectedProject(null);
      setQuery("");
      setPassword("");
      setTokenInput("");
      reset();
      toast("Supabase disconnected", {
        description: "Stored Supabase credentials were removed.",
      });
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : String(error));
    }
  }

  function handleCreateConnection() {
    if (!selectedProject || !password) return;
    const url = buildSupabaseConnectionUrl(selectedProject, password, mode);
    onComplete({
      name: selectedProject.name || `Supabase ${selectedProject.id}`,
      type: "postgres",
      url,
      poolerMode: mode !== "direct",
      status: "idle",
    });
  }

  return (
    <div className="space-y-4 border border-border/60 bg-card/35 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Connect via provider
          </Label>
          <p className="mt-1 text-xs text-muted-foreground/75">
            Connect Supabase with an access token to pick a project without copying host details.
          </p>
        </div>
        {isConnected ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleDisconnect}
            className="gap-2 border-border/70"
          >
            <LogOut className="h-3.5 w-3.5" />
            Disconnect
          </Button>
        ) : null}
      </div>

      {authError ? (
        <p className="border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          {authError}
        </p>
      ) : null}

      {!isConnected ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="supabase-token" className="text-xs text-muted-foreground">
              Personal access token
            </Label>
            <button
              type="button"
              onClick={function () {
                void open(TOKENS_URL);
              }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Generate one
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
          <div className="flex gap-2">
            <Input
              id="supabase-token"
              type="password"
              value={tokenInput}
              onChange={function (event) {
                setTokenInput(event.target.value);
              }}
              onKeyDown={function (event) {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleConnect();
                }
              }}
              placeholder="sbp_..."
              autoComplete="off"
              className="h-9 bg-background/70"
            />
            <Button
              type="button"
              onClick={handleConnect}
              disabled={isAuthorizing || !tokenInput.trim()}
              className="shrink-0 gap-2"
            >
              {isAuthorizing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PlugZap className="h-3.5 w-3.5" />
              )}
              Connect
            </Button>
          </div>
          <p className="text-xs text-muted-foreground/70">
            The token is validated, then encrypted and stored on this device only.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={function (event) {
                setQuery(event.target.value);
              }}
              placeholder="Search Supabase projects"
              className="h-9 bg-background/70 pl-9"
            />
          </div>

          <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
            {isLoading ? (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading projects
              </div>
            ) : null}
            {error ? (
              <p className="border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                {error}
              </p>
            ) : null}
            {filteredProjects.map(function (project) {
              const isSelected = selectedProject?.id === project.id;
              const isHealthy = project.status === "ACTIVE_HEALTHY";
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={function () {
                    setSelectedProject(project);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 border px-3 py-2.5 text-left transition-colors",
                    isSelected
                      ? "border-emerald-500/45 bg-emerald-500/10"
                      : "border-border/60 bg-background/45 hover:border-border hover:bg-card/65",
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      isHealthy ? "bg-emerald-500" : "bg-amber-500",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {project.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {project.id} · {project.region}
                    </span>
                  </span>
                  {isSelected ? <Check className="h-4 w-4 text-emerald-500" /> : null}
                </button>
              );
            })}
          </div>

          {selectedProject ? (
            <div className="grid gap-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {MODES.map(function (option) {
                  const isSelected = mode === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={function () {
                        setMode(option.id);
                      }}
                      className={cn(
                        "border px-3 py-2 text-left transition-colors",
                        isSelected
                          ? "border-emerald-500/45 bg-emerald-500/10"
                          : "border-border/60 bg-background/45 hover:border-border hover:bg-card/65",
                      )}
                    >
                      <span className="block text-sm font-medium">{option.label}</span>
                      <span className="block text-xs text-muted-foreground">{option.hint}</span>
                    </button>
                  );
                })}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="supabase-password" className="text-xs text-muted-foreground">
                  Database password
                </Label>
                <Input
                  id="supabase-password"
                  type="password"
                  value={password}
                  onChange={function (event) {
                    setPassword(event.target.value);
                  }}
                  className="h-9 bg-background/70"
                />
              </div>
              <Button
                type="button"
                onClick={handleCreateConnection}
                disabled={!password || selectedProject.status !== "ACTIVE_HEALTHY"}
                className="self-start gap-2"
              >
                <PlugZap className="h-3.5 w-3.5" />
                Create Supabase Connection
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
