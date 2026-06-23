import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, LogOut, PlugZap, RefreshCw, Search } from "lucide-react";
import { Spinner } from "@studio/shared/ui/spinner";
import { open } from "@tauri-apps/plugin-shell";
import type { SupabaseOrganization, SupabaseProject } from "@studio/lib/bindings";
import { Button } from "@studio/shared/ui/button";
import { Input } from "@studio/shared/ui/input";
import { Label } from "@studio/shared/ui/label";
import { toast } from "@studio/shared/ui/notifier";
import { cn } from "@studio/shared/utils/cn";
import { formatBackendError } from "@studio/shared/utils/backend-error";
import type { Connection } from "../../connections/types";
import {
  buildSupabaseConnectionUrl,
  connectSupabaseWithOauth,
  disconnectSupabase,
  getSupabaseAccount,
  getSupabasePoolerHost,
  getSupabaseProjectPassword,
  isSupabaseConnected,
  saveSupabaseProjectPassword,
  saveSupabaseToken,
  type SupabaseConnectionMode,
} from "./supabase-api";
import { useSupabaseProjects } from "./use-supabase-projects";
import { useIsTauri } from "@studio/core/data-provider";
import { DesktopOnlyNotice } from "@studio/core/platform";

type Props = {
  onComplete: (connection: Omit<Connection, "id" | "createdAt">) => void;
};

export function SupabaseConnectFlow({ onComplete }: Props) {
  const isTauri = useIsTauri();

  if (!isTauri) {
    return (
      <DesktopOnlyNotice
        title="Supabase lives in the desktop app"
        description="OAuth sign-in, encrypted token storage, and project discovery need the native app. Download Dora to connect your Supabase projects."
      />
    );
  }

  return <SupabaseConnectFlowInner onComplete={onComplete} />;
}

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

function SupabaseConnectFlowInner({ onComplete }: Props) {
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<SupabaseOrganization[] | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [showTokenFallback, setShowTokenFallback] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isOauthConnecting, setIsOauthConnecting] = useState(false);
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

  // Prefill the remembered password whenever a project is (re)selected. The
  // Management API never returns the password, so this is the only way a
  // returning user avoids re-typing it.
  useEffect(function prefillStoredPassword() {
    const projectRef = selectedProject?.id;
    if (!projectRef) return;
    let cancelled = false;
    // Reset to the per-project value: prefill if remembered, otherwise blank so
    // one project's password never carries over to another.
    void getSupabaseProjectPassword(projectRef).then(function (stored) {
      if (!cancelled) setPassword(stored ?? "");
    });
    return function () {
      cancelled = true;
    };
  }, [selectedProject?.id]);

  // Resolve which account the stored token belongs to, so the user can confirm
  // they're connected as the right one before picking a project.
  useEffect(function loadAccount() {
    if (!isConnected) {
      setAccount(null);
      return;
    }
    let cancelled = false;
    void getSupabaseAccount()
      .then(function (organizations) {
        if (!cancelled) setAccount(organizations);
      })
      .catch(function () {
        if (!cancelled) setAccount(null);
      });
    return function () {
      cancelled = true;
    };
  }, [isConnected]);

  const accountLabel = useMemo(function deriveAccountLabel() {
    if (!account || account.length === 0) return null;
    const primary = account[0];
    const name = primary.name?.trim() ? primary.name : primary.id;
    return account.length > 1 ? `${name} +${account.length - 1}` : name;
  }, [account]);

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

  async function handleOauthConnect() {
    setIsOauthConnecting(true);
    setAuthError(null);
    try {
      await connectSupabaseWithOauth();
      setIsConnected(true);
      await refresh();
    } catch (error) {
      setAuthError(formatBackendError(error));
    } finally {
      setIsOauthConnecting(false);
    }
  }

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
      setAuthError(formatBackendError(error));
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
      setAuthError(formatBackendError(error));
    }
  }

  const [isBuilding, setIsBuilding] = useState(false);

  async function handleCreateConnection() {
    if (!selectedProject || !password) return;
    setIsBuilding(true);
    setAuthError(null);
    try {
      // Pooler modes need the project's real cluster host; direct uses the
      // reported db host and needs no extra call.
      const poolerHost =
        mode === "direct" ? undefined : await getSupabasePoolerHost(selectedProject.id);
      const url = buildSupabaseConnectionUrl(selectedProject, password, mode, poolerHost);
      // Remember the password (encrypted on-device) so the next connect to this
      // project prefills it instead of prompting again.
      void saveSupabaseProjectPassword(selectedProject.id, password).catch(function () {
        // Non-fatal: the connection still succeeds, we just won't prefill later.
      });
      onComplete({
        name: selectedProject.name || `Supabase ${selectedProject.id}`,
        type: "postgres",
        url,
        poolerMode: mode !== "direct",
        status: "idle",
      });
    } catch (error) {
      setAuthError(formatBackendError(error));
    } finally {
      setIsBuilding(false);
    }
  }

  return (
    <div className="space-y-4 border border-border/60 bg-card/35 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Supabase
          </Label>
          {isConnected ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground/75">
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              {accountLabel ? (
                <span>
                  Connected as <span className="font-medium text-foreground">{accountLabel}</span>
                </span>
              ) : (
                <span>Connected</span>
              )}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground/75">
              Connect your account to pick a project without copying host details.
            </p>
          )}
        </div>
        {isConnected ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleDisconnect}
            className="gap-2 border-border/70"
            title="Remove this Supabase account connection so you can connect a different one"
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
        <div className="space-y-3">
          <Button
            type="button"
            onClick={handleOauthConnect}
            disabled={isOauthConnecting}
            className="w-full gap-2"
          >
            {isOauthConnecting ? (
              <Spinner className="h-3.5 w-3.5" />
            ) : (
              <PlugZap className="h-3.5 w-3.5" />
            )}
            {isOauthConnecting ? "Waiting for browser…" : "Connect with Supabase"}
          </Button>
          <p className="text-xs text-muted-foreground/70">
            Opens your browser to authorize Dora. Access is encrypted and stored on this device only.
          </p>

          {showTokenFallback ? (
            <div className="space-y-2 border-t border-border/50 pt-3">
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
                    <Spinner className="h-3.5 w-3.5" />
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
            <button
              type="button"
              onClick={function () {
                setShowTokenFallback(true);
              }}
              className="text-xs text-muted-foreground/70 underline-offset-2 hover:text-foreground hover:underline"
            >
              Use a personal access token instead
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
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
            <Button
              type="button"
              variant="outline"
              onClick={function () {
                void refresh();
              }}
              disabled={isLoading}
              className="h-9 shrink-0 gap-1.5 border-border/70 px-3"
              title="Re-fetch projects from Supabase"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
              Refresh
            </Button>
          </div>

          <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
            {isLoading ? (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Spinner className="h-3.5 w-3.5" />
                Loading projects
              </div>
            ) : null}
            {error ? (
              <p className="border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                {error}
              </p>
            ) : null}
            {!isLoading && !error && filteredProjects.length === 0 ? (
              <p className="px-1 py-3 text-xs text-muted-foreground">
                {projects.length === 0
                  ? "No Supabase projects found for this account. Create one in the dashboard, then Refresh."
                  : "No projects match your search."}
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
                    setAuthError(null);
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
                disabled={!password || isBuilding || selectedProject.status !== "ACTIVE_HEALTHY"}
                className="self-start gap-2"
              >
                {isBuilding ? (
                  <Spinner className="h-3.5 w-3.5" />
                ) : (
                  <PlugZap className="h-3.5 w-3.5" />
                )}
                Create Supabase Connection
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
