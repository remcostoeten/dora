import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, LogOut, PlugZap, RefreshCw, Search, Terminal } from "lucide-react";
import { Spinner } from "@studio/shared/ui/spinner";
import { open } from "@tauri-apps/plugin-shell";
import type { TursoDatabase, TursoOrganization } from "@studio/lib/bindings";
import { Button } from "@studio/shared/ui/button";
import { Input } from "@studio/shared/ui/input";
import { Label } from "@studio/shared/ui/label";
import { toast } from "@studio/shared/ui/notifier";
import { cn } from "@studio/shared/utils/cn";
import { formatBackendError } from "@studio/shared/utils/backend-error";
import type { Connection } from "../../connections/types";
import {
  buildTursoConnectionUrl,
  createTursoToken,
  disconnectTurso,
  getTursoAccount,
  installTursoCli,
  isTursoCliAvailable,
  isTursoCliLoggedIn,
  isTursoConnected,
  loginTursoCli,
  mintTursoToken,
  saveTursoToken,
} from "./turso-api";
import { useTursoDatabases } from "./use-turso-databases";
import { useIsTauri } from "@studio/core/data-provider";
import { DesktopOnlyNotice } from "@studio/core/platform";

type Props = {
  onComplete: (connection: Omit<Connection, "id" | "createdAt">) => void;
};

const TOKENS_DASHBOARD_URL = "https://app.turso.tech/settings/tokens";
const CLI_INSTALL_URL = "https://docs.turso.tech/cli/installation";
const CLI_INSTALL_CMD = "curl -sSfL https://get.tur.so/install.sh | bash";

export function TursoConnectFlow({ onComplete }: Props) {
  const isTauri = useIsTauri();

  if (!isTauri) {
    return (
      <DesktopOnlyNotice
        title="Turso lives in the desktop app"
        description="Encrypted token storage and database discovery need the native app. Download Dora to connect your Turso databases."
      />
    );
  }

  return <TursoConnectFlowInner onComplete={onComplete} />;
}

