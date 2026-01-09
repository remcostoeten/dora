import type { DatabaseSchema, TableInfo, ColumnInfo } from "@/lib/bindings";

function col(name: string, type: string, nullable: boolean = true, pk: boolean = false): ColumnInfo {
    return {
        name,
        data_type: type,
        is_nullable: nullable,
        default_value: null,
        is_primary_key: pk,
        is_auto_increment: pk,
        foreign_key: null,
    };
}

const ECOMMERCE_TABLES: TableInfo[] = [
    {
        name: "customers",
        schema: "public",
        columns: [
            col("id", "serial", false, true),
            col("name", "varchar(100)", false),
            col("email", "varchar(255)", false),
            col("phone", "varchar(20)", true),
            col("city", "varchar(50)", true),
            col("country", "varchar(50)", true),
            col("created_at", "timestamp", false),
        ],
        primary_key_columns: ["id"],
        row_count_estimate: 50,
    },
    {
        name: "products",
        schema: "public",
        columns: [
            col("id", "serial", false, true),
            col("name", "varchar(200)", false),
            col("description", "text", true),
            col("price", "decimal(10,2)", false),
            col("stock", "integer", false),
            col("category", "varchar(50)", true),
            col("created_at", "timestamp", false),
        ],
        primary_key_columns: ["id"],
        row_count_estimate: 25,
    },
    {
        name: "orders",
        schema: "public",
        columns: [
            col("id", "serial", false, true),
            col("customer_id", "integer", false),
            col("total", "decimal(10,2)", false),
            col("status", "varchar(20)", false),
            col("shipping_address", "text", true),
            col("created_at", "timestamp", false),
        ],
        primary_key_columns: ["id"],
        row_count_estimate: 100,
    },
    {
        name: "order_items",
        schema: "public",
        columns: [
            col("id", "serial", false, true),
            col("order_id", "integer", false),
            col("product_id", "integer", false),
            col("quantity", "integer", false),
            col("unit_price", "decimal(10,2)", false),
        ],
        primary_key_columns: ["id"],
        row_count_estimate: 150,
    },
];

const BLOG_TABLES: TableInfo[] = [
    {
        name: "users",
        schema: "main",
        columns: [
            col("id", "integer", false, true),
            col("username", "text", false),
            col("email", "text", false),
            col("role", "text", false),
            col("bio", "text", true),
            col("avatar_url", "text", true),
            col("created_at", "text", false),
        ],
        primary_key_columns: ["id"],
        row_count_estimate: 20,
    },
    {
        name: "posts",
        schema: "main",
        columns: [
            col("id", "integer", false, true),
            col("title", "text", false),
            col("slug", "text", false),
            col("content", "text", true),
            col("excerpt", "text", true),
            col("author_id", "integer", false),
            col("status", "text", false),
            col("published_at", "text", true),
            col("created_at", "text", false),
        ],
        primary_key_columns: ["id"],
        row_count_estimate: 40,
    },
    {
        name: "comments",
        schema: "main",
        columns: [
            col("id", "integer", false, true),
            col("post_id", "integer", false),
            col("user_id", "integer", true),
            col("author_name", "text", true),
            col("body", "text", false),
            col("approved", "integer", false),
            col("created_at", "text", false),
        ],
        primary_key_columns: ["id"],
        row_count_estimate: 80,
    },
    {
        name: "tags",
        schema: "main",
        columns: [
            col("id", "integer", false, true),
            col("name", "text", false),
            col("slug", "text", false),
        ],
        primary_key_columns: ["id"],
        row_count_estimate: 15,
    },
];

export const MOCK_SCHEMAS: Record<string, DatabaseSchema> = {
    "demo-ecommerce-001": {
        tables: ECOMMERCE_TABLES,
        schemas: ["public"],
        unique_columns: ["id"],
    },
    "demo-blog-002": {
        tables: BLOG_TABLES,
        schemas: ["main"],
        unique_columns: ["id"],
    },
};
