import { useState } from "react";
import { Copy, Check, Eye, EyeOff } from "lucide-react";
import { Button } from "@/shared/ui/button";
import type { DockerContainer } from "../types";
import {
    buildConnectionEnvVars,
    formatEnvVarsForClipboard,
    maskPassword,
} from "../utilities/connection-string-builder";

type Props = {
    container: DockerContainer;
    password: string;
};

export function ConnectionDetails({ container, password }: Props) {
    const [copied, setCopied] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const primaryPort = container.ports.find(function (p) {
        return p.containerPort === 5432;
    });

    const host = "localhost";
    const port = primaryPort?.hostPort ?? 5432;
    const user = container.labels["POSTGRES_USER"] || "postgres";
    const database = container.labels["POSTGRES_DB"] || "postgres";

    const envVars = buildConnectionEnvVars(host, port, user, password, database);
    const displayUrl = showPassword
        ? envVars.DATABASE_URL
        : maskPassword(envVars.DATABASE_URL);

    async function handleCopyEnv() {
        const envString = formatEnvVarsForClipboard(envVars);
        try {
            await navigator.clipboard.writeText(envString);
            setCopied(true);
            setTimeout(function () {
                setCopied(false);
            }, 2000);
        } catch {
            console.error("Failed to copy to clipboard");
        }
    }

    function togglePasswordVisibility() {
        setShowPassword(function (prev) {
            return !prev;
        });
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Connection
                </h4>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={handleCopyEnv}
                >
                    {copied ? (
                        <>
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                            Copied
                        </>
                    ) : (
                        <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy Env
                        </>
                    )}
                </Button>
            </div>

            <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">Host</span>
                    <code className="text-xs font-mono">{host}</code>
                </div>

                <div className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">Port</span>
                    <code className="text-xs font-mono">{port}</code>
                </div>

                <div className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">User</span>
                    <code className="text-xs font-mono">{user}</code>
                </div>

                <div className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">Password</span>
                    <div className="flex items-center gap-1">
                        <code className="text-xs font-mono">
                            {showPassword ? password : "••••••••"}
                        </code>
                        <button
                            type="button"
                            onClick={togglePasswordVisibility}
                            className="p-0.5 hover:text-foreground text-muted-foreground transition-colors"
                        >
                            {showPassword ? (
                                <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                                <Eye className="h-3.5 w-3.5" />
                            )}
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">Database</span>
                    <code className="text-xs font-mono">{database}</code>
                </div>
            </div>

            <div className="pt-2">
                <label className="text-xs text-muted-foreground">Connection URL</label>
                <div className="mt-1 p-2 rounded bg-muted/50 overflow-x-auto">
                    <code className="text-xs font-mono break-all">{displayUrl}</code>
                </div>
            </div>
        </div>
    );
}