function TursoConnectFlowInner({ onComplete }: Props) {
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<TursoOrganization[] | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<TursoDatabase | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [cliAvailable, setCliAvailable] = useState(false);
  const [cliLoggedIn, setCliLoggedIn] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isInstallingCli, setIsInstallingCli] = useState(false);
  const [isReprobingCli, setIsReprobingCli] = useState(false);
  const { databases, isLoading, error, refresh, reset } = useTursoDatabases(isConnected);

  // Hydrate from a token stored in a previous session so a returning user lands
  // straight on the database picker.
  useEffect(function hydrateConnectionState() {
    let cancelled = false;
    void isTursoConnected().then(function (connected) {
      if (!cancelled) setIsConnected(connected);
    });
    return function () {
      cancelled = true;
    };
  }, []);

  // Detect the local Turso CLI so we can offer one-click minting. macOS/Linux
  // only — on Windows (and when the CLI is genuinely missing) this stays false
  // and the flow falls back to a manual paste. Re-runnable so install, an
  // explicit re-check, and regaining focus can all refresh the result.
  const probeCli = useCallback(async function probeCli() {
    try {
      const available = await isTursoCliAvailable();
      setCliAvailable(available);
      if (!available) {
        setCliLoggedIn(false);
        return { available: false, loggedIn: false };
      }
      let loggedIn = false;
      try {
        loggedIn = await isTursoCliLoggedIn();
      } catch {
        loggedIn = false;
      }
      setCliLoggedIn(loggedIn);
      return { available: true, loggedIn };
    } catch {
      setCliAvailable(false);
      setCliLoggedIn(false);
      return { available: false, loggedIn: false };
    }
  }, []);

  useEffect(function detectTursoCliOnMount() {
    void probeCli();
  }, [probeCli]);

  // Re-probe when the window regains focus. The user often installs or signs in
  // to the CLI in a terminal alongside Dora; this picks that up without a manual
  // re-check or restart. Stops once the CLI is both present and authenticated.
  useEffect(function reprobeOnFocus() {
    if (cliAvailable && cliLoggedIn) return;
    function onFocus() {
      void probeCli();
    }
    window.addEventListener("focus", onFocus);
    return function () {
      window.removeEventListener("focus", onFocus);
    };
  }, [cliAvailable, cliLoggedIn, probeCli]);

  // Resolve which account the stored token belongs to, so the user can confirm
  // they're connected as the right one before picking a database.
  useEffect(function loadAccount() {
    if (!isConnected) {
      setAccount(null);
      return;
    }
    let cancelled = false;
    void getTursoAccount()
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
    const name = primary.name?.trim() ? primary.name : primary.slug;
    return account.length > 1 ? `${name} +${account.length - 1}` : name;
  }, [account]);

  const filteredDatabases = useMemo(function filterDatabases() {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return databases;
    return databases.filter(function (database) {
      return (
        database.name.toLowerCase().includes(normalizedQuery) ||
        database.organizationSlug.toLowerCase().includes(normalizedQuery) ||
        database.primaryRegion.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [databases, query]);

  async function handleConnect() {
    const token = tokenInput.trim();
    if (!token) return;
    setIsAuthorizing(true);
    setAuthError(null);
    try {
      await saveTursoToken(token);
      setTokenInput("");
      setIsConnected(true);
      await refresh();
    } catch (error) {
      setAuthError(formatBackendError(error));
    } finally {
      setIsAuthorizing(false);
    }
  }

  // One-click: drive the local Turso CLI to mint a Platform API token. This can
  // block while the CLI opens a browser for `turso auth login`, so the button
  // shows a pending state the whole time.
  async function handleMintWithCli() {
    setIsMinting(true);
    setAuthError(null);
    try {
      await mintTursoToken();
      setTokenInput("");
      setIsConnected(true);
      await refresh();
    } catch (error) {
      setAuthError(formatBackendError(error));
      // A mint can fail because the CLI session expired — re-probe so the UI
      // flips to the sign-in prompt instead of stranding the user on "mint".
      void probeCli();
    } finally {
      setIsMinting(false);
    }
  }

  // Authenticate the Turso CLI from inside Dora (`turso auth login` opens a
  // browser). On return we re-check so the UI advances from sign-in to mint.
  async function handleSignIn() {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      await loginTursoCli();
      const { loggedIn } = await probeCli();
      toast(
        loggedIn ? "Signed in to Turso" : "Sign-in didn't complete",
        {
          description: loggedIn
            ? 'Click "Mint a token with the Turso CLI" to connect.'
            : "Try again, or paste a token manually below.",
        },
      );
    } catch (error) {
      setAuthError(formatBackendError(error));
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleInstallCli() {
    setIsInstallingCli(true);
    setAuthError(null);
    try {
      await installTursoCli();
      // The freshly-written binary can take a beat to be resolvable, so re-probe
      // a few times before concluding it isn't there. This is what advances the
      // UI from "install" to "mint" without a restart.
      let probe = await probeCli();
      for (let attempt = 0; attempt < 5 && !probe.available; attempt++) {
        await new Promise(function (resolve) {
          setTimeout(resolve, 600);
        });
        probe = await probeCli();
      }
      toast("Turso CLI installed", {
        description: !probe.available
          ? 'CLI installed but not detected yet — click "Re-check" below, or restart Dora.'
          : probe.loggedIn
            ? 'Click "Mint a token with the Turso CLI" to connect.'
            : 'Next, click "Sign in to Turso" to authenticate.',
      });
    } catch (error) {
      setAuthError(formatBackendError(error));
    } finally {
      setIsInstallingCli(false);
    }
  }

  // Manual escape hatch for an already-installed CLI that wasn't picked up
  // automatically (e.g. installed on a PATH the app didn't inherit).
  async function handleRecheckCli() {
    setIsReprobingCli(true);
    setAuthError(null);
    try {
      const { available } = await probeCli();
      if (!available) {
        toast("Turso CLI still not found", {
          description:
            "If it's installed, make sure `turso --version` works in your terminal, then try again.",
        });
      }
    } finally {
      setIsReprobingCli(false);
    }
  }

  async function handleDisconnect() {
    try {
      await disconnectTurso();
      setIsConnected(false);
      setSelected(null);
      setQuery("");
      setTokenInput("");
      reset();
      toast("Turso disconnected", {
        description: "Stored Turso credentials were removed.",
      });
    } catch (error) {
      setAuthError(formatBackendError(error));
    }
  }

  async function handleCreateConnection() {
    if (!selected) return;
    setIsBuilding(true);
    setAuthError(null);
    try {
      const authToken = await createTursoToken(selected.organizationSlug, selected.name);
      onComplete({
        name: selected.name,
        type: "libsql",
        url: buildTursoConnectionUrl(selected.hostname),
        authToken,
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
            Turso
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
              Add an API token to pick a database — Dora mints the auth token for you.
            </p>
          )}
        </div>
        {isConnected ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleDisconnect}
            className="gap-2 border-border/70"
            title="Remove this Turso account connection so you can connect a different one"
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
          {cliAvailable ? (
            <div className="space-y-2">
              {cliLoggedIn ? (
                <>
                  <Button
                    type="button"
                    onClick={handleMintWithCli}
                    disabled={isMinting}
                    className="w-full gap-2"
                  >
                    {isMinting ? (
                      <Spinner className="h-3.5 w-3.5" />
                    ) : (
                      <Terminal className="h-3.5 w-3.5" />
                    )}
                    {isMinting ? "Minting via Turso CLI…" : "Mint a token with the Turso CLI"}
                  </Button>
                  <p className="text-xs text-muted-foreground/70">
                    Dora runs the Turso CLI to mint a token for you — no copy-paste needed.
                  </p>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    onClick={handleSignIn}
                    disabled={isLoggingIn}
                    className="w-full gap-2"
                  >
                    {isLoggingIn ? (
                      <Spinner className="h-3.5 w-3.5" />
                    ) : (
                      <Terminal className="h-3.5 w-3.5" />
                    )}
                    {isLoggingIn ? "Waiting for Turso sign-in…" : "Sign in to Turso"}
                  </Button>
                  <p className="text-xs text-muted-foreground/70">
                    {isLoggingIn
                      ? "A browser window opened to finish sign-in — come back here once it's done."
                      : "You're not signed in to the Turso CLI. This opens a browser to authenticate, then Dora can mint a token for you."}
                  </p>
                </>
              )}
              <div className="flex items-center gap-3 py-1">
                <span className="h-px flex-1 bg-border/60" />
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
                  or paste manually
                </span>
                <span className="h-px flex-1 bg-border/60" />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                onClick={function () {
                  void open(TOKENS_DASHBOARD_URL);
                }}
                className="w-full gap-2 border-border/70"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Create a token in the Turso dashboard
              </Button>
              <p className="text-xs text-muted-foreground/70">
                Opens{" "}
                <span className="font-mono text-[11px]">app.turso.tech/settings/tokens</span> —
                create a token there, then paste it below.
              </p>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground/70">
                  Or let Dora install the Turso CLI for one-click minting:
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleInstallCli}
                  disabled={isInstallingCli}
                  className="w-full gap-2 border-border/70"
                >
                  {isInstallingCli ? (
                    <Spinner className="h-3.5 w-3.5" />
                  ) : (
                    <Terminal className="h-3.5 w-3.5" />
                  )}
                  {isInstallingCli ? "Installing Turso CLI…" : "Install Turso CLI"}
                </Button>
                <div className="flex items-center gap-2 border border-border/60 bg-background/70 px-3 py-2">
                  <code className="flex-1 truncate font-mono text-[11px] text-foreground/80">
                    {CLI_INSTALL_CMD}
                  </code>
                  <button
                    type="button"
                    onClick={function () {
                      void navigator.clipboard.writeText(CLI_INSTALL_CMD);
                    }}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    title="Copy install command"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={function () {
                      void open(CLI_INSTALL_URL);
                    }}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    title="Open install docs"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <p className="text-[11px] text-muted-foreground/60">
                    Already have the Turso CLI?
                  </p>
                  <button
                    type="button"
                    onClick={handleRecheckCli}
                    disabled={isReprobingCli || isInstallingCli}
                    className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
                  >
                    {isReprobingCli ? (
                      <Spinner className="h-3 w-3" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Re-check
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3 py-1">
                <span className="h-px flex-1 bg-border/60" />
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
                  paste token
                </span>
                <span className="h-px flex-1 bg-border/60" />
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <Label htmlFor="turso-token" className="text-xs text-muted-foreground">
              Platform API token
            </Label>
            <button
              type="button"
              onClick={function () {
                void open(TOKENS_DASHBOARD_URL);
              }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Turso dashboard
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
          <div className="flex gap-2">
            <Input
              id="turso-token"
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
              placeholder="Paste your Turso API token"
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
            Token is validated then encrypted and stored on this device only.
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
              placeholder="Search Turso databases"
              className="h-9 bg-background/70 pl-9"
            />
          </div>

          <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
            {isLoading ? (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Spinner className="h-3.5 w-3.5" />
                Loading databases
              </div>
            ) : null}
            {error ? (
              <p className="border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                {error}
              </p>
            ) : null}
            {filteredDatabases.map(function (database) {
              const isSelected = selected?.name === database.name &&
                selected?.organizationSlug === database.organizationSlug;
              return (
                <button
                  key={`${database.organizationSlug}/${database.name}`}
                  type="button"
                  onClick={function () {
                    setSelected(database);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 border px-3 py-2.5 text-left transition-colors",
                    isSelected
                      ? "border-emerald-500/45 bg-emerald-500/10"
                      : "border-border/60 bg-background/45 hover:border-border hover:bg-card/65",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {database.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {database.organizationSlug}
                      {database.primaryRegion ? ` · ${database.primaryRegion}` : ""}
                    </span>
                  </span>
                  {isSelected ? <Check className="h-4 w-4 text-emerald-500" /> : null}
                </button>
              );
            })}
          </div>

          {selected ? (
            <Button
              type="button"
              onClick={handleCreateConnection}
              disabled={isBuilding}
              className="self-start gap-2"
            >
              {isBuilding ? (
                <Spinner className="h-3.5 w-3.5" />
              ) : (
                <PlugZap className="h-3.5 w-3.5" />
              )}
              Create Turso Connection
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
