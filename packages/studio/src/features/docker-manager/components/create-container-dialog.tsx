import { RefreshCw, Eye, EyeOff, ChevronDown, ChevronRight } from "lucide-react";
import { Spinner } from "@studio/shared/ui/spinner";
import { useState, useEffect, useRef } from "react";
import { Button } from "@studio/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@studio/shared/ui/dialog";
import { Input } from "@studio/shared/ui/input";
import { Label } from "@studio/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@studio/shared/ui/select";
import { Switch } from "@studio/shared/ui/switch";
import { toast } from "@studio/shared/ui/notifier";
import {
  DATABASE_PROVIDERS,
  POSTGRES_VERSIONS,
  MARIADB_VERSIONS,
  MYSQL_VERSIONS,
  COCKROACH_VERSIONS,
  DEFAULT_POSTGRES_VERSION,
  DEFAULT_POSTGRES_USER,
  DEFAULT_POSTGRES_PASSWORD,
  DEFAULT_POSTGRES_DATABASE,
  DEFAULT_MARIADB_VERSION,
  DEFAULT_MARIADB_USER,
  DEFAULT_MARIADB_PASSWORD,
  DEFAULT_MARIADB_DATABASE,
  DEFAULT_MYSQL_VERSION,
  DEFAULT_MYSQL_USER,
  DEFAULT_MYSQL_PASSWORD,
  DEFAULT_MYSQL_DATABASE,
  DEFAULT_COCKROACH_VERSION,
  DEFAULT_COCKROACH_USER,
  DEFAULT_COCKROACH_DATABASE,
  DEFAULT_HOST_PORT_START,
} from "../constants";
import type {
  DatabaseContainerConfig,
  DatabaseProvider,
  DockerContainer,
} from "../types";
import {
  suggestContainerName,
  validateContainerName,
  generateVolumeName,
} from "../utilities/container-naming";
import { findFreePort } from "../utilities/port-utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@studio/shared/ui/collapsible";

function getProviderDefaults(provider: DatabaseProvider) {
  switch (provider) {
    case "mariadb":
      return {
        version: DEFAULT_MARIADB_VERSION,
        user: DEFAULT_MARIADB_USER,
        password: DEFAULT_MARIADB_PASSWORD,
        database: DEFAULT_MARIADB_DATABASE,
        port: 3306,
      };
    case "mysql":
      return {
        version: DEFAULT_MYSQL_VERSION,
        user: DEFAULT_MYSQL_USER,
        password: DEFAULT_MYSQL_PASSWORD,
        database: DEFAULT_MYSQL_DATABASE,
        port: 3306,
      };
    case "cockroach":
      return {
        version: DEFAULT_COCKROACH_VERSION,
        user: DEFAULT_COCKROACH_USER,
        password: "",
        database: DEFAULT_COCKROACH_DATABASE,
        port: 26257,
      };
    case "postgres":
    default:
      return {
        version: DEFAULT_POSTGRES_VERSION,
        user: DEFAULT_POSTGRES_USER,
        password: DEFAULT_POSTGRES_PASSWORD,
        database: DEFAULT_POSTGRES_DATABASE,
        port: 5433,
      };
  }
}

function getVersionOptions(provider: DatabaseProvider) {
  switch (provider) {
    case "mariadb":
      return MARIADB_VERSIONS;
    case "mysql":
      return MYSQL_VERSIONS;
    case "cockroach":
      return COCKROACH_VERSIONS;
    case "postgres":
    default:
      return POSTGRES_VERSIONS;
  }
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (config: DatabaseContainerConfig) => void;
  existingContainers: DockerContainer[];
  isSubmitting?: boolean;
  initialProvider?: DatabaseProvider;
};

