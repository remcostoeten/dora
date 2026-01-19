import type { ConnectionEnvVars } from "../types";

export function buildDatabaseUrl(
    host: string,
    port: number,
    user: string,
    password: string,
    database: string
): string {
    const encodedPassword = encodeURIComponent(password);
    return `postgres://${user}:${encodedPassword}@${host}:${port}/${database}`;
}

export function buildConnectionEnvVars(
    host: string,
    port: number,
    user: string,
    password: string,
    database: string
): ConnectionEnvVars {
    return {
        DATABASE_URL: buildDatabaseUrl(host, port, user, password, database),
        PGHOST: host,
        PGPORT: String(port),
        PGUSER: user,
        PGPASSWORD: password,
        PGDATABASE: database,
    };
}

export function formatEnvVarsForClipboard(envVars: ConnectionEnvVars): string {
    return Object.entries(envVars)
        .map(function ([key, value]) {
            return `${key}=${value}`;
        })
        .join("\n");
}

export function parseConnectionString(connectionString: string): {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
} | null {
    try {
        const url = new URL(connectionString);
        return {
            host: url.hostname,
            port: parseInt(url.port || "5432", 10),
            user: url.username,
            password: decodeURIComponent(url.password),
            database: url.pathname.slice(1),
        };
    } catch {
        return null;
    }
}

export function maskPassword(envString: string): string {
    return envString.replace(
        /(PGPASSWORD=|:\/\/[^:]+:)([^@\n]+)/g,
        function (match, prefix) {
            return prefix + "••••••••";
        }
    );
}
