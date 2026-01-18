import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/shared/ui/dialog";
import { useAdapter } from "@/core/data-provider";

type TableMetrics = {
    tableSizeMb: string;
    indexSizeMb: string;
    totalSizeMb: string;
    rowCount: number;
    deadTuples: number;
    lastVacuum: string | null;
    lastAnalyze: string | null;
    firstDate: string | null;
    lastDate: string | null;
};

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tableName: string;
    connectionId: string;
};

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function MetricRow({ label, value }: { label: string; value: string | number | null }) {
    return (
        <div className="flex justify-between py-2 border-b border-sidebar-border/50 last:border-b-0">
            <span className="text-muted-foreground text-sm">{label}</span>
            <span className="text-sm font-mono text-sidebar-foreground">
                {value ?? "N/A"}
            </span>
        </div>
    );
}

export function TableInfoDialog({ open, onOpenChange, tableName, connectionId }: Props) {
    const adapter = useAdapter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [metrics, setMetrics] = useState<TableMetrics | null>(null);

    useEffect(function fetchMetrics() {
        if (!open || !tableName || !connectionId) return;

        // Check for Postgres adapter
        // @ts-ignore - adapter types might not be fully explicit
        const isPostgres = adapter && (adapter.type === 'postgres' || adapter.engine === 'postgres' || adapter.dialect === 'postgres');

        if (!isPostgres) {
            setError("Table metrics are only available for PostgreSQL connections.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setMetrics(null);

        async function loadMetrics() {
            try {
                // simple escape for single quotes
                const safeTableName = tableName.replace(/'/g, "''");

                const sizeQuery = `
          SELECT
            pg_table_size('"${safeTableName}"') as table_size,
            pg_indexes_size('"${safeTableName}"') as index_size,
            pg_total_relation_size('"${safeTableName}"') as total_size
        `;

                const statsQuery = `
          SELECT
            n_live_tup as row_count,
            n_dead_tup as dead_tuples,
            last_vacuum,
            last_analyze
          FROM pg_stat_user_tables
          WHERE relname = '${safeTableName}'
        `;

                const [sizeResult, statsResult] = await Promise.all([
                    adapter.executeQuery(connectionId, sizeQuery),
                    adapter.executeQuery(connectionId, statsQuery),
                ]);

                if (!sizeResult.ok) {
                    throw new Error(sizeResult.error);
                }

                const sizeRow = sizeResult.data.rows[0] || {};
                const statsRow = statsResult.ok ? statsResult.data.rows[0] || {} : {};

                let firstDate: string | null = null;
                let lastDate: string | null = null;

                const schemaResult = await adapter.getSchema(connectionId);
                if (schemaResult.ok) {
                    const tableInfo = schemaResult.data.tables.find(function (t) {
                        return t.name === tableName;
                    });
                    if (tableInfo) {
                        const timestampCol = tableInfo.columns.find(function (c) {
                            const type = c.data_type.toLowerCase();
                            return type.includes("timestamp") || type.includes("datetime") || type === "date";
                        });

                        if (timestampCol) {
                            const dateRangeQuery = `
                SELECT
                  MIN("${timestampCol.name}") as first_date,
                  MAX("${timestampCol.name}") as last_date
                FROM "${tableName}"
              `;
                            const dateResult = await adapter.executeQuery(connectionId, dateRangeQuery);
                            if (dateResult.ok && dateResult.data.rows[0]) {
                                const row = dateResult.data.rows[0];
                                firstDate = row.first_date ? String(row.first_date) : null;
                                lastDate = row.last_date ? String(row.last_date) : null;
                            }
                        }
                    }
                }

                setMetrics({
                    tableSizeMb: formatBytes(Number(sizeRow.table_size) || 0),
                    indexSizeMb: formatBytes(Number(sizeRow.index_size) || 0),
                    totalSizeMb: formatBytes(Number(sizeRow.total_size) || 0),
                    rowCount: Number(statsRow.row_count) || 0,
                    deadTuples: Number(statsRow.dead_tuples) || 0,
                    lastVacuum: statsRow.last_vacuum ? String(statsRow.last_vacuum) : null,
                    lastAnalyze: statsRow.last_analyze ? String(statsRow.last_analyze) : null,
                    firstDate,
                    lastDate,
                });
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load table info");
            } finally {
                setIsLoading(false);
            }
        }

        loadMetrics();
    }, [open, tableName, connectionId, adapter]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Table Info</DialogTitle>
                    <DialogDescription className="font-mono text-xs">
                        {tableName}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-2">
                    {isLoading && (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    )}

                    {error && (
                        <div className="text-sm text-destructive py-4 text-center">
                            {error}
                        </div>
                    )}

                    {metrics && !isLoading && (
                        <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                                Size
                            </div>
                            <MetricRow label="Table Size" value={metrics.tableSizeMb} />
                            <MetricRow label="Index Size" value={metrics.indexSizeMb} />
                            <MetricRow label="Total Size" value={metrics.totalSizeMb} />

                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 mt-4">
                                Records
                            </div>
                            <MetricRow label="Row Count" value={metrics.rowCount.toLocaleString()} />
                            <MetricRow label="Dead Tuples" value={metrics.deadTuples.toLocaleString()} />

                            {(metrics.firstDate || metrics.lastDate) && (
                                <>
                                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 mt-4">
                                        Date Range
                                    </div>
                                    <MetricRow label="First Date" value={metrics.firstDate} />
                                    <MetricRow label="Last Date" value={metrics.lastDate} />
                                </>
                            )}

                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 mt-4">
                                Maintenance
                            </div>
                            <MetricRow label="Last Vacuum" value={metrics.lastVacuum} />
                            <MetricRow label="Last Analyze" value={metrics.lastAnalyze} />
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
