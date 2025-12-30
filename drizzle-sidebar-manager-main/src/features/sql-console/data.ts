import { SqlSnippet, SqlQueryResult, TableInfo } from "./types";

// Mock snippets data
export const MOCK_SNIPPETS: SqlSnippet[] = [
    {
        id: "playground",
        name: "Playground",
        content: "SELECT * FROM customers LIMIT 10;",
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        id: "scratch-1",
        name: "SQL scratch #1",
        content: "SELECT id, company_name, city FROM customers WHERE country = 'Germany';",
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        id: "scratch-2",
        name: "SQL scratch #2",
        content: "SELECT * FROM orders WHERE freight > 50 ORDER BY order_date DESC;",
        createdAt: new Date(),
        updatedAt: new Date(),
    },
];

// Mock tables for the schema browser
export const MOCK_TABLES: TableInfo[] = [
    { name: "categories", type: "table", rowCount: 8 },
    { name: "customers", type: "table", rowCount: 93 },
    { name: "employee_territories", type: "table", rowCount: 49 },
    { name: "employees", type: "table", rowCount: 9 },
    { name: "order_details", type: "table", rowCount: 2155 },
    { name: "orders", type: "table", rowCount: 830 },
    { name: "products", type: "table", rowCount: 77 },
    { name: "regions", type: "table", rowCount: 4 },
    { name: "shippers", type: "table", rowCount: 3 },
    { name: "suppliers", type: "table", rowCount: 29 },
    { name: "territories", type: "table", rowCount: 53 },
    { name: "customer_and_supplie...", type: "view", rowCount: 122 },
    { name: "invoices", type: "view", rowCount: 2155 },
];

export const DEFAULT_SQL = `-- Write your SQL query here
SELECT * FROM customers LIMIT 10;`;

// Simulate SQL query execution
export async function executeSqlQuery(sql: string): Promise<SqlQueryResult> {
    await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 500));

    const upperSql = sql.toUpperCase().trim();

    // Detect query type
    let queryType: SqlQueryResult["queryType"] = "OTHER";
    if (upperSql.startsWith("SELECT")) queryType = "SELECT";
    else if (upperSql.startsWith("INSERT")) queryType = "INSERT";
    else if (upperSql.startsWith("UPDATE")) queryType = "UPDATE";
    else if (upperSql.startsWith("DELETE")) queryType = "DELETE";

    // Handle syntax errors
    if (!sql.trim() || sql.trim() === "--") {
        return {
            columns: [],
            rows: [],
            rowCount: 0,
            executionTime: 0,
            error: "Empty query",
            queryType: "OTHER",
        };
    }

    // Mock responses based on query content
    if (upperSql.includes("FROM CUSTOMERS")) {
        return {
            columns: ["id", "company_name", "contact_name", "city", "country", "phone"],
            rows: [
                { id: "ALFKI", company_name: "Alfreds Futterkiste", contact_name: "Maria Anders", city: "Berlin", country: "Germany", phone: "030-0074321" },
                { id: "ANATR", company_name: "Ana Trujillo Emparedados", contact_name: "Ana Trujillo", city: "México D.F.", country: "Mexico", phone: "(5) 555-4729" },
                { id: "ANTON", company_name: "Antonio Moreno Taquería", contact_name: "Antonio Moreno", city: "México D.F.", country: "Mexico", phone: "(5) 555-3932" },
                { id: "AROUT", company_name: "Around the Horn", contact_name: "Thomas Hardy", city: "London", country: "UK", phone: "(171) 555-7788" },
                { id: "BERGS", company_name: "Berglunds snabbköp", contact_name: "Christina Berglund", city: "Luleå", country: "Sweden", phone: "0921-12 34 65" },
                { id: "BLAUS", company_name: "Blauer See Delikatessen", contact_name: "Hanna Moos", city: "Mannheim", country: "Germany", phone: "0621-08460" },
                { id: "BLONP", company_name: "Blondesddsl père et fils", contact_name: "Frédérique Citeaux", city: "Strasbourg", country: "France", phone: "88.60.15.31" },
                { id: "BOLID", company_name: "Bólido Comidas preparadas", contact_name: "Martín Sommer", city: "Madrid", country: "Spain", phone: "(91) 555 22 82" },
            ],
            rowCount: 8,
            executionTime: 13,
            queryType,
        };
    }

    if (upperSql.includes("FROM ORDERS")) {
        return {
            columns: ["order_id", "customer_id", "employee_id", "order_date", "shipped_date", "freight"],
            rows: [
                { order_id: 10248, customer_id: "VINET", employee_id: 5, order_date: "1996-07-04", shipped_date: "1996-07-16", freight: 32.38 },
                { order_id: 10249, customer_id: "TOMSP", employee_id: 6, order_date: "1996-07-05", shipped_date: "1996-07-10", freight: 11.61 },
                { order_id: 10250, customer_id: "HANAR", employee_id: 4, order_date: "1996-07-08", shipped_date: "1996-07-12", freight: 65.83 },
                { order_id: 10251, customer_id: "VICTE", employee_id: 3, order_date: "1996-07-08", shipped_date: "1996-07-15", freight: 41.34 },
                { order_id: 10252, customer_id: "SUPRD", employee_id: 4, order_date: "1996-07-09", shipped_date: "1996-07-11", freight: 51.30 },
            ],
            rowCount: 5,
            executionTime: 8,
            queryType,
        };
    }

    if (upperSql.includes("FROM PRODUCTS")) {
        return {
            columns: ["product_id", "product_name", "unit_price", "units_in_stock", "discontinued"],
            rows: [
                { product_id: 1, product_name: "Chai", unit_price: 18.00, units_in_stock: 39, discontinued: false },
                { product_id: 2, product_name: "Chang", unit_price: 19.00, units_in_stock: 17, discontinued: false },
                { product_id: 3, product_name: "Aniseed Syrup", unit_price: 10.00, units_in_stock: 13, discontinued: false },
            ],
            rowCount: 3,
            executionTime: 6,
            queryType,
        };
    }

    // Default empty response
    return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTime: 5,
        queryType,
    };
}

// Format SQL for prettify
export function prettifySql(sql: string): string {
    const keywords = ["SELECT", "FROM", "WHERE", "AND", "OR", "ORDER BY", "GROUP BY", "HAVING", "LIMIT", "OFFSET", "JOIN", "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "ON", "AS", "INSERT INTO", "VALUES", "UPDATE", "SET", "DELETE FROM"];

    let formatted = sql.trim();

    // Add newlines before major keywords
    keywords.forEach((kw) => {
        const regex = new RegExp(`\\b${kw}\\b`, "gi");
        formatted = formatted.replace(regex, `\n${kw}`);
    });

    // Clean up multiple newlines
    formatted = formatted.replace(/\n\n+/g, "\n").trim();

    return formatted;
}
