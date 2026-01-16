/**
 * Database Provider Utilities
 * 
 * Centralized provider configuration and connection URL handling.
 * This module provides enterprise-grade utilities for managing database connections
 * across different providers (PostgreSQL, MySQL, SQLite, LibSQL, etc.).
 */

import { DatabaseType } from "../types";

/**
 * Provider metadata including defaults and URL patterns
 */
export interface ProviderConfig {
    /** Display name */
    name: string;
    /** Default port */
    defaultPort: number;
    /** Default username */
    defaultUser: string;
    /** Default database name */
    defaultDatabase: string;
    /** URL protocol(s) */
    protocols: string[];
    /** Whether SSL is supported */
    supportsSSL: boolean;
}

/**
 * Provider detection patterns based on hostname
 */
export interface ProviderPattern {
    /** Hostname pattern to match */
    pattern: RegExp | string;
    /** Display name for detected provider */
    displayName: string;
    /** Provider type (optional) */
    type?: DatabaseType;
}

/**
 * Centralized provider configurations
 */
export const PROVIDER_CONFIGS: Record<DatabaseType, ProviderConfig> = {
    postgres: {
        name: "PostgreSQL",
        defaultPort: 5432,
        defaultUser: "postgres",
        defaultDatabase: "postgres",
        protocols: ["postgresql", "postgres"],
        supportsSSL: true,
    },
    mysql: {
        name: "MySQL",
        defaultPort: 3306,
        defaultUser: "root",
        defaultDatabase: "mysql",
        protocols: ["mysql"],
        supportsSSL: true,
    },
    sqlite: {
        name: "SQLite",
        defaultPort: 0,
        defaultUser: "",
        defaultDatabase: "",
        protocols: ["sqlite"],
        supportsSSL: false,
    },
    libsql: {
        name: "LibSQL",
        defaultPort: 0,
        defaultUser: "",
        defaultDatabase: "",
        protocols: ["libsql"],
        supportsSSL: false,
    },
};

/**
 * Known provider patterns for auto-detection
 */
export const PROVIDER_PATTERNS: ProviderPattern[] = [
    { pattern: "supabase", displayName: "Supabase DB", type: "postgres" },
    { pattern: "neon", displayName: "Neon DB", type: "postgres" },
    { pattern: "turso", displayName: "Turso DB", type: "libsql" },
    { pattern: "planetscale", displayName: "PlanetScale DB", type: "mysql" },
    { pattern: "railway", displayName: "Railway DB" },
    { pattern: "render", displayName: "Render DB" },
    { pattern: "vercel", displayName: "Vercel DB", type: "postgres" },
    { pattern: /aws.*rds/, displayName: "AWS RDS" },
    { pattern: "azure", displayName: "Azure DB" },
    { pattern: /gcp|google.*cloud/, displayName: "Google Cloud SQL" },
];

/**
 * Connection string builder parameters
 */
export interface ConnectionParams {
    type: DatabaseType;
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    ssl?: boolean;
}

/**
 * Builds a connection string from individual parameters
 */
export function buildConnectionString(params: ConnectionParams): string {
    const config = PROVIDER_CONFIGS[params.type];

    if (params.type === "sqlite") {
        throw new Error("SQLite uses file paths, not connection strings");
    }

    if (params.type === "libsql") {
        throw new Error("LibSQL requires a URL and auth token");
    }

    const user = params.user || config.defaultUser;
    const password = params.password || "";
    const host = params.host || "localhost";
    const port = params.port || config.defaultPort;
    const database = params.database || config.defaultDatabase;

    // Build base URL
    const protocol = config.protocols[0];
    let url = `${protocol}://${user}`;

    if (password) {
        url += `:${password}`;
    }

    url += `@${host}:${port}/${database}`;

    // Add SSL parameter if enabled
    if (params.ssl && config.supportsSSL) {
        url += "?sslmode=require";
    }

    return url;
}

/**
 * Calculates the Levenshtein distance between two strings.
 * Used for typo detection in connection protocols.
 */
function levenshtein(a: string, b: string): number {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1  // deletion
                    )
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

interface ProtocolMatch {
    type: DatabaseType;
    normalizedDistance: number;
    sharesPrefix: boolean;
}

function findClosestProtocol(input: string): DatabaseType | undefined {
    const MIN_PROTOCOL_LENGTH = 4;
    const MAX_NORMALIZED_DISTANCE = 0.4;
    const PREFIX_BONUS_THRESHOLD = 0.6;
    const PREFIX_LENGTH = 3;

    if (input.length < MIN_PROTOCOL_LENGTH) {
        return undefined;
    }

    const inputLower = input.toLowerCase();
    let bestMatch: ProtocolMatch | undefined;

    for (const [dbType, config] of Object.entries(PROVIDER_CONFIGS)) {
        for (const proto of config.protocols) {
            const protoLower = proto.toLowerCase();
            const distance = levenshtein(inputLower, protoLower);
            const maxLength = Math.max(inputLower.length, protoLower.length);
            const normalizedDistance = distance / maxLength;

            const sharesPrefix = inputLower.slice(0, PREFIX_LENGTH) === protoLower.slice(0, PREFIX_LENGTH);

            const isAcceptable = sharesPrefix
                ? normalizedDistance <= PREFIX_BONUS_THRESHOLD
                : normalizedDistance <= MAX_NORMALIZED_DISTANCE;

            if (!isAcceptable) {
                continue;
            }

            if (!bestMatch || normalizedDistance < bestMatch.normalizedDistance) {
                bestMatch = {
                    type: dbType as DatabaseType,
                    normalizedDistance,
                    sharesPrefix,
                };
            }
        }
    }

    return bestMatch?.type;
}

