import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { StatementInfo } from '@/lib/bindings';

export function useQuery(connectionId: string | null) {
    const [results, setResults] = useState<any[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [executionTime, setExecutionTime] = useState<number | null>(null);

    const runQuery = useCallback(async (sql: string) => {
        if (!connectionId) {
            setError("No active connection");
            return;
        }

        try {
            setIsRunning(true);
            setError(null);
            setResults([]);
            setColumns([]);

            const start = performance.now();
            // Start query returns query IDs (support for multiple statements)
            const queryIds = await api.startQuery(connectionId, sql);

            if (queryIds.length > 0) {
                const queryId = queryIds[0]; // Just handle the first one for demo

                // Wait for results (polling or just fetch first page immediately)
                // In a real app we might poll status, but for small queries fetchPage works

                // Fetch columns first
                const colsRaw = await api.getColumns(queryId);
                // Assuming colsRaw is basically array of column definitions or similar
                // For simple display we'll try to infer from first row of data or just use raw if it's string[]
                // The backend returns Box<RawValue>, we need to cast or inspect it. 
                // For this demo, let's just fetch the page and extract keys from the first row if possible.

                const page = await api.fetchPage(queryId, 0);

                if (page && Array.isArray(page) && page.length > 0) {
                    setResults(page);
                    setColumns(Object.keys(page[0]));
                } else {
                    setResults([]);
                }
            }

            setExecutionTime(performance.now() - start);

        } catch (err: any) {
            setError(err.toString());
        } finally {
            setIsRunning(false);
        }
    }, [connectionId]);

    return {
        runQuery,
        results,
        columns,
        isRunning,
        error,
        executionTime
    };
}
