export type TDbType =
  | "libsql"
  | "postgres"
  | "sqlite"
  | "mysql"
  | "mariadb"
  | "cockroach";

export type TConnectionStatus = "connected" | "idle" | "error";

export type TConnection = {
  id: string;
  name: string;
  type: TDbType;
  date: string;
  status: TConnectionStatus;
  location: string;
};

export const connections: TConnection[] = [
  {
    id: "demo",
    name: "Demo E-Commerce",
    type: "libsql",
    date: "Jun 5, 2026",
    status: "connected",
    location: "Remote",
  },
  {
    id: "prod",
    name: "Production API",
    type: "postgres",
    date: "Jun 4, 2026",
    status: "connected",
    location: "Neon",
  },
  {
    id: "analytics",
    name: "Analytics Warehouse",
    type: "postgres",
    date: "May 28, 2026",
    status: "idle",
    location: "Supabase",
  },
  {
    id: "mariadb",
    name: "MariaDB Replica",
    type: "mariadb",
    date: "Jun 3, 2026",
    status: "idle",
    location: "Remote",
  },
  {
    id: "staging",
    name: "Staging",
    type: "mysql",
    date: "Jun 1, 2026",
    status: "error",
    location: "Docker",
  },
  {
    id: "cockroach",
    name: "CockroachDB Cluster",
    type: "cockroach",
    date: "Jun 2, 2026",
    status: "idle",
    location: "Remote",
  },
  {
    id: "local",
    name: "Local Dev",
    type: "sqlite",
    date: "Jun 5, 2026",
    status: "connected",
    location: "Local file",
  },
];

export function findConnection(id: string): TConnection {
  return connections.find((c) => c.id === id) ?? connections[0];
}

export function formatDatabaseType(type: TDbType): string {
  switch (type) {
    case "libsql":
      return "Turso";
    case "postgres":
      return "PostgreSQL";
    case "sqlite":
      return "SQLite";
    case "mysql":
      return "MySQL";
    case "mariadb":
      return "MariaDB";
    case "cockroach":
      return "CockroachDB";
    default:
      return "Database";
  }
}

export function connectionStatusColor(status: TConnectionStatus): string {
  switch (status) {
    case "connected":
      return "bg-green-500";
    case "error":
      return "bg-red-500";
    default:
      return "bg-amber-500";
  }
}
