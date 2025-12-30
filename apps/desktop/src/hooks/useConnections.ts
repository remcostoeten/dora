import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { ConnectionInfo, DatabaseInfo } from '@/lib/bindings';

export function useConnections() {
    const [connections, setConnections] = useState<ConnectionInfo[]>([]);
    const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchConnections = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await api.getConnections();
            setConnections(data);
            setError(null);
        } catch (err: any) {
            setError(err.toString());
        } finally {
            setIsLoading(false);
        }
    }, []);

    const connect = useCallback(async (id: string) => {
        try {
            setIsLoading(true);
            await api.connectToDatabase(id);
            setActiveConnectionId(id);
            setError(null);
        } catch (err: any) {
            setError(`Failed to connect: ${err.toString()}`);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createConnection = useCallback(async (name: string, info: DatabaseInfo) => {
        try {
            setIsLoading(true);
            await api.addConnection(name, info, null);
            await fetchConnections();
        } catch (err: any) {
            setError(`Failed to create connection: ${err.toString()}`);
        } finally {
            setIsLoading(false);
        }
    }, [fetchConnections]);

    useEffect(() => {
        fetchConnections();
    }, [fetchConnections]);

    return {
        connections,
        activeConnectionId,
        isLoading,
        error,
        fetchConnections,
        connect,
        createConnection
    };
}
