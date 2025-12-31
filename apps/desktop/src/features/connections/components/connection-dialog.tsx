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

        // Simulate connection test
        setTimeout(() => {
            const success = Math.random() > 0.3; // Random success for demo
            setIsTesting(false);
            if (success) {
                setTestStatus("success");
                setTestMessage("Successfully connected!");
            } else {
                setTestStatus("error");
                setTestMessage("Failed to connect: Connection refused at 127.0.0.1");
            }
        }, 1500);
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
                                        onChange={e => updateField("url", e.target.value)}
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