export function CreateContainerDialog({
  open,
  onOpenChange,
  onSubmit,
  existingContainers,
  isSubmitting = false,
  initialProvider = "postgres",
}: Props) {
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<DatabaseProvider>("postgres");
  const [version, setVersion] = useState(DEFAULT_POSTGRES_VERSION);
  const [hostPort, setHostPort] = useState(DEFAULT_HOST_PORT_START);
  const [user, setUser] = useState(DEFAULT_POSTGRES_USER);
  const [password, setPassword] = useState(DEFAULT_POSTGRES_PASSWORD);
  const [database, setDatabase] = useState(DEFAULT_POSTGRES_DATABASE);
  const [ephemeral, setEphemeral] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isFindingPort, setIsFindingPort] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [cpuLimit, setCpuLimit] = useState<number | undefined>(undefined);
  const [memoryLimit, setMemoryLimit] = useState<number | undefined>(undefined);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const wasOpenRef = useRef(false);

  useEffect(
    function initializeDefaults() {
      if (open && !wasOpenRef.current) {
        const existingNames = existingContainers.map(function (c) {
          return c.name;
        });
        setName(suggestContainerName(existingNames));
        applyProviderDefaults(initialProvider);
      }

      wasOpenRef.current = open;
    },
    [open, existingContainers, initialProvider],
  );

  async function initFreePort(preferredPort: number) {
    setIsFindingPort(true);
    try {
      const port = await findFreePort(preferredPort, preferredPort, preferredPort + 100);
      setHostPort(port);
    } catch {
      setHostPort(preferredPort);
    } finally {
      setIsFindingPort(false);
    }
  }

  function applyProviderDefaults(nextProvider: DatabaseProvider) {
    const defaults = getProviderDefaults(nextProvider);
    setProvider(nextProvider);
    setVersion(defaults.version);
    setUser(defaults.user);
    setPassword(defaults.password);
    setDatabase(defaults.database);
    void initFreePort(defaults.port);
  }

  async function handleFindFreePort() {
    setIsFindingPort(true);
    try {
      const defaults = getProviderDefaults(provider);
      const port = await findFreePort(defaults.port, defaults.port, defaults.port + 100);
      setHostPort(port);
    } catch (error) {
      console.error("Failed to find free port:", error);
      toast.error("Failed to find free port", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsFindingPort(false);
    }
  }

  function handleNameChange(value: string) {
    setName(value);
    const validation = validateContainerName(value);
    setNameError(validation.valid ? null : validation.error || null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const validation = validateContainerName(name);
    if (!validation.valid) {
      setNameError(validation.error || "Invalid container name");
      return;
    }

    const baseConfig = {
      provider,
      name,
      hostPort,
      ephemeral,
      volumeName: ephemeral ? undefined : generateVolumeName(name),
      cpuLimit,
      memoryLimitMb: memoryLimit,
    };

    const config: DatabaseContainerConfig =
      provider === "mariadb"
        ? {
            ...baseConfig,
            provider,
            mariadbVersion: version,
            user,
            password,
            database,
          }
        : provider === "mysql"
        ? {
            ...baseConfig,
            provider,
            mysqlVersion: version,
            user,
            password,
            database,
          }
        : provider === "cockroach"
          ? {
              ...baseConfig,
              provider,
              cockroachVersion: version,
              user,
              password: "",
              database,
            }
          : {
              ...baseConfig,
              provider,
              postgresVersion: version,
              user,
              password,
              database,
            };

    onOpenChange(false);
    resetForm();
    onSubmit(config);
  }

  function handleClose() {
    onOpenChange(false);
    resetForm();
  }

  function resetForm() {
    setName("");
    applyProviderDefaults(initialProvider);
    setEphemeral(true);
    setShowPassword(false);
    setNameError(null);
    setCpuLimit(undefined);
    setMemoryLimit(undefined);
    setIsAdvancedOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Database Container</DialogTitle>
          <DialogDescription>
            Configure a new local database container for development.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Container Name</Label>
            <Input
              id="name"
              value={name}
              onChange={function (e) {
                handleNameChange(e.target.value);
              }}
              placeholder="my_database"
            />
            {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            <p className="text-xs text-muted-foreground">
              Use lowercase letters, numbers, `_` or `-`.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider">Database Provider</Label>
            <Select
              value={provider}
              onValueChange={function (value) {
                applyProviderDefaults(value as DatabaseProvider);
              }}
            >
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATABASE_PROVIDERS.map(function (item) {
                  return (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="version">
              {provider === "mariadb"
                ? "MariaDB Version"
                : provider === "mysql"
                  ? "MySQL Version"
                  : provider === "cockroach"
                    ? "CockroachDB Version"
                    : "PostgreSQL Version"}
            </Label>
            <Select value={version} onValueChange={setVersion}>
              <SelectTrigger id="version">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getVersionOptions(provider).map(function (version) {
                  return (
                    <SelectItem key={version.value} value={version.value}>
                      {version.label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="port">Host Port</Label>
            <div className="flex gap-2">
              <Input
                id="port"
                type="number"
                min={1024}
                max={65535}
                value={hostPort}
                onChange={function (e) {
                  setHostPort(parseInt(e.target.value, 10) || getProviderDefaults(provider).port);
                }}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Find free port"
                onClick={handleFindFreePort}
                disabled={isFindingPort}
              >
                <RefreshCw className={`h-4 w-4 ${isFindingPort ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Auto-detected free port</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="user">Username</Label>
              <Input
                id="user"
                value={user}
                onChange={function (e) {
                  setUser(e.target.value);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                {provider === "cockroach" ? "Password (unused)" : "Password"}
              </Label>
              {provider === "cockroach" ? (
                <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                  CockroachDB runs in insecure mode for local development, so a password is not
                  required.
                </div>
              ) : (
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={function (e) {
                      setPassword(e.target.value);
                    }}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={function () {
                      setShowPassword(function (p) {
                        return !p;
                      });
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="database">Database Name</Label>
            <Input
              id="database"
              value={database}
              onChange={function (e) {
                setDatabase(e.target.value);
              }}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {provider === "mariadb"
              ? "MariaDB uses the selected credentials for both the root and app user."
              : provider === "mysql"
                ? "MySQL uses the selected credentials for the root and app user."
                : provider === "cockroach"
                  ? "CockroachDB is started as a local single-node cluster for quick testing."
                  : "PostgreSQL uses the selected credentials for the main database role."}
          </p>

          <div className="flex items-center justify-between py-2">
            <div>
              <Label htmlFor="ephemeral" className="text-sm font-medium">
                Ephemeral Storage
              </Label>
              <p className="text-xs text-muted-foreground">
                Data will be lost when container is removed
              </p>
            </div>
            <Switch id="ephemeral" checked={ephemeral} onCheckedChange={setEphemeral} />
          </div>

          {!ephemeral && (
            <p className="text-xs text-muted-foreground px-2 py-1.5 bg-muted/50 rounded">
              Volume: {generateVolumeName(name || "container")}
            </p>
          )}

          <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen} className="space-y-2">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="p-0 h-auto hover:bg-transparent text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {isAdvancedOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Advanced Options
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cpu">CPU Limit (cores)</Label>
                  <Input
                    id="cpu"
                    type="number"
                    step="0.1"
                    min="0.1"
                    placeholder="e.g. 1.0"
                    value={cpuLimit ?? ""}
                    onChange={(e) =>
                      setCpuLimit(e.target.value ? parseFloat(e.target.value) : undefined)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="memory">Memory Limit (MB)</Label>
                  <Input
                    id="memory"
                    type="number"
                    min="64"
                    placeholder="e.g. 512"
                    value={memoryLimit ?? ""}
                    onChange={(e) =>
                      setMemoryLimit(e.target.value ? parseInt(e.target.value) : undefined)
                    }
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || Boolean(nameError)}>
              {isSubmitting ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Creating...
                </>
              ) : (
                "Create Container"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
