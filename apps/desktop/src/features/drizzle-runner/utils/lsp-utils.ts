import { SchemaTable } from "../types";

/**
 * Generates comprehensive TypeScript type definitions for Monaco Editor
 * to enable Drizzle ORM autocompletion and type checking.
 */
export function generateDrizzleTypes(tables: SchemaTable[]): string {
    // Generate table interfaces with column types
    const tableInterfaces = tables.map(table => {
        const columns = table.columns.map(col => {
            let tsType = "any";
            if (col.type.includes("integer") || col.type.includes("serial") || col.type.includes("decimal") || col.type.includes("smallint")) {
                tsType = "number";
            } else if (col.type.includes("varchar") || col.type.includes("text")) {
                tsType = "string";
            } else if (col.type.includes("boolean")) {
                tsType = "boolean";
            } else if (col.type.includes("timestamp") || col.type.includes("date")) {
                tsType = "Date";
            }
            return `    ${col.name}: ${tsType};`;
        }).join("\n");

        const tableName = capitalize(table.name);
        return `
/** Table: ${table.name} */
interface ${tableName}Table {
${columns}
}

/** Column references for ${table.name} */
declare const ${table.name}: {
${table.columns.map(col => `    /** Column: ${col.name} (${col.type}) */\n    ${col.name}: any;`).join("\n")}
};
`;
    }).join("\n");

    // Generate table names union type
    const tableNames = tables.map(t => `typeof ${t.name}`).join(" | ");

    return `
// ============================================
// DRIZZLE ORM TYPE DEFINITIONS
// ============================================

// Query Builder - Chainable query methods
interface QueryBuilder {
    /** Specify the table to select from */
    from(table: ${tableNames || "any"}): QueryBuilder;
    /** Add WHERE conditions - use eq(), ne(), gt(), lt(), etc. */
    where(condition: any): QueryBuilder;
    /** Limit the number of results */
    limit(n: number | any): QueryBuilder;
    /** Skip N results */
    offset(n: number | any): QueryBuilder;
    /** Order results by column - use asc() or desc() */
    orderBy(...columns: any[]): QueryBuilder;
    /** Group results by column */
    groupBy(...columns: any[]): QueryBuilder;
    /** Add HAVING clause for aggregated results */
    having(condition: any): QueryBuilder;
    /** LEFT JOIN another table */
    leftJoin(table: any, condition: any): QueryBuilder;
    /** INNER JOIN another table */
    innerJoin(table: any, condition: any): QueryBuilder;
    /** RIGHT JOIN another table */
    rightJoin(table: any, condition: any): QueryBuilder;
    /** FULL JOIN another table */
    fullJoin(table: any, condition: any): QueryBuilder;
    /** Return specific columns after write operation */
    returning(columns?: any): QueryBuilder;
    /** Prepare the statement */
    prepare(name: string): QueryBuilder;
    /** Execute the statement */
    execute(): Promise<any[]>;
    /** Get generated SQL string */
    toSQL(): { sql: string, params: any[] };
}

// Database instance with query methods
interface DrizzleDatabase {
    /** Start a SELECT query - chain with .from(table) */
    select(): QueryBuilder;
    /** Select specific columns */
    select(columns: Record<string, any>): QueryBuilder;
    /** Select distinct rows */
    selectDistinct(): QueryBuilder;
    /** Select count of rows */
    $count(table: any, condition?: any): Promise<number>;
    
    /** Start an INSERT query */
    insert(table: any): { values(data: any | any[]): QueryBuilder };
    /** Start an UPDATE query */
    update(table: any): { set(data: any): QueryBuilder };
    /** Start a DELETE query */
    delete(table: any): QueryBuilder;
    
    /** Execute a transaction */
    transaction(callback: (tx: DrizzleDatabase) => Promise<any>): Promise<any>;
    
    /** Execute raw SQL */
    execute(query: any): Promise<any>;
}

/** The database instance - start queries with db.select(), db.insert(), etc. */
declare const db: DrizzleDatabase;

// ============================================
// SQL HELPERS
// ============================================

/** Raw SQL template tag */
declare function sql(strings: TemplateStringsArray, ...values: any[]): any;

/** SQL operator helpers */
declare const sql: {
    /** Create raw SQL */
    raw(script: string): any;
    /** Empty SQL */
    empty(): any;
    /** SQL from string */
    fromList(list: any[]): any;
}

// ============================================
// COMPARISON OPERATORS (for WHERE clauses)
// ============================================

/** Equal: column = value */
declare function eq(column: any, value: any): any;

/** Not equal: column != value */
declare function ne(column: any, value: any): any;

/** Greater than: column > value */
declare function gt(column: any, value: any): any;

/** Less than: column < value */
declare function lt(column: any, value: any): any;

/** Greater or equal: column >= value */
declare function gte(column: any, value: any): any;

/** Less or equal: column <= value */
declare function lte(column: any, value: any): any;

/** Pattern match: column LIKE pattern */
declare function like(column: any, pattern: string): any;

/** Pattern match (case insensitive): column ILIKE pattern */
declare function ilike(column: any, pattern: string): any;

/** Not pattern match: column NOT LIKE pattern */
declare function notLike(column: any, pattern: string): any;

/** Not pattern match (case insensitive): column NOT ILIKE pattern */
declare function notIlike(column: any, pattern: string): any;

/** Check if column is in array of values */
declare function inArray(column: any, values: any[]): any;

/** Check if column is NOT in array of values */
declare function notInArray(column: any, values: any[]): any;

/** Check if column exists */
declare function exists(query: any): any;

/** Check if column does not exist */
declare function notExists(query: any): any;

/** Check if column IS NULL */
declare function isNull(column: any): any;

/** Check if column IS NOT NULL */
declare function isNotNull(column: any): any;

/** Between two values: column BETWEEN low AND high */
declare function between(column: any, low: any, high: any): any;

/** Not between two values: column NOT BETWEEN low AND high */
declare function notBetween(column: any, low: any, high: any): any;

// ============================================
// LOGICAL OPERATORS
// ============================================

/** Combine conditions with AND */
declare function and(...conditions: any[]): any;

/** Combine conditions with OR */
declare function or(...conditions: any[]): any;

/** Negate a condition: NOT condition */
declare function not(condition: any): any;

// ============================================
// ORDER BY HELPERS
// ============================================

/** Sort ascending */
declare function asc(column: any): any;

/** Sort descending */
declare function desc(column: any): any;

// ============================================
// AGGREGATE FUNCTIONS
// ============================================

/** Count rows */
declare function count(column?: any): any;

/** Sum values */
declare function sum(column: any): any;

/** Average value */
declare function avg(column: any): any;

/** Minimum value */
declare function min(column: any): any;

/** Maximum value */
declare function max(column: any): any;

// ============================================
// TABLE DEFINITIONS
// ============================================
${tableInterfaces}
`;
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Get all available helper function names for autocompletion
 */
export function getDrizzleHelpers(): string[] {
    return [
        "eq", "ne", "gt", "lt", "gte", "lte",
        "like", "ilike", "inArray", "notInArray",
        "isNull", "isNotNull", "between",
        "and", "or", "not",
        "asc", "desc",
        "count", "sum", "avg", "min", "max"
    ];
}

/**
 * Get table names for autocompletion
 */
export function getTableNames(tables: SchemaTable[]): string[] {
    return tables.map(t => t.name);
}

/**
 * Get column names for a specific table
 */
export function getColumnNames(tables: SchemaTable[], tableName: string): string[] {
    const table = tables.find(t => t.name === tableName);
    return table ? table.columns.map(c => c.name) : [];
}
