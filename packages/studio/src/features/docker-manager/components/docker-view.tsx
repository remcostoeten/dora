import {
  Plus,
  Search,
  Container,
  AlertTriangle,
  ChevronDown,
  ArrowDown,
  ArrowUp,
  Activity,
  HeartPulse,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@studio/shared/ui/use-toast";
import {
  DOCKER_PALETTE_EVENT,
  type DockerPaletteCommand,
} from "@studio/features/command-palette/events";
import { Button } from "@studio/shared/ui/button";
import { Input } from "@studio/shared/ui/input";
import { Label } from "@studio/shared/ui/label";
import { Switch } from "@studio/shared/ui/switch";
import { useCreateContainer } from "../api/mutations/use-create-container";
import { useContainerActions, useRemoveContainer } from "../api/mutations/use-container-actions";
import {
  useContainers,
  useContainerSearch,
  useDockerAvailability,
} from "../api/queries/use-containers";
import type { DatabaseContainerConfig, DatabaseProvider, DockerContainer, RemoveContainerOptions } from "../types";
import { ContainerDetailsPanel } from "./container-details-panel";
import { ContainerList } from "./container-list";
import { ContainerTerminal } from "./container-terminal";
import { LogsViewer } from "./logs-viewer";
import { useContainerLogs } from "../api/queries/use-container-logs";
import { DEFAULT_LOG_TAIL } from "../constants";
import { CreateContainerDialog } from "./create-container-dialog";
import { RemoveContainerDialog } from "./remove-container-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@studio/shared/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@studio/shared/ui/dropdown-menu";
import { cn } from "@studio/shared/utils/cn";

type Props = {
  onOpenInDataViewer?: (container: DockerContainer) => void;
  windowControls?: ReactNode;
};

type StatusFilter = "all" | "running" | "stopped" | "created";
type SortField = "name" | "created" | "status";
type SortDirection = "asc" | "desc";

const STATUS_FILTER_OPTIONS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "running", label: "Running" },
  { value: "stopped", label: "Stopped" },
  { value: "created", label: "Created" },
];