/**
 * Parses a connection URL to extract components
 */
export function parseConnectionUrl(url: string): Partial<ConnectionParams> | null {
    try {
        const parsed = new URL(url);
        // Remove trailing colon from protocol (e.g., "postgres:" -> "postgres")
        const protocol = parsed.protocol.replace(":", "");

        // Determine database type from protocol
        let type: DatabaseType | undefined;
        
        // 1. Try exact match first
        for (const [dbType, config] of Object.entries(PROVIDER_CONFIGS)) {
            if (config.protocols.includes(protocol)) {
                type = dbType as DatabaseType;
                break;
            }
        }

        // 2. If no exact match, try fuzzy matching (typo detection)
        if (!type) {
            type = findClosestProtocol(protocol);
        }

        if (!type) {
            return null;
        }

        const params: Partial<ConnectionParams> = {
            type,
            host: parsed.hostname,
            port: parsed.port ? parseInt(parsed.port) : undefined,
            user: parsed.username || undefined,
            password: parsed.password || undefined,
            database: parsed.pathname.slice(1) || undefined, // Remove leading slash
        };

        // Check for SSL in query params
        const searchParams = new URLSearchParams(parsed.search);
        if (searchParams.has("sslmode") || searchParams.has("ssl")) {
            params.ssl = true;
        }

        return params;
    } catch {
        return null;
    }
}

/**
 * Detects provider from hostname and returns a friendly name
 */
export function detectProviderName(url: string): string {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();

        // Check against known patterns
        for (const pattern of PROVIDER_PATTERNS) {
            const matches = typeof pattern.pattern === "string"
                ? hostname.includes(pattern.pattern)
                : pattern.pattern.test(hostname);

            if (matches) {
                return pattern.displayName;
            }
        }

        // Fallback: use first part of hostname
        const parts = hostname.split(".");
        const name = parts[0] || "Database";
        return name.charAt(0).toUpperCase() + name.slice(1) + " DB";
    } catch {
        return "New Connection";
    }
}

/**
 * Checks if a string is a valid connection URL
 */
export function isValidConnectionUrl(text: string): boolean {
    const trimmed = text.trim();
    const allProtocols = Object.values(PROVIDER_CONFIGS)
        .flatMap(config => config.protocols);

    const pattern = new RegExp(`^(${allProtocols.join("|")})://`, "i");
    return pattern.test(trimmed);
}

/**
 * Gets connection field defaults for a database type
 */
export function getConnectionDefaults(type: DatabaseType): Partial<ConnectionParams> {
    const config = PROVIDER_CONFIGS[type];

    return {
        type,
        host: "localhost",
        port: config.defaultPort > 0 ? config.defaultPort : undefined,
        user: config.defaultUser || undefined,
        database: config.defaultDatabase || undefined,
        ssl: false,
    };
}

/**
 * Strips matching outer quotes (single or double) from a string.
 */
function stripQuotes(s: string): string {
    const trimmed = s.trim();
    if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
        (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

/**
 * Connection URL Sanitizer
 * 
 * Normalizes wrapper formats around an already valid connection URL.
 * This is NOT a universal connection string parser.
 * 
 * SUPPORTED INPUT SHAPES:
 * - Plain URL: postgresql://user:pass@host/db, libsql://db.turso.io
 * - URL wrapped in quotes: "postgresql://...", 'libsql://...'
 * - psql wrapper: psql "postgresql://...", psql 'postgresql://...'
 * - Single env var assignment: DATABASE_URL=postgresql://..., DB_URL="libsql://..."
 * - Combined: DATABASE_URL="psql 'postgresql://...'"
 * 
 * EXPLICITLY NOT SUPPORTED:
 * - libpq key-value strings (host=localhost user=me dbname=test)
 * - Multiple assignments in one line
 * - Shell expansions ($VAR, $(cmd))
 * - Multiline values
 * - Escaped or nested quotes
 * - URLs embedded in freeform text
 * - Non-URL based connection formats
 * 
 * DIALECT RULE:
 * The sanitizer is dialect-agnostic. It only strips wrappers and never
 * validates or interprets the scheme. Dialect handling belongs in a
 * separate parser layer.
 */
export function sanitizeConnectionUrl(input: string): string {
    let value = input.trim();

    // Bail early if empty or multiline (not supported)
    if (!value || value.includes('\n')) {
        return value;
    }

    // Step 1: Strip single environment variable assignment prefix
    // Matches: VAR_NAME=value, VAR_NAME="value", VAR_NAME='value'
    // Does NOT match: multiple assignments or shell expansions
    const envVarPattern = /^([A-Z_][A-Z0-9_]*)\s*=\s*(.+)$/i;
    const envVarMatch = value.match(envVarPattern);
    if (envVarMatch) {
        const assignedValue = envVarMatch[2];
        // Check for shell expansion or multiple assignments (not supported)
        if (assignedValue.startsWith('$') || assignedValue.includes(' ') && assignedValue.includes('=')) {
            return value; // Return as-is, let the dialect parser handle it
        }
        value = assignedValue;
    }

    // Step 2: Strip outer quotes (single or double)
    value = stripQuotes(value);

    // Step 3: Strip psql command wrapper
    // Matches: psql "url", psql 'url', psql url
    const psqlPattern = /^psql\s+(.+)$/i;
    const psqlMatch = value.match(psqlPattern);
    if (psqlMatch) {
        value = stripQuotes(psqlMatch[1].trim());
    }

    // Step 4: Strip any remaining outer quotes
    value = stripQuotes(value);

    return value;
}
