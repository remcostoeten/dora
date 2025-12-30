import { QueryResult, SchemaTable } from "./types";

// Mock data for demonstration - replace with real API calls later
export const MOCK_SCHEMA_TABLES: SchemaTable[] = [
    {
        name: "customers",
        columns: [
            { name: "id", type: "serial", nullable: false, primaryKey: true },
            { name: "company_name", type: "varchar(40)", nullable: false, primaryKey: false },
            { name: "contact_name", type: "varchar(30)", nullable: true, primaryKey: false },
            { name: "contact_title", type: "varchar(30)", nullable: true, primaryKey: false },
            { name: "address", type: "varchar(60)", nullable: true, primaryKey: false },
            { name: "city", type: "varchar(15)", nullable: true, primaryKey: false },
            { name: "region", type: "varchar(15)", nullable: true, primaryKey: false },
            { name: "postal_code", type: "varchar(10)", nullable: true, primaryKey: false },
            { name: "country", type: "varchar(15)", nullable: true, primaryKey: false },
            { name: "phone", type: "varchar(24)", nullable: true, primaryKey: false },
            { name: "fax", type: "varchar(24)", nullable: true, primaryKey: false },
        ],
    },
    {
        name: "orders",
        columns: [
            { name: "id", type: "serial", nullable: false, primaryKey: true },
            { name: "customer_id", type: "integer", nullable: false, primaryKey: false },
            { name: "employee_id", type: "integer", nullable: true, primaryKey: false },
            { name: "order_date", type: "timestamp", nullable: true, primaryKey: false },
            { name: "required_date", type: "timestamp", nullable: true, primaryKey: false },
            { name: "shipped_date", type: "timestamp", nullable: true, primaryKey: false },
            { name: "ship_via", type: "integer", nullable: true, primaryKey: false },
            { name: "freight", type: "decimal(10,2)", nullable: true, primaryKey: false },
        ],
    },
    {
        name: "products",
        columns: [
            { name: "id", type: "serial", nullable: false, primaryKey: true },
            { name: "name", type: "varchar(40)", nullable: false, primaryKey: false },
            { name: "supplier_id", type: "integer", nullable: true, primaryKey: false },
            { name: "category_id", type: "integer", nullable: true, primaryKey: false },
            { name: "quantity_per_unit", type: "varchar(20)", nullable: true, primaryKey: false },
            { name: "unit_price", type: "decimal(10,2)", nullable: true, primaryKey: false },
            { name: "units_in_stock", type: "smallint", nullable: true, primaryKey: false },
            { name: "discontinued", type: "boolean", nullable: false, primaryKey: false, defaultValue: "false" },
        ],
    },
];

export const DEFAULT_QUERY = `// Run Drizzle queries directly
db.select().from(customers).limit(10);`;

// Mock function to simulate query execution - replace with real backend later
export async function executeQuery(query: string): Promise<QueryResult> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));

    // Check for syntax-like errors
    if (!query.includes("db.") || !query.includes("from(")) {
        return {
            columns: [],
            rows: [],
            rowCount: 0,
            executionTime: 0,
            error: "Invalid query syntax. Please use Drizzle ORM syntax.",
        };
    }

    // Return mock data based on query content
    if (query.includes("customers")) {
        return {
            columns: ["id", "company_name", "contact_name", "city", "country"],
            rows: [
                { id: 1, company_name: "Alfreds Futterkiste", contact_name: "Maria Anders", city: "Berlin", country: "Germany" },
                { id: 2, company_name: "Ana Trujillo Emparedados", contact_name: "Ana Trujillo", city: "México D.F.", country: "Mexico" },
                { id: 3, company_name: "Antonio Moreno Taquería", contact_name: "Antonio Moreno", city: "México D.F.", country: "Mexico" },
                { id: 4, company_name: "Around the Horn", contact_name: "Thomas Hardy", city: "London", country: "UK" },
                { id: 5, company_name: "Berglunds snabbköp", contact_name: "Christina Berglund", city: "Luleå", country: "Sweden" },
            ],
            rowCount: 5,
            executionTime: 12,
        };
    }

    if (query.includes("orders")) {
        return {
            columns: ["id", "customer_id", "order_date", "freight"],
            rows: [
                { id: 10248, customer_id: 1, order_date: "2024-01-15", freight: 32.38 },
                { id: 10249, customer_id: 2, order_date: "2024-01-16", freight: 11.61 },
                { id: 10250, customer_id: 3, order_date: "2024-01-17", freight: 65.83 },
            ],
            rowCount: 3,
            executionTime: 8,
        };
    }

    // Default empty result
    return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTime: 5,
    };
}
