import type { ConnectionInfo } from "@/lib/bindings";

export const MOCK_CONNECTIONS: ConnectionInfo[] = [
    {
        id: "demo-ecommerce-001",
        name: "Demo E-Commerce (PostgreSQL)",
        connected: true,
        database_type: {
            Postgres: {
                connection_string: "postgresql://demo:demo@localhost:5432/ecommerce",
                ssh_config: null
            }
        },
        last_connected_at: Date.now() - 3600000,
        created_at: Date.now() - 86400000 * 30,
        updated_at: Date.now() - 3600000,
        pin_hash: null,
        favorite: true,
        color: "#10b981",
        sort_order: 0,
    },
    {
        id: "demo-blog-002",
        name: "Demo Blog CMS (SQLite)",
        connected: false,
        database_type: {
            SQLite: {
                db_path: "/data/blog.sqlite"
            }
        },
        last_connected_at: Date.now() - 86400000,
        created_at: Date.now() - 86400000 * 60,
        updated_at: Date.now() - 86400000,
        pin_hash: null,
        favorite: false,
        color: "#3b82f6",
        sort_order: 1,
    },
    {
        id: "demo-analytics-003",
        name: "Analytics Platform (PostgreSQL)",
        connected: false,
        database_type: {
            Postgres: {
                connection_string: "postgresql://analytics:password@localhost:5432/analytics",
                ssh_config: null
            }
        },
        last_connected_at: Date.now() - 86400000 * 2,
        created_at: Date.now() - 86400000 * 90,
        updated_at: Date.now() - 86400000 * 2,
        pin_hash: null,
        favorite: true,
        color: "#8b5cf6",
        sort_order: 2,
    },
    {
        id: "demo-hr-004",
        name: "HR System (PostgreSQL)",
        connected: false,
        database_type: {
            Postgres: {
                connection_string: "postgresql://hr:password@localhost:5432/hr",
                ssh_config: null
            }
        },
        last_connected_at: Date.now() - 86400000 * 5,
        created_at: Date.now() - 86400000 * 120,
        updated_at: Date.now() - 86400000 * 5,
        pin_hash: null,
        favorite: false,
        color: "#f59e0b",
        sort_order: 3,
    },
];

