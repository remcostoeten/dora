export type DatabaseType = "postgres" | "mysql" | "sqlite" | "libsql";

export type SshAuthMethod = "password" | "keyfile";

export interface SshTunnelConfig {
    enabled: boolean;
    host: string;
    port: number;
    username: string;
    authMethod: SshAuthMethod;
    password?: string;
    privateKeyPath?: string;
}

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
    url?: string;
    authToken?: string;
    status?: "connected" | "error" | "idle";
    error?: string;
    sshConfig?: SshTunnelConfig;
    createdAt: number;
}

export const DEFAULT_PORTS: Record<DatabaseType, number> = {
    postgres: 5432,
    mysql: 3306,
    sqlite: 0,
    libsql: 0,
};
