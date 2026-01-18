/**
 * LSP autocomplete pattern matchers for Drizzle ORM.
 *
 * These helpers are used by both the CodeEditor component and its tests
 * to identify query context and provide intelligent autocomplete suggestions.
 *
 * @see apps/desktop/src/features/drizzle-runner/components/code-editor.tsx
 * @see tests/apps/desktop/features/drizzle-runner/lsp-patterns.test.ts
 */

/**
 * Detects whether the cursor is in a db. or tx. context.
 * Returns "db" for db., "tx" for tx., null otherwise.
 */
export function getDbName(text: string): "db" | "tx" | null {
    const match = text.match(/\b(db|tx)\.[\w]*$/);
    if (!match) return null;
    if (match[1] === "tx") return "tx";
    return "db";
}

/**
 * Matches table.column patterns at the end of the text.
 * Used for detecting table and column references.
 */
export function getTableMatch(text: string): RegExpMatchArray | null {
    return text.match(/\b([a-zA-Z_][\w]*)\.([a-zA-Z_][\w]*)?$/);
}

/**
 * Detects the current query chain mode (select, insert, update, or delete).
 * Returns the mode name or null if not in a recognized chain context.
 */
export function getChainMode(text: string): "select" | "insert" | "update" | "delete" | null {
    // Match chain patterns with optional partial method name typed after the dot
    // Uses .*? for non-greedy match to handle nested parens like .where(eq(a, b))
    // The key is looking for the final ).[letters] pattern at the end

    // Check delete first to prevent it being caught by select's .where() check if detection is loose
    if (/db\.delete\(.*?\)\.[a-zA-Z]*$/.test(text) || /\bdelete\(.*?\)\.(where|returning)\(/.test(text) || /\.delete\(.*?\)\.[a-zA-Z]*$/.test(text)) return "delete";

    // For select chains: look for any of the select chain methods followed by ).[partial]
    if (
        /db\.select\(.*?\)\.[a-zA-Z]*$/.test(text)
        || /\.from\([^)]*\)\.[a-zA-Z]*$/.test(text)
        || /\.where\(.*\)\.[a-zA-Z]*$/.test(text)
        || /\.leftJoin\(.*\)\.[a-zA-Z]*$/.test(text)
        || /\.rightJoin\(.*\)\.[a-zA-Z]*$/.test(text)
        || /\.innerJoin\(.*\)\.[a-zA-Z]*$/.test(text)
        || /\.fullJoin\(.*\)\.[a-zA-Z]*$/.test(text)
        || /\.groupBy\(.*\)\.[a-zA-Z]*$/.test(text)
        || /\.having\(.*\)\.[a-zA-Z]*$/.test(text)
        || /\.orderBy\(.*\)\.[a-zA-Z]*$/.test(text)
        || /\.limit\([^)]*\)\.[a-zA-Z]*$/.test(text)
        || /\.offset\([^)]*\)\.[a-zA-Z]*$/.test(text)
        || /\.union\(.*\)\.[a-zA-Z]*$/.test(text)
        || /\.unionAll\(.*\)\.[a-zA-Z]*$/.test(text)
        || /\.intersect\(.*\)\.[a-zA-Z]*$/.test(text)
        || /\.except\(.*\)\.[a-zA-Z]*$/.test(text)
        || /\.select\(.*?\)\.[a-zA-Z]*$/.test(text) // Allow .select() after .with()
    ) {
        return "select";
    }

    // Insert with onConflict support
    if (/db\.insert\(.*?\)\.[a-zA-Z]*$/.test(text)
        || /\.values\(.*?\)\.[a-zA-Z]*$/.test(text)
        || /\.onConflictDoUpdate\(.*?\)\.[a-zA-Z]*$/.test(text)
        || /\.onConflictDoNothing\(.*?\)\.[a-zA-Z]*$/.test(text)
        || /\.insert\(.*?\)\.[a-zA-Z]*$/.test(text)
    ) return "insert";

    // Update with returning support
    if (/db\.update\(.*?\)\.[a-zA-Z]*$/.test(text)
        || /\.set\(.*?\)\.[a-zA-Z]*$/.test(text)
        || /\.returning\(.*?\)\.[a-zA-Z]*$/.test(text)
        || /\.update\(.*?\)\.[a-zA-Z]*$/.test(text)
    ) return "update";

    return null;
}

/**
 * Matches table.column.partial patterns.
 * Used when suggesting table columns.
 */
export function getColumnMatch(text: string): RegExpMatchArray | null {
    return text.match(/\b([a-zA-Z_][\w]*)\.([a-zA-Z_][\w]*)\.([a-zA-Z_][\w]*)?$/);
}

/**
 * Matches operator patterns like eq(table.column,
 * Used when suggesting value parameters in WHERE conditions.
 */
export function getValueMatch(text: string): RegExpMatchArray | null {
    return text.match(/\b(eq|ne|gt|gte|lt|lte|inArray|notInArray|like|ilike)\(\s*([a-zA-Z_][\w]*)\.([a-zA-Z_][\w]*)\s*,\s*$/);
}

/**
 * Matches join patterns like .from(table).join(
 * Used when suggesting join conditions.
 */
export function getJoinMatch(text: string): RegExpMatchArray | null {
    return text.match(/\bfrom\(\s*([a-zA-Z_][\w]*)\s*\)\.[\w]*Join\(\s*([a-zA-Z_][\w]*)\s*,\s*$/);
}

/**
 * Detects if cursor is inside .from( parentheses.
 */
export function isInsideFromParens(text: string): boolean {
    return /\.from\(\s*[a-zA-Z_]?[\w]*$/.test(text);
}

/**
 * Detects if cursor is inside .where( or condition parentheses.
 */
export function isInsideWhereParens(text: string): boolean {
    return /\.where\(\s*$/.test(text) || /\b(and|or)\(\s*$/.test(text);
}

/**
 * Matches helper function patterns like eq(, and(, etc.
 */
export function getHelperMatch(text: string): RegExpMatchArray | null {
    return text.match(/\b(eq|ne|gt|gte|lt|lte|and|or|inArray|notInArray|like|ilike|between|not|exists|notExists)\(/);
}
