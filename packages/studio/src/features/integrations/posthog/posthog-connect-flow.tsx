import { useEffect, useState } from "react";
import { Check, ExternalLink, LogOut, PlugZap } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { Spinner } from "@studio/shared/ui/spinner";
import { Button } from "@studio/shared/ui/button";
import { Input } from "@studio/shared/ui/input";
import { Label } from "@studio/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@studio/shared/ui/select";
import { toast } from "@studio/shared/ui/notifier";
import { formatBackendError } from "@studio/shared/utils/backend-error";
import { useIsTauri } from "@studio/core/data-provider";
import { DesktopOnlyNotice } from "@studio/core/platform";
import type { Connection } from "@studio/features/connections/types";
import {
  disconnectPosthog,
  getPosthogConfig,
  isPosthogConnected,
  savePosthogCredentials,
  type PosthogRegion,
} from "./posthog-api";

const API_KEYS_URL = "https://us.posthog.com/settings/user-api-keys";

type Props = {
  onComplete: (connection: Omit<Connection, "id" | "createdAt">) => void;
};

export function PosthogConnectFlow({ onComplete }: Props) {
  const isTauri = useIsTauri();

  if (!isTauri) {
    return (
      <DesktopOnlyNotice
        title="PostHog lives in the desktop app"
        description="Encrypted API-key storage and the HogQL query proxy need the native app. Download Dora to query your PostHog project."
      />
    );
  }

  return <PosthogConnectFlowInner onComplete={onComplete} />;
}

function buildPosthogConnection(
  region: PosthogRegion,
  projectId: string,
): Omit<Connection, "id" | "createdAt"> {
  return {
    name: `PostHog · ${projectId}`,
    type: "posthog",
    url: `posthog://${region}/${projectId}`,
    status: "idle",
  };
}

function PosthogConnectFlowInner({ onComplete }: Props) {
  const [isConnected, setIsConnected] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [region, setRegion] = useState<PosthogRegion>("us");
  const [projectId, setProjectId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      const [connected, config] = await Promise.all([
        isPosthogConnected().catch(() => false),
        getPosthogConfig().catch(() => null),
      ]);
      if (cancelled) return;
      setIsConnected(connected);
      if (config) {
        setRegion(config.region);
        setProjectId(config.projectId);
      }
    }
    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleConnect() {
    setIsSaving(true);
    try {
      await savePosthogCredentials(apiKey, region, projectId);
      setIsConnected(true);
      setApiKey("");
      toast.success("PostHog connected");
    } catch (error) {
      toast.error(formatBackendError(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDisconnect() {
    try {
      await disconnectPosthog();
      setIsConnected(false);
    } catch (error) {
      toast.error(formatBackendError(error));
    }
  }

  function handleCreateConnection() {
    onComplete(buildPosthogConnection(region, projectId));
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col gap-4 border border-border/60 bg-card/35 p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">Connect PostHog</h3>
          <p className="text-xs text-muted-foreground">
            Browse your product analytics read-only with HogQL. Paste a personal API key
            with query access.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="posthog-api-key">Personal API key</Label>
          <Input
            id="posthog-api-key"
            type="password"
            placeholder="phx_..."
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            autoComplete="off"
          />
          <button
            type="button"
            className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => open(API_KEYS_URL)}
          >
            <ExternalLink className="size-3" />
            Create an API key
          </button>
        </div>

        <div className="flex gap-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="posthog-region">Region</Label>
            <Select value={region} onValueChange={(value) => setRegion(value as PosthogRegion)}>
              <SelectTrigger id="posthog-region" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="us">US Cloud</SelectItem>
                <SelectItem value="eu">EU Cloud</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="posthog-project-id">Project ID</Label>
            <Input
              id="posthog-project-id"
              placeholder="e.g. 497538"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
            />
          </div>
        </div>

        <Button
          onClick={handleConnect}
          disabled={isSaving || !apiKey.trim() || !projectId.trim()}
        >
          {isSaving ? <Spinner className="size-4" /> : <PlugZap className="size-4" />}
          Connect
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 border border-border/60 bg-card/35 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h3 className="flex items-center gap-1.5 text-sm font-medium">
            <Check className="size-3.5 shrink-0 text-emerald-500" />
            PostHog · project {projectId}
          </h3>
          <p className="text-xs text-muted-foreground">
            {region === "us" ? "US Cloud" : "EU Cloud"} · HogQL · read-only
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleDisconnect}>
          <LogOut className="size-4" />
          Disconnect
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Creates a read-only connection. Browse events, persons, sessions, and groups, and
        query them with HogQL in the SQL console.
      </p>

      <Button onClick={handleCreateConnection} disabled={!projectId.trim()} className="w-fit">
        Create connection
      </Button>
    </div>
  );
}
