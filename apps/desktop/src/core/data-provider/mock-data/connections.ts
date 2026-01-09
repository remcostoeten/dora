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
];
