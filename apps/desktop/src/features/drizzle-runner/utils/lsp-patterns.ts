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
    // Check delete first
    if (/db\.delete\(.*?\)\.[a-zA-Z]*$/.test(text) || /\bdelete\(.*?\)\.(where|returning)\(/.test(text) || /\.delete\(.*?\)\.[a-zA-Z]*$/.test(text) || /^db\.delete\(/.test(text)) return "delete";

    // For select chains
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
        || /\.select\(.*?\)\.[a-zA-Z]*$/.test(text)
        || /^db\.select\(/.test(text)
    ) {
        return "select";
    }

    // Insert
    if (/db\.insert\(.*?\)\.[a-zA-Z]*$/.test(text)
        || /\.values\(.*?\)\.[a-zA-Z]*$/.test(text)
        || /^db\.insert\(/.test(text)
    ) return "insert";

    // Update
    if (/db\.update\(.*?\)\.[a-zA-Z]*$/.test(text)
        || /\.set\(.*?\)\.[a-zA-Z]*$/.test(text)
        || /^db\.update\(/.test(text)
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

// --- Context Detectors with Partial Matching Support ---

export function isInsideSelectParens(text: string): boolean {
    return /\b(?:db|tx)\.select\(\s*[\w]*$/.test(text);
}

export function isInsideInsertParens(text: string): boolean {
    return /\b(?:db|tx)\.insert\(\s*[\w]*$/.test(text);
}

export function isInsideUpdateParens(text: string): boolean {
    return /\b(?:db|tx)\.update\(\s*[\w]*$/.test(text);
}

export function isInsideDeleteParens(text: string): boolean {
    return /\b(?:db|tx)\.delete\(\s*[\w]*$/.test(text);
}

export function isInsideFromParens(text: string): boolean {
    return /\.from\(\s*[\w]*$/.test(text);
}

export function isInsideJoinParens(text: string): boolean {
    return /\.(left|right|inner|full)Join\(\s*[\w]*$/.test(text);
}

export function isInsideWhereParens(text: string): boolean {
    return /\.where\(\s*[\w]*$/.test(text) || /\b(and|or)\(\s*[\w]*$/.test(text);
}

/**
 * Matches helper function patterns like eq(, and(, etc.
 */
export function getHelperMatch(text: string): RegExpMatchArray | null {
    return text.match(/\b(eq|ne|gt|gte|lt|lte|and|or|inArray|notInArray|like|ilike|between|not|exists|notExists)\(/);
}

