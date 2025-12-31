import { commands, type ConnectionInfo as BackendConnection, type DatabaseInfo } from "@/lib/bindings";
import type { Connection as FrontendConnection } from "@/features/connections/types";

export function backendToFrontendConnection(conn: BackendConnection): FrontendConnection {
  let type: "postgres" | "mysql" | "sqlite" | "libsql" = "sqlite";
  let host, port, user, database, url, authToken;

  if ("Postgres" in conn.database_type) {
    type = "postgres";
    const connString = conn.database_type.Postgres.connection_string;
    try {
      const urlObj = new URL(connString);
      host = urlObj.hostname;
      port = urlObj.port ? parseInt(urlObj.port) : 5432;
      user = urlObj.username;
      database = urlObj.pathname.slice(1);
    } catch {
      host = "localhost";
      port = 5432;
    }
    url = connString;
  } else if ("SQLite" in conn.database_type) {
    type = "sqlite";
    url = conn.database_type.SQLite.db_path;
  } else if ("LibSQL" in conn.database_type) {
    type = "libsql";
    url = conn.database_type.LibSQL.url;
    authToken = conn.database_type.LibSQL.auth_token ?? undefined;
  }

  return {
    id: conn.id,
    name: conn.name,
    type,
    host,
    port,
    user,
    database,
    url,
    authToken,
    status: conn.connected ? "connected" : "idle",
    createdAt: conn.created_at ?? Date.now(),
  };
}

export function frontendToBackendDatabaseInfo(conn: FrontendConnection): DatabaseInfo {
  if (conn.type === "postgres") {
    const connectionString = `postgresql://${conn.user ? `${conn.user}:${conn.password}@` : ""}${conn.host || "localhost"}:${conn.port || 5432}/${conn.database || "postgres"}`;
    return { Postgres: { connection_string: connectionString, ssh_config: null } };
  } else if (conn.type === "sqlite") {
    return { SQLite: { db_path: conn.url || ":memory:" } };
  } else if (conn.type === "libsql") {
    return { LibSQL: { url: conn.url || "file:local.db", auth_token: conn.authToken ?? null } };
  }
  throw new Error(`Unsupported database type: ${conn.type}`);
}

export async function loadConnections(): Promise<FrontendConnection[]> {
  const result = await commands.getConnections();
  if (result.status === "ok") {
    return result.data.map(backendToFrontendConnection);
  }
  return [];
}

export async function addConnection(conn: FrontendConnection): Promise<FrontendConnection> {
  const dbInfo = frontendToBackendDatabaseInfo(conn);
  const result = await commands.addConnection(conn.name, dbInfo, null);
  if (result.status === "ok") {
    return backendToFrontendConnection(result.data);
  }
  throw new Error(result.error as string);
}

export async function updateConnection(conn: FrontendConnection): Promise<FrontendConnection> {
  const dbInfo = frontendToBackendDatabaseInfo(conn);
  const result = await commands.updateConnection(conn.id, conn.name, dbInfo, null);
  if (result.status === "ok") {
    return backendToFrontendConnection(result.data);
  }
  throw new Error(result.error as string);
}

export async function removeConnection(connectionId: string): Promise<void> {
  const result = await commands.removeConnection(connectionId);
  if (result.status === "error") {
    throw new Error(result.error as string);
  }
}

export async function connectToDatabase(connectionId: string): Promise<boolean> {
  const result = await commands.connectToDatabase(connectionId);
  if (result.status === "ok") {
    return result.data;
  }
  throw new Error(result.error as string);
}

export async function disconnectFromDatabase(connectionId: string): Promise<void> {
  const result = await commands.disconnectFromDatabase(connectionId);
  if (result.status === "error") {
    throw new Error(result.error as string);
  }
}

export async function testConnection(conn: FrontendConnection): Promise<boolean> {
  const dbInfo = frontendToBackendDatabaseInfo(conn);
  const result = await commands.testConnection(dbInfo);
  if (result.status === "ok") {
    return result.data;
  }
  throw new Error(result.error as string);
}
