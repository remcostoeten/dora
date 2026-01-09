import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Checkbox } from "@/shared/ui/checkbox";
import { Connection, DatabaseType } from "../types";
import { Loader2, Save, Terminal, AlertCircle, CheckCircle2, Sparkles, FolderOpen } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { commands, DatabaseInfo } from "@/lib/bindings";
import {
    sanitizeConnectionUrl,
    isValidConnectionUrl,
    detectProviderName,
    buildConnectionString,
    PROVIDER_CONFIGS
} from "../utils/providers";
import { DatabaseIcon, DATABASE_META } from "./database-icons";

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (connection: Omit<Connection, "id" | "createdAt">) => void;
    initialValues?: Connection;
};

const DATABASE_TYPES: DatabaseType[] = ["postgres", "mysql", "sqlite", "libsql"];

export function ConnectionDialog({ open, onOpenChange, onSave, initialValues }: Props) {
    const [formData, setFormData] = useState<Partial<Connection>>({
        type: "postgres",
        host: "localhost",
        port: 5432,
        ssl: false,
        ...initialValues,
    });

    const [isTesting, setIsTesting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [testStatus, setTestStatus] = useState<"idle" | "success" | "error">("idle");
    const [testMessage, setTestMessage] = useState("");
    const [useConnectionString, setUseConnectionString] = useState(false);

    useEffect(function resetFormOnOpen() {
        if (open) {
            const hasUrl = initialValues?.url && (initialValues.type === "postgres" || initialValues.type === "mysql");
            setFormData({
                type: "postgres",
                host: "localhost",
                port: 5432,
                ssl: false,
                ...initialValues,
            });
            setUseConnectionString(!!hasUrl);
            setTestStatus("idle");
            setTestMessage("");
        }
    }, [open, initialValues]);

    useEffect(function handleClipboardPaste() {
        if (!open) return;

        function handlePaste(e: ClipboardEvent) {
            const pastedText = e.clipboardData?.getData('text');
            if (!pastedText) return;

            const sanitized = sanitizeConnectionUrl(pastedText);
            if (!isValidConnectionUrl(sanitized)) return;

            e.preventDefault();

            setFormData(function (prev) {
                const updates: Partial<Connection> = {
                    url: sanitized,
                    host: undefined,
                    port: undefined,
                    user: undefined,
                    password: undefined,
                    database: undefined,
                    ssl: undefined,
                };

                if (!prev.name || prev.name === '') {
                    updates.name = detectProviderName(sanitized);
                }

                return { ...prev, ...updates };
            });
            setUseConnectionString(true);
        }

        document.addEventListener('paste', handlePaste);
        return function cleanup() {
            document.removeEventListener('paste', handlePaste);
        };
    }, [open]);

    function updateField(field: keyof Connection, value: unknown) {
        setFormData(function (prev) {
            const newData = { ...prev, [field]: value };

            if (field === "type") {
                const newType = value as DatabaseType;
                const config = PROVIDER_CONFIGS[newType];
                if (config.defaultPort > 0) {
                    newData.port = config.defaultPort;
                }
            }

            return newData;
        });
        setTestStatus("idle");
    }

    function handleTypeSelect(type: DatabaseType) {
        updateField("type", type);
        if (type === "sqlite" || type === "libsql") {
            setUseConnectionString(false);
        }
    }

    async function handleTestConnection(e: React.MouseEvent) {
        e.preventDefault();
        setIsTesting(true);
        setTestStatus("idle");
        setTestMessage("");

        try {
            let databaseInfo: DatabaseInfo;

            if (formData.type === "sqlite") {
                if (!formData.url) {
                    setTestStatus("error");
                    setTestMessage("Database path is required");
                    setIsTesting(false);
                    return;
                }
                databaseInfo = { SQLite: { db_path: formData.url } };
            } else if (formData.type === "libsql") {
                if (!formData.url) {
                    setTestStatus("error");
                    setTestMessage("Database URL is required");
                    setIsTesting(false);
                    return;
                }
                databaseInfo = {
                    LibSQL: {
                        url: formData.url,
                        auth_token: formData.authToken || null
                    }
                };
            } else {
                let connectionString: string;

                if (useConnectionString && formData.url) {
                    connectionString = formData.url;
                } else {
                    if (!formData.host) {
                        setTestStatus("error");
                        setTestMessage("Host is required");
                        setIsTesting(false);
                        return;
                    }

                    if (!formData.user) {
                        setTestStatus("error");
                        setTestMessage("Username is required");
                        setIsTesting(false);
                        return;
                    }

                    if (!formData.database) {
                        setTestStatus("error");
                        setTestMessage("Database name is required");
                        setIsTesting(false);
                        return;
                    }

                    connectionString = buildConnectionString({
                        type: formData.type as DatabaseType,
                        host: formData.host,
                        port: formData.port,
                        user: formData.user,
                        password: formData.password,
                        database: formData.database,
                        ssl: formData.ssl,
                    });
                }

                databaseInfo = {
                    Postgres: {
                        connection_string: connectionString,
                        ssh_config: null
                    }
                };
            }

            const result = await commands.testConnection(databaseInfo);

            if (result.status === "ok" && result.data) {
                setTestStatus("success");
                setTestMessage("Connection successful!");
            } else {
                setTestStatus("error");
                let errorMsg = "Connection failed";

                if (result.status === "error" && result.error) {
                    if (typeof result.error === 'string') {
                        errorMsg = result.error;
                    } else if (typeof result.error === 'object') {
                        if ('message' in result.error && typeof result.error.message === 'string') {
                            errorMsg = result.error.message;
                        } else {
                            errorMsg = JSON.stringify(result.error, null, 2);
                        }
                    } else {
                        errorMsg = String(result.error);
                    }
                }

                setTestMessage(errorMsg);
            }
        } catch (error) {
            setTestStatus("error");
            let errorMsg = "Unexpected error";

            if (error instanceof Error) {
                errorMsg = error.message;
            } else if (typeof error === 'string') {
                errorMsg = error;
            } else if (typeof error === 'object' && error !== null) {
                if ('message' in error && typeof error.message === 'string') {
                    errorMsg = error.message;
                } else {
                    errorMsg = JSON.stringify(error, null, 2);
                }
            } else {
                errorMsg = String(error);
            }

            setTestMessage(errorMsg);
        } finally {
            setIsTesting(false);
        }
    }

    function handleSave() {
        if (!formData.name) return;

        setIsSaving(true);
        setTimeout(function () {
            setIsSaving(false);
            onSave(formData as Omit<Connection, "id" | "createdAt">);
            onOpenChange(false);
        }, 400);
    }

    async function handleBrowseFile() {
        try {
            const result = await commands.openSqliteDb();
            if (result.status === "ok" && result.data) {
                updateField("url", result.data);
            }
        } catch (error) {
            console.error("Failed to open file picker:", error);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px] glass border-border/50 p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-6 py-5 border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="p-2.5 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl border border-primary/20">
                                <Sparkles className="h-5 w-5 text-primary" />
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 bg-primary rounded-full animate-pulse" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-semibold">
                                {initialValues ? "Edit Connection" : "New Connection"}
                            </DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground">
                                Configure your database connection
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-6 space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="name" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Connection Name
                        </Label>
                        <Input
                            id="name"
                            placeholder="e.g. Production Database"
                            value={formData.name || ""}
                            onChange={function (e) { updateField("name", e.target.value); }}
                            className="input-glow"
                            autoFocus
                        />
                    </div>

                    <div className="space-y-3">
                        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Database Type
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                            {DATABASE_TYPES.map(function (type) {
                                const meta = DATABASE_META[type];
                                const isActive = formData.type === type;
                                const isDisabled = type === "mysql";

                                return (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={function () { if (!isDisabled) handleTypeSelect(type); }}
                                        disabled={isDisabled}
                                        className={cn(
                                            "db-card text-left",
                                            isActive && "active",
                                            isDisabled && "opacity-50 cursor-not-allowed hover:bg-card/50 hover:border-border"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn("db-card-icon bg-muted/50", isDisabled && "grayscale")}>
                                                <DatabaseIcon type={type} className="h-5 w-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-sm truncate">
                                                        {meta.name}
                                                    </span>
                                                    {isDisabled && (
                                                        <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                                            Soon
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-muted-foreground truncate">
                                                    {meta.description}
                                                </div>
                                            </div>
                                            {isActive && !isDisabled && (
                                                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {formData.type === "sqlite" && (
                        <div className="form-section space-y-2">
                            <Label htmlFor="sqlite-path" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                Database File
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    id="sqlite-path"
                                    placeholder="/path/to/database.db"
                                    value={formData.url || ""}
                                    onChange={function (e) { updateField("url", e.target.value); }}
                                    className="flex-1 input-glow font-mono text-sm"
                                />
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handleBrowseFile}
                                    className="shrink-0"
                                    title="Browse for file"
                                >
                                    <FolderOpen className="h-4 w-4" />
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Select or enter the path to your SQLite database file
                            </p>
                        </div>
                    )}

                    {formData.type === "libsql" && (
                        <div className="form-section space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="libsql-url" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    Database URL
                                </Label>
                                <Input
                                    id="libsql-url"
                                    placeholder="libsql://your-database.turso.io"
                                    value={formData.url || ""}
                                    onChange={function (e) { updateField("url", e.target.value); }}
                                    className="input-glow font-mono text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="libsql-token" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    Auth Token
                                </Label>
                                <Input
                                    id="libsql-token"
                                    type="password"
                                    placeholder="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9..."
                                    value={formData.authToken || ""}
                                    onChange={function (e) { updateField("authToken", e.target.value); }}
                                    className="input-glow font-mono text-sm"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Get your token from the Turso dashboard
                                </p>
                            </div>
                        </div>
                    )}

                    {(formData.type === "postgres" || formData.type === "mysql") && (
                        <div className="form-section space-y-4">
                            <div className="flex items-center gap-2 py-1">
                                <Checkbox
                                    id="use-url"
                                    checked={useConnectionString}
                                    onCheckedChange={function (checked) {
                                        setUseConnectionString(!!checked);
                                        if (checked) {
                                            updateField("url", "");
                                        } else {
                                            updateField("url", undefined);
                                            updateField("host", "localhost");
                                            const config = PROVIDER_CONFIGS[formData.type as DatabaseType];
                                            updateField("port", config.defaultPort);
                                        }
                                    }}
                                />
                                <Label htmlFor="use-url" className="text-sm cursor-pointer">
                                    Use connection string
                                </Label>
                            </div>

                            {useConnectionString ? (
                                <div className="space-y-2">
                                    <Label htmlFor="connection-string" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        Connection String
                                    </Label>
                                    <Input
                                        id="connection-string"
                                        placeholder={`${formData.type}://user:password@host:port/database`}
                                        value={formData.url || ""}
                                        onChange={function (e) { updateField("url", sanitizeConnectionUrl(e.target.value)); }}
                                        className="input-glow font-mono text-sm"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Paste your full connection URL
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="col-span-2 space-y-2">
                                            <Label htmlFor="host" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                Host
                                            </Label>
                                            <Input
                                                id="host"
                                                placeholder="localhost"
                                                value={formData.host || ""}
                                                onChange={function (e) { updateField("host", e.target.value); }}
                                                className="input-glow"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="port" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                Port
                                            </Label>
                                            <Input
                                                id="port"
                                                type="number"
                                                value={formData.port || ""}
                                                onChange={function (e) { updateField("port", parseInt(e.target.value)); }}
                                                className="input-glow"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label htmlFor="user" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                Username
                                            </Label>
                                            <Input
                                                id="user"
                                                placeholder="postgres"
                                                value={formData.user || ""}
                                                onChange={function (e) { updateField("user", e.target.value); }}
                                                className="input-glow"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                Password
                                            </Label>
                                            <Input
                                                id="password"
                                                type="password"
                                                placeholder="••••••••"
                                                value={formData.password || ""}
                                                onChange={function (e) { updateField("password", e.target.value); }}
                                                className="input-glow"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="database" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                            Database
                                        </Label>
                                        <Input
                                            id="database"
                                            placeholder="postgres"
                                            value={formData.database || ""}
                                            onChange={function (e) { updateField("database", e.target.value); }}
                                            className="input-glow"
                                        />
                                    </div>

                                    <div className="flex items-center gap-2 pt-1">
                                        <Checkbox
                                            id="ssl"
                                            checked={formData.ssl}
                                            onCheckedChange={function (checked) { updateField("ssl", checked); }}
                                        />
                                        <Label htmlFor="ssl" className="text-sm text-muted-foreground cursor-pointer">
                                            Use SSL / TLS connection
                                        </Label>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {testStatus !== "idle" && (
                        <div className={cn(
                            "rounded-lg p-4 text-sm flex items-start gap-3 border",
                            testStatus === "success"
                                ? "bg-emerald-500/10 border-emerald-500/30 connection-status-success"
                                : "bg-destructive/10 border-destructive/30 connection-status-error"
                        )}>
                            <div className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-full shrink-0",
                                testStatus === "success" ? "bg-emerald-500/20" : "bg-destructive/20"
                            )}>
                                {testStatus === "success" ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                ) : (
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0 pt-1">
                                <div className={cn(
                                    "font-medium text-sm",
                                    testStatus === "success" ? "text-emerald-400" : "text-destructive"
                                )}>
                                    {testStatus === "success" ? "Connection Successful" : "Connection Failed"}
                                </div>
                                <div className={cn(
                                    "text-xs mt-0.5 break-words",
                                    testStatus === "success" ? "text-emerald-400/70" : "text-destructive/80"
                                )}>
                                    {testMessage}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="px-6 py-4 bg-muted/20 border-t border-border/50">
                    <Button
                        variant="ghost"
                        onClick={handleTestConnection}
                        disabled={isTesting}
                        className="mr-auto"
                    >
                        {isTesting ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Terminal className="h-4 w-4 mr-2" />
                        )}
                        Test
                    </Button>
                    <Button variant="outline" onClick={function () { onOpenChange(false); }} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving || !formData.name}>
                        {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Save className="h-4 w-4 mr-2" />
                        )}
                        Save Connection
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
