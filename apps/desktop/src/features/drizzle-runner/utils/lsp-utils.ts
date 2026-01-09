import { SchemaTable } from "../types";

/**
 * Generates comprehensive, STRICT TypeScript type definitions for Monaco Editor.
 * This enables true "Pro" LSP support with type checking for Drizzle ORM.
 */
export function generateDrizzleTypes(tables: SchemaTable[]): string {
    const tableDefs = tables.map(table => {
        const columns = table.columns.map(col => {
            let tsType = "unknown";
            // Map SQL types to TS types consistently
            if (/int|serial|decimal|double|float|numeric|real/.test(col.type)) {
                tsType = "number";
            } else if (/char|text|uuid|json|enum/.test(col.type)) {
                tsType = "string";
            } else if (/bool/.test(col.type)) {
                tsType = "boolean";
            } else if (/timestamp|date|time/.test(col.type)) {
                tsType = "Date";
            }
            return `    /** ${col.type} */\n    ${col.name}: Column<${tsType}>;`;
        }).join("\n");

        // The "Model" - what a row looks like (e.g. { id: number, name: string })
        const modelColumns = table.columns.map(col => {
            let tsType = "unknown";
            if (/int|serial|decimal|double|float|numeric|real/.test(col.type)) {
                tsType = "number";
            } else if (/char|text|uuid|json|enum/.test(col.type)) {
                tsType = "string";
            } else if (/bool/.test(col.type)) {
                tsType = "boolean";
            } else if (/timestamp|date|time/.test(col.type)) {
                tsType = "Date";
            }
            // Nullability
            if (col.nullable) {
                tsType = `${tsType} | null`;
            }
            return `    ${col.name}: ${tsType};`;
        }).join("\n");

        return `
/** Table definition for ${table.name} usage in query builder */
interface ${capitalize(table.name)}Schema {
${columns}
}

/** Row model for ${table.name} */
interface ${capitalize(table.name)}Model {
${modelColumns}
}

/** The table object for '${table.name}' */
declare const ${table.name}: Table<'${table.name}', ${capitalize(table.name)}Schema>;
`;
    }).join("\n");

    const tableNamesUnion = tables.length > 0
        ? tables.map(t => `typeof ${t.name}`).join(" | ")
        : "never";

    return `
/**
 * DRIZZLE ORM STRICT TYPE DEFINITIONS
 * Generated for Monaco Editor
 */

// --- Base Types ---

/** A column reference in a query (e.g. users.id) */
interface Column<T> {
    _brand: 'Column';
    _type: T;
}

/** A SQL expression or condition */
interface SQL<T = unknown> {
    _brand: 'SQL';
    _type: T;
}

/** A table definition definition used in .from() */
interface Table<TName extends string, TSchema> {
    _brand: 'Table';
    _: {
        name: TName;
        schema: TSchema;
    };
}

// Ensure TSchema is compliant with the shape of a table schema
type AnyTable = Table<string, any>;

// --- Generated Tables ---
${tableDefs}

// --- Query Builder ---

interface QueryBuilder<TResult> {
    /** 
     * Filter results with a WHERE clause.
     * Use helper functions like eq(), gt(), and(), etc.
     */
    where(condition: SQL<boolean> | undefined): QueryBuilder<TResult>;
    
    /** Order results by specific columns */
    orderBy(...columns: (Column<any> | SQL<any>)[]): QueryBuilder<TResult>;
    
    /** Group results by columns */
    groupBy(...columns: Column<any>[]): QueryBuilder<TResult>; // Simplified for now but generic enough
    
    /** Limit the number of returned rows */
    limit(limit: number): QueryBuilder<TResult>;
    
    /** Offset the returned rows */
    offset(offset: number): QueryBuilder<TResult>;
    
    /** 
     * Left join another table.
     * @param table The table to join
     * @param condition The ON condition (e.g. eq(users.id, posts.userId))
     */
    leftJoin<TR extends AnyTable>(table: TR, condition: SQL<boolean>): QueryBuilder<TResult>;
    
    innerJoin<TR extends AnyTable>(table: TR, condition: SQL<boolean>): QueryBuilder<TResult>;
    
    rightJoin<TR extends AnyTable>(table: TR, condition: SQL<boolean>): QueryBuilder<TResult>;
    
    fullJoin<TR extends AnyTable>(table: TR, condition: SQL<boolean>): QueryBuilder<TResult>;

    /** Execute the query and get the results */
    execute(): Promise<TResult[]>;
    
    /** Get generated SQL */
    toSQL(): { sql: string; params: any[] };
}

// --- The Database Object ---

interface DB {
    /**
     * Start a SELECT query.
     * Chain .from(table) to select from a table.
     */
    select(): SelectBuilder;
    
    /**
     * Start a SELECT query for specific fields.
     */
    select<TSelection extends Record<string, Column<any> | SQL<any>>>(
        fields: TSelection
    ): SelectBuilder<TSelection>;

    /** Start an INSERT query */
    insert<TName extends string, TSchema>(table: Table<TName, TSchema>): InsertBuilder<TSchema>;
    
    /** Start an UPDATE query */
    update<TName extends string, TSchema>(table: Table<TName, TSchema>): UpdateBuilder<TSchema>;
    
    /** Start a DELETE query */
    delete<TName extends string, TSchema>(table: Table<TName, TSchema>): DeleteBuilder;

    /** Execute raw SQL */
    execute(query: SQL<any>): Promise<any>;
}

interface SelectBuilder<TSelection = any> {
    /**
     * Specify the table to select from.
     * This infers the result type based on the table model.
     */
    from<TName extends string, TSchema>(
        table: Table<TName, TSchema>
    ): QueryBuilder<InferModelFromSchema<TSchema>>;
}

// Helper to infer the Model from the Schema (hack since we generated them separately but structured similarly)
// In reality, we just map Schema keys to types.
// For the purpose of this mock, we used declared interfaces.
// Let's use a trick: The Schema has Column<T>, the Result has T.
type InferModelFromSchema<TSchema> = {
    [K in keyof TSchema]: TSchema[K] extends Column<infer T> ? T : never;
};


interface InsertBuilder<TSchema> {
    /** Provide values to insert */
    values(values: InferInsertModel<TSchema> | InferInsertModel<TSchema>[]): {
        returning(): Promise<InferModelFromSchema<TSchema>[]>;
        execute(): Promise<void>;
    };
}

interface UpdateBuilder<TSchema> {
    /** Provide new values */
    set(values: Partial<InferInsertModel<TSchema>>): {
        where(condition: SQL<boolean>): {
             returning(): Promise<InferModelFromSchema<TSchema>[]>;
             execute(): Promise<void>;
        };
    };
}

interface DeleteBuilder {
    where(condition: SQL<boolean>): {
        returning(): Promise<any[]>;
        execute(): Promise<void>;
    };
}

// Helper to extract T from Column<T> for insert models
type InferInsertModel<TSchema> = {
    [K in keyof TSchema]?: TSchema[K] extends Column<infer T> ? T : never;
};

declare const db: DB;


// --- Helper Functions (Strictly Typed) ---

/** Checks if column equals value */
declare function eq<T>(column: Column<T>, value: T): SQL<boolean>;

/** Checks if column does not equal value */
declare function ne<T>(column: Column<T>, value: T): SQL<boolean>;

/** Checks if column is greater than value */
declare function gt<T>(column: Column<T>, value: T): SQL<boolean>;

/** Checks if column is less than value */
declare function lt<T>(column: Column<T>, value: T): SQL<boolean>;

/** Checks if column is greater or equal */
declare function gte<T>(column: Column<T>, value: T): SQL<boolean>;

/** Checks if column is less or equal */
declare function lte<T>(column: Column<T>, value: T): SQL<boolean>;

/** Checks if column is in array of values */
declare function inArray<T>(column: Column<T>, values: T[]): SQL<boolean>;

/** Checks if column is NOT in array */
declare function notInArray<T>(column: Column<T>, values: T[]): SQL<boolean>;

/** Checks if column is NULL */
declare function isNull(column: Column<any>): SQL<boolean>;

/** Checks if column is NOT NULL */
declare function isNotNull(column: Column<any>): SQL<boolean>;

/** 
 * Fuzzy match. 
 * Note: Only works on string columns.
 */
declare function like(column: Column<string>, pattern: string): SQL<boolean>;
declare function ilike(column: Column<string>, pattern: string): SQL<boolean>;

/** Combine conditions */
declare function and(...conditions: (SQL<boolean> | undefined)[]): SQL<boolean>;
declare function or(...conditions: (SQL<boolean> | undefined)[]): SQL<boolean>;
declare function not(condition: SQL<boolean>): SQL<boolean>;

/** Sorting */
declare function asc(column: Column<any>): SQL<any>;
declare function desc(column: Column<any>): SQL<any>;

/** Aggregates */
declare function count(): SQL<number>;
declare function count(column: Column<any>): SQL<number>;
declare function sum(column: Column<number>): SQL<number>;
declare function avg(column: Column<number>): SQL<number>;
declare function min<T>(column: Column<T>): SQL<T>;
declare function max<T>(column: Column<T>): SQL<T>;

/** Raw SQL */
declare function sql<T = unknown>(strings: TemplateStringsArray, ...values: any[]): SQL<T>;

`;
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// Exports for the editor to use for completion triggers (if needed)

export function getDrizzleHelpers(): string[] {
    return [
        "eq", "ne", "gt", "lt", "gte", "lte",
        "like", "ilike", "inArray", "notInArray",
        "isNull", "isNotNull",
        "and", "or", "not",
        "asc", "desc",
        "count", "sum", "avg", "min", "max",
        "sql"
    ];
}

export function getTableNames(tables: SchemaTable[]): string[] {
    return tables.map(t => t.name);
}

export function getColumnNames(tables: SchemaTable[], tableName: string): string[] {
    const table = tables.find(t => t.name === tableName);
    return table ? table.columns.map(c => c.name) : [];
}
