import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Checkbox } from "@/shared/ui/checkbox";
import { Connection, DatabaseType, DEFAULT_PORTS } from "../types";
import { Database, Loader2, Save, Terminal, AlertCircle } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { commands, DatabaseInfo } from "@/lib/bindings";

/**
 * Sanitizes a pasted connection URL by stripping:
 * - psql command prefix (e.g., "psql 'postgresql://...'")
 * - Environment variable prefixes (e.g., "DB_URL=", "DATABASE_URL=", "CONNECTION_STR=")
 * - Surrounding single or double quotes
 */
function sanitizeConnectionUrl(input: string): string {
    let value = input.trim();

    // Strip psql command if present (e.g., "psql 'postgresql://...'")
    const psqlMatch = value.match(/^psql\s+['"]?(.+?)['"]?\s*$/i);
    if (psqlMatch) {
        value = psqlMatch[1];
    }

    // Strip environment variable prefix (e.g., "DB_URL=", "DATABASE_URL=", "CONNECTION_STR=")
    // Matches patterns like: VAR_NAME=value, VAR_NAME="value", VAR_NAME='value'
    const envVarMatch = value.match(/^[A-Z_][A-Z0-9_]*\s*=\s*['"]?(.+?)['"]?\s*$/i);
    if (envVarMatch) {
        value = envVarMatch[1];
    }

    // Strip surrounding quotes if still present
    if ((value.startsWith("'") && value.endsWith("'")) ||
        (value.startsWith('"') && value.endsWith('"'))) {
        value = value.slice(1, -1);
    }

    return value;
}

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (connection: Omit<Connection, "id" | "createdAt">) => void;
    initialValues?: Connection;
};

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

    useEffect(() => {
        if (open) {
            setFormData({
                type: "postgres",
                host: "localhost",
                port: 5432,
                ssl: false,
                ...initialValues,
            });
            setTestStatus("idle");
            setTestMessage("");
        }
    }, [open, initialValues]);

    const updateField = (field: keyof Connection, value: any) => {
        setFormData(prev => {
            const newData = { ...prev, [field]: value };

            // Auto-update port if type changes and port was default/empty
            if (field === "type") {
                const newType = value as DatabaseType;
                if (DEFAULT_PORTS[newType] > 0) {
                    newData.port = DEFAULT_PORTS[newType];
                }
            }

            return newData;
        });
        setTestStatus("idle");
    };

    const handleTestConnection = async (e: React.MouseEvent) => {
        e.preventDefault();
        setIsTesting(true);
        setTestStatus("idle");
        setTestMessage("");

        try {
            // Build DatabaseInfo based on type
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
                // Postgres or MySQL - build connection string
                let connectionString: string;

                if (formData.url !== undefined && formData.url) {
                    // User provided a connection string
                    connectionString = formData.url;
                } else {
                    // Build connection string from individual fields
                    if (!formData.host) {
                        setTestStatus("error");
                        setTestMessage("Host is required");
                        setIsTesting(false);
                        return;
                    }

                    const user = formData.user || "postgres";
                    const password = formData.password || "";
                    const host = formData.host;
                    const port = formData.port || DEFAULT_PORTS[formData.type as DatabaseType];
                    const database = formData.database || "postgres";
                    const sslParam = formData.ssl ? "?sslmode=require" : "";

                    connectionString = `postgres://${user}:${password}@${host}:${port}/${database}${sslParam}`;
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
                setTestMessage("Successfully connected!");
            } else {
                setTestStatus("error");
                const errorMsg = result.status === "error"
                    ? String(result.error)
                    : "Connection failed";
                setTestMessage(`Failed to connect: ${errorMsg}`);
            }
        } catch (error) {
            setTestStatus("error");
            setTestMessage(`Failed to connect: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsTesting(false);
        }
    };

    const handleSave = () => {
        if (!formData.name) return;

        setIsSaving(true);
        // Simulate save delay
        setTimeout(() => {
            setIsSaving(false);
            onSave(formData as Omit<Connection, "id" | "createdAt">);
            onOpenChange(false);
        }, 500);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] bg-background border-sidebar-border p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b border-sidebar-border bg-sidebar/50">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-md">
                            <Database className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <DialogTitle>
                                {initialValues ? "Edit Connection" : "New Connection"}
                            </DialogTitle>
                            <DialogDescription>
                                Configure your database connection details
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-6 grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Connection Name</Label>
                        <Input
                            id="name"
                            placeholder="e.g. Production DB"
                            value={formData.name || ""}
                            onChange={e => updateField("name", e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="type">Database Type</Label>
                        <Select
                            value={formData.type}
                            onValueChange={(val) => updateField("type", val)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="postgres">PostgreSQL</SelectItem>
                                <SelectItem value="mysql">MySQL</SelectItem>
                                <SelectItem value="sqlite">SQLite (File System)</SelectItem>
                                <SelectItem value="libsql">LibSQL / Turso</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {formData.type === "sqlite" && (
                        <div className="grid gap-2">
                            <Label htmlFor="url">Database Path</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="url"
                                    placeholder="/path/to/database.db"
                                    value={formData.url || ""}
                                    onChange={e => updateField("url", e.target.value)}
                                    className="flex-1"
                                />
                                <Button variant="outline" size="icon" title="Browse file">
                                    <span className="text-xs">...</span>
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Absolute path to your SQLite database file
                            </p>
                        </div>
                    )}

                    {formData.type === "libsql" && (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="url">Database URL</Label>
                                <Input
                                    id="url"
                                    placeholder="libsql://your-db.turso.io"
                                    value={formData.url || ""}
                                    onChange={e => updateField("url", e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="authToken">Authentication Token</Label>
                                <Input
                                    id="authToken"
                                    type="password"
                                    placeholder="eyJ..."
                                    value={formData.authToken || ""}
                                    onChange={e => updateField("authToken", e.target.value)}
                                />
                            </div>
                        </>
                    )}

                    {(formData.type === "postgres" || formData.type === "mysql") && (
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="use-url"
                                    checked={!!formData.url}
                                    onCheckedChange={(checked) => {
                                        if (checked) {
                                            updateField("url", "");
                                            updateField("host", undefined);
                                            updateField("port", undefined);
                                            updateField("user", undefined);
                                            updateField("password", undefined);
                                            updateField("database", undefined);
                                            updateField("ssl", undefined);
                                        } else {
                                            updateField("url", undefined);
                                            updateField("host", "localhost");
                                            updateField("port", DEFAULT_PORTS[formData.type as DatabaseType]);
                                            updateField("user", undefined);
                                            updateField("password", undefined);
                                            updateField("database", undefined);
                                            updateField("ssl", false);
                                        }
                                    }}
                                />
                                <Label htmlFor="use-url" className="text-sm font-normal cursor-pointer">
                                    Use connection string / URL
                                </Label>
                            </div>

                            {formData.url !== undefined ? (
                                <div className="grid gap-2">
                                    <Label htmlFor="connection-string">Connection String</Label>
                                    <Input
                                        id="connection-string"
                                        placeholder={`${formData.type}://user:password@host:port/database`}
                                        value={formData.url || ""}
                                        onChange={e => updateField("url", sanitizeConnectionUrl(e.target.value))}
                                    />
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="host">Host</Label>
                                            <Input
                                                id="host"
                                                placeholder="localhost"
                                                value={formData.host || ""}
                                                onChange={e => updateField("host", e.target.value)}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="port">Port</Label>
                                            <Input
                                                id="port"
                                                type="number"
                                                value={formData.port || ""}
                                                onChange={e => updateField("port", parseInt(e.target.value))}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="user">User</Label>
                                            <Input
                                                id="user"
                                                placeholder="postgres"
                                                value={formData.user || ""}
                                                onChange={e => updateField("user", e.target.value)}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="password">Password</Label>
                                            <Input
                                                id="password"
                                                type="password"
                                                placeholder="••••••••"
                                                value={formData.password || ""}
                                                onChange={e => updateField("password", e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="database">Database Name</Label>
                                        <Input
                                            id="database"
                                            placeholder="postgres"
                                            value={formData.database || ""}
                                            onChange={e => updateField("database", e.target.value)}
                                        />
                                    </div>

                                    <div className="flex items-center space-x-2 pt-1">
                                        <Checkbox
                                            id="ssl"
                                            checked={formData.ssl}
                                            onCheckedChange={checked => updateField("ssl", checked)}
                                        />
                                        <Label htmlFor="ssl" className="text-sm font-normal text-muted-foreground cursor-pointer">
                                            Use SSL / TLS connection
                                        </Label>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Test Connection Status Area */}
                    {testStatus !== "idle" && (
                        <div className={cn(
                            "rounded-md p-3 text-sm flex items-start gap-2",
                            testStatus === "success" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                        )}>
                            {testStatus === "success" ? (
                                <Terminal className="h-4 w-4 mt-0.5" />
                            ) : (
                                <AlertCircle className="h-4 w-4 mt-0.5" />
                            )}
                            <span className="flex-1">{testMessage}</span>
                        </div>
                    )}
                </div>

                <DialogFooter className="px-6 py-4 bg-sidebar/30 border-t border-sidebar-border">
                    <Button
                        variant="ghost"
                        onClick={handleTestConnection}
                        disabled={isTesting}
                        className="mr-auto"
                    >
                        {isTesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Terminal className="h-4 w-4 mr-2" />}
                        Test Connection
                    </Button>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving || !formData.name}>
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
