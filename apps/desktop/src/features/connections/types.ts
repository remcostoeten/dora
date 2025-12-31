export type DatabaseType = "postgres" | "mysql" | "sqlite" | "libsql";

export interface Connection {
    id: string;
    name: string;
    type: DatabaseType;
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    ssl?: boolean;
    url?: string; // For full connection strings, SQLite paths, or Turso URLs
    authToken?: string; // For LibSQL/Turso authentication
    status?: "connected" | "error" | "idle"; // Connection health status
    error?: string; // Error message if status is 'error'
    createdAt: number;
}

export const DEFAULT_PORTS: Record<DatabaseType, number> = {
    postgres: 5432,
    mysql: 3306,
    sqlite: 0,
    libsql: 0,
};