export function DockerView({ onOpenInDataViewer, windowControls }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showExternal, setShowExternal] = useState(true);
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createProviderPreset, setCreateProviderPreset] = useState<DatabaseProvider>("postgres");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("running");
  const [sortBy, setSortBy] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [terminalContainerId, setTerminalContainerId] = useState<string | null>(null);
  const [isTerminalPanelOpen, setIsTerminalPanelOpen] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<"logs" | "terminal">("logs");
	const [tailLines, setTailLines] = useState(DEFAULT_LOG_TAIL);
	const [showRemoveDialog, setShowRemoveDialog] = useState(false);
	const [containerToRemove, setContainerToRemove] = useState<{
		id: string
		name: string
	} | null>(null);

	const searchInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleSearchFocus = useCallback(function (e: KeyboardEvent) {
    if (
      (e.key === "/" && !e.ctrlKey && !e.metaKey) ||
      ((e.ctrlKey || e.metaKey) && e.key === "k")
    ) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }
      e.preventDefault();
      searchInputRef.current?.focus();
    }
  }, []);

  useEffect(
    function () {
      document.addEventListener("keydown", handleSearchFocus);
      return function () {
        document.removeEventListener("keydown", handleSearchFocus);
      };
    },
    [handleSearchFocus],
  );

  const {
    data: dockerStatus,
    isLoading: isCheckingDocker,
    refetch: refetchDockerAvailability,
  } = useDockerAvailability();
  const { data: allContainers = [], isLoading: isLoadingContainers } = useContainers({
    showExternal: true,
    enabled: dockerStatus?.available ?? false,
  });

  const visibleContainers = useMemo(
    function () {
      if (showExternal) {
        return allContainers;
      }

      return allContainers.filter(function (container) {
        return container.origin === "managed";
      });
    },
    [showExternal, allContainers],
  );

  const externalCount = useMemo(
    function () {
      if (showExternal) return 0;

      return allContainers.filter(function (container) {
        return container.origin === "external";
      }).length;
    },
    [showExternal, allContainers],
  );
  const searchedContainers = useContainerSearch(visibleContainers, searchQuery);

  const filteredContainers = useMemo(
    function () {
      let result = searchedContainers;

      // Filter by status
      if (statusFilter !== "all") {
        result = result.filter(function (c) {
          if (statusFilter === "running") return c.state === "running";
          if (statusFilter === "stopped") return c.state === "exited" || c.state === "dead";
          if (statusFilter === "created") return c.state === "created";
          return true;
        });
      }

      // Sort
      return [...result].sort(function (a, b) {
        let sortResult = 0;

        if (sortBy === "name") {
          const nameA = a.name || "";
          const nameB = b.name || "";
          sortResult = nameA.localeCompare(nameB);
        }
        if (sortBy === "created") {
          const createdA = a.createdAt || 0;
          const createdB = b.createdAt || 0;
          sortResult = createdA - createdB;
        }
        if (sortBy === "status") {
          sortResult = a.state.localeCompare(b.state);
        }

        return sortDirection === "asc" ? sortResult : sortResult * -1;
      });
    },
    [searchedContainers, statusFilter, sortBy, sortDirection],
  );

  const selectedContainer = useMemo(
    function () {
      if (!selectedContainerId) {
        return null;
      }
      return (
        visibleContainers.find(function (c) {
          return c.id === selectedContainerId;
        }) ?? null
      );
    },
    [selectedContainerId, visibleContainers],
  );
  const terminalContainer = useMemo(
    function () {
      if (!terminalContainerId) {
        return null;
      }
      return (
        allContainers.find(function (container) {
          return container.id === terminalContainerId;
        }) ?? null
      );
    },
    [allContainers, terminalContainerId],
  );

  const { data: logs = "", isLoading: logsLoading } = useContainerLogs(selectedContainerId, {
    tail: tailLines,
    enabled: activeBottomTab === "logs" && !!selectedContainerId,
  });

  const containerSummary = useMemo(
    function () {
      const runningCount = visibleContainers.filter(function (container) {
        return container.state === "running";
      }).length;

      const healthyCount = visibleContainers.filter(function (container) {
        return container.state === "running" && container.health === "healthy";
      }).length;

      return {
        total: visibleContainers.length,
        running: runningCount,
        healthy: healthyCount,
      };
    },
    [visibleContainers],
  );

  const createContainer = useCreateContainer({
    onSuccess: function (result, config) {
      if (result.success && result.containerId) {
        setIsCreateDialogOpen(false);
        setSelectedContainerId(result.containerId);
        toast({
          title: "Container Created",
          description: `${config?.provider === "mariadb"
            ? "MariaDB"
            : config?.provider === "cockroach"
              ? "CockroachDB"
              : "PostgreSQL"} container is starting up...`,
          variant: "success",
        });
      } else if (!result.success) {
        toast({
          title: "Failed to Create Container",
          description: result.error || "Unknown error occurred",
          variant: "destructive",
        });
      }
    },
    onError: function (error) {
      toast({
        title: "Failed to Create Container",
        description: error.message,
        variant: "destructive",
      });
    },
  });

	const containerActions = useContainerActions();
	const removeContainer = useRemoveContainer({
		onSuccess: function () {
			setShowRemoveDialog(false);
			setContainerToRemove(null);
			setSelectedContainerId(null);
		}
	});

	function handleCreateContainer(config: DatabaseContainerConfig) {
    createContainer.mutate(config);
  }

  function handleOpenCreateDialog(provider: DatabaseProvider) {
    setCreateProviderPreset(provider);
    setIsCreateDialogOpen(true);
  }

  function handleQuickStart(id: string) {
    containerActions.mutate({ containerId: id, action: "start" });
  }

  function handleQuickStop(id: string) {
    containerActions.mutate({ containerId: id, action: "stop" });
  }

  function handleQuickRestart(id: string) {
    containerActions.mutate({ containerId: id, action: "restart" });
  }

  function handleOpenContainerInDataViewer(container: DockerContainer) {
    setSelectedContainerId(container.id);
    if (onOpenInDataViewer) {
      onOpenInDataViewer(container);
    }
  }

	function handleSelectContainer(id: string) {
		setSelectedContainerId(id);
		setActiveBottomTab("logs");
		setIsTerminalPanelOpen(false);
	}

	function handleRemoveContainer(id: string) {
		const container = visibleContainers.find(function (c) {
			return c.id === id
		})
		if (container) {
			setContainerToRemove({ id: container.id, name: container.name })
			setShowRemoveDialog(true)
		}
	}

	function handleConfirmRemoveContainer(options: RemoveContainerOptions) {
		if (!containerToRemove) return
		removeContainer.mutate({
			containerId: containerToRemove.id,
			options
		})
	}

  function handleOpenTerminal(container: DockerContainer) {
    setSelectedContainerId(container.id);
    setTerminalContainerId(container.id);
    setIsTerminalPanelOpen(true);
    setActiveBottomTab("terminal");
  }

  function handleCloseTerminalPanel() {
    setIsTerminalPanelOpen(false);
    setActiveBottomTab("logs");
  }

  function handleRemoveComplete() {
    setSelectedContainerId(null);
  }

  function handleClearSearch() {
    setSearchQuery("");
    searchInputRef.current?.focus();
  }

  async function handleRetryDockerConnection() {
    setSearchQuery("");
    setSelectedContainerId(null);
    setTerminalContainerId(null);
    setIsTerminalPanelOpen(false);
    setActiveBottomTab("logs");
    setTailLines(DEFAULT_LOG_TAIL);

    queryClient.removeQueries({
      predicate: function (query) {
        const [scope] = query.queryKey;
        return typeof scope === "string" && scope.startsWith("docker-");
      },
    });

    navigate("/", { replace: true });
    await refetchDockerAvailability();
  }

  useEffect(
    function keepTerminalContainerInSync() {
      if (!terminalContainerId) {
        return;
      }

      const stillExists = allContainers.some(function (container) {
        return container.id === terminalContainerId;
      });
      if (!stillExists) {
        setTerminalContainerId(null);
        setIsTerminalPanelOpen(false);
      }
    },
    [allContainers, terminalContainerId],
  );

  useEffect(
    function listenForPaletteCommands() {
      function onPaletteCommand(event: Event) {
        const customEvent = event as CustomEvent<DockerPaletteCommand>;
        const detail = customEvent.detail;

        if (!detail) return;

        if (detail.type === "open-create") {
          setIsCreateDialogOpen(true);
          return;
        }

        setSelectedContainerId(detail.containerId);

        if (detail.type === "select-container") {
          return;
        }

        if (detail.type === "container-action") {
          containerActions.mutate({
            containerId: detail.containerId,
            action: detail.action,
          });
          return;
        }

        const container =
          allContainers.find(function (item) {
            return item.id === detail.containerId;
          }) ?? null;

        if (!container) {
          return;
        }

        if (detail.type === "open-in-data-viewer") {
          onOpenInDataViewer?.(container);
          return;
        }

        if (detail.type === "open-terminal") {
          setSelectedContainerId(container.id);
          setTerminalContainerId(container.id);
          setIsTerminalPanelOpen(true);
          setActiveBottomTab("terminal");
        }
      }

      window.addEventListener(DOCKER_PALETTE_EVENT, onPaletteCommand as EventListener);
      return function () {
        window.removeEventListener(DOCKER_PALETTE_EVENT, onPaletteCommand as EventListener);
      };
    },
    [allContainers, containerActions, onOpenInDataViewer],
  );

  if (isCheckingDocker) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="h-10 w-10 mx-auto mb-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Checking Docker status...</p>
        </div>
      </div>
    );
  }

  if (!dockerStatus?.available) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
          <h2 className="text-lg font-semibold mb-2">Docker Not Available</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {dockerStatus?.error ||
              "Unable to connect to Docker. Make sure Docker is installed and running on your system."}
          </p>
          {(dockerStatus?.error?.toLowerCase().includes("permission") ||
            dockerStatus?.error?.toLowerCase().includes("connect") ||
            dockerStatus?.error?.toLowerCase().includes("socket") ||
            !dockerStatus?.error) && (
            <div className="text-left p-3 rounded bg-muted font-mono text-xs space-y-1">
              <p>$ sudo systemctl start docker</p>
              <p>$ sudo usermod -aG docker $USER</p>
            </div>
          )}
          <Button variant="outline" className="mt-4" onClick={handleRetryDockerConnection}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="border-b border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div
          className="flex items-start justify-between gap-4 px-5 py-4"
          data-tauri-drag-region="true"
        >
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <Container className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="min-w-0 space-y-3">
              <div className="min-w-0">
                <h1 className="text-base font-semibold tracking-tight">Docker Containers</h1>
                <p className="max-w-xl text-xs text-muted-foreground">
                  Local database containers with one-click controls.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatPill
                  label="Visible"
                  value={containerSummary.total}
                  icon={<Container className="h-3.5 w-3.5" aria-hidden="true" />}
                />
                <StatPill
                  label="Running"
                  value={containerSummary.running}
                  icon={<Activity className="h-3.5 w-3.5" aria-hidden="true" />}
                />
                <StatPill
                  label="Healthy"
                  value={containerSummary.healthy}
                  icon={<HeartPulse className="h-3.5 w-3.5" aria-hidden="true" />}
                />
              </div>
            </div>
          </div>
          {windowControls ? (
            <div className="shrink-0 pt-0.5" data-tauri-drag-region="false">
              {windowControls}
            </div>
          ) : null}
        </div>
      </header>

      <div className="border-b border-border/70 bg-background/80 px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <div className="relative min-w-[260px] flex-1 max-w-md">
              <Label htmlFor="container-search" className="sr-only">
                Search containers
              </Label>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="container-search"
                ref={searchInputRef}
                placeholder="Search containers..."
                name="container_search"
                autoComplete="off"
                value={searchQuery}
                onChange={function (e) {
                  setSearchQuery(e.target.value);
                }}
                className="pl-9 pr-12"
              />
              <kbd className="pointer-events-none absolute right-2 top-1/2 inline-flex h-5 select-none items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground -translate-y-1/2">
                /
              </kbd>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-2">
              <Switch id="show-external" checked={showExternal} onCheckedChange={setShowExternal} />
              <Label htmlFor="show-external" className="whitespace-nowrap text-sm">
                Show all
                {!showExternal && externalCount > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-medium text-muted-foreground tabular-nums">
                    +{externalCount}
                  </span>
                )}
              </Label>
            </div>

            <div className="flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 p-1">
              {STATUS_FILTER_OPTIONS.map(function (option) {
                const isActive = option.value === statusFilter;

                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={function () {
                      setStatusFilter(option.value);
                    }}
                    className={cn(
                      "inline-flex h-7 items-center rounded-full px-3 text-xs font-medium transition-colors",
                      "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-2 py-1.5">
              <Select
                value={sortBy}
                onValueChange={function (value) {
                  setSortBy(value as SortField);
                }}
              >
                <SelectTrigger aria-label="Sort containers" className="h-7 w-[130px] border-0 bg-transparent text-xs shadow-none">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="created">Created</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>

              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={function () {
                  setSortDirection(function (current) {
                    return current === "asc" ? "desc" : "asc";
                  });
                }}
                aria-label={
                  sortDirection === "asc"
                    ? "Sorting ascending. Activate to sort descending"
                    : "Sorting descending. Activate to sort ascending"
                }
              >
                {sortDirection === "asc" ? (
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={function () {
                handleOpenCreateDialog("postgres");
              }}
            >
              <Plus className="h-4 w-4" />
              New Container
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="gap-1.5">
                  Templates
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuLabel>Quick start</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={function () {
                  handleOpenCreateDialog("postgres");
                }}>
                  PostgreSQL
                </DropdownMenuItem>
                <DropdownMenuItem onClick={function () {
                  handleOpenCreateDialog("mariadb");
                }}>
                  MariaDB
                </DropdownMenuItem>
                <DropdownMenuItem onClick={function () {
                  handleOpenCreateDialog("cockroach");
                }}>
                  CockroachDB
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <ContainerList
            containers={filteredContainers}
            selectedContainerId={selectedContainerId}
            onSelectContainer={handleSelectContainer}
            onStartContainer={handleQuickStart}
            onStopContainer={handleQuickStop}
            onRestartContainer={handleQuickRestart}
            onOpenContainerInDataViewer={handleOpenContainerInDataViewer}
            onRemoveContainer={handleRemoveContainer}
            isActionPending={containerActions.isPending}
            isLoading={isLoadingContainers}
            searchQuery={searchQuery}
            onClearSearch={handleClearSearch}
          />

          <ContainerDetailsPanel
            container={selectedContainer}
            onOpenInDataViewer={onOpenInDataViewer}
            onOpenTerminal={handleOpenTerminal}
            onRemoveComplete={handleRemoveComplete}
          />
        </div>

        {selectedContainer && (
          <div className="h-72 border-t border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
            <div className="h-9 border-b border-border px-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={function () {
                      setActiveBottomTab("logs");
                    }}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                      activeBottomTab === "logs"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Logs
                  </button>
                  <button
                    type="button"
                    onClick={function () {
                      if (terminalContainerId !== selectedContainer.id) {
                        setTerminalContainerId(selectedContainer.id);
                      }
                      setIsTerminalPanelOpen(true);
                      setActiveBottomTab("terminal");
                    }}
                    disabled={selectedContainer.state !== "running"}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                      activeBottomTab === "terminal"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                      selectedContainer.state !== "running" && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    Terminal
                  </button>
                </div>
                {activeBottomTab === "terminal" && terminalContainer && (
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {terminalContainer.name}
                  </span>
                )}
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={function () {
                  setSelectedContainerId(null);
                  setIsTerminalPanelOpen(false);
                }}
                aria-label="Close panel"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="h-[calc(100%-2.25rem)] p-3">
              {activeBottomTab === "logs" && (
                <LogsViewer
                  logs={logs}
                  isLoading={logsLoading}
                  tailLines={tailLines}
                  onTailLinesChange={setTailLines}
                />
              )}
              {activeBottomTab === "terminal" && terminalContainer && (
                <ContainerTerminal container={terminalContainer} enabled={isTerminalPanelOpen} />
              )}
              {activeBottomTab === "terminal" && !terminalContainer && (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Container must be running to open a terminal.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <CreateContainerDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateContainer}
        existingContainers={allContainers}
        isSubmitting={createContainer.isPending}
        initialProvider={createProviderPreset}
      />

      <RemoveContainerDialog
        containerName={containerToRemove?.name ?? ''}
        open={showRemoveDialog}
        onOpenChange={function (open) {
          setShowRemoveDialog(open)
          if (!open) setContainerToRemove(null)
        }}
        onConfirm={handleConfirmRemoveContainer}
        isRemoving={removeContainer.isPending}
      />
    </div>
  );
}

function StatPill({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-xs">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}
