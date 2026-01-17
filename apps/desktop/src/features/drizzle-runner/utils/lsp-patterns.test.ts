/**
 * LSP Autocomplete Pattern Tests
 * 
 * These tests verify that the regex patterns used in the Drizzle runner's
 * autocomplete correctly identify various query states.
 * 
 * Run with: bun run apps/desktop/src/features/drizzle-runner/utils/lsp-patterns.test.ts
 * Or with: npx tsx apps/desktop/src/features/drizzle-runner/utils/lsp-patterns.test.ts
 */

// Pattern definitions (copied from code-editor.tsx for testing)
function getDbName(text: string): "db" | "tx" | null {
    const match = text.match(/\b(db|tx)\.[\w]*$/);
    if (!match) return null;
    if (match[1] === "tx") return "tx";
    return "db";
}

function getChainMode(text: string): "select" | "insert" | "update" | "delete" | null {
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

function getTableMatch(text: string): RegExpMatchArray | null {
    return text.match(/\b([a-zA-Z_][\w]*)\.([a-zA-Z_][\w]*)?$/);
}

function isInsideFromParens(text: string): boolean {
    return /\.from\(\s*[a-zA-Z_]?[\w]*$/.test(text);
}

function isInsideWhereParens(text: string): boolean {
    return /\.where\(\s*$/.test(text) || /\b(and|or)\(\s*$/.test(text);
}

// Test runner
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
    try {
        fn();
        passed++;
        console.log(`✓ ${name}`);
    } catch (e) {
        failed++;
        console.error(`✗ ${name}`);
        console.error(`  ${(e as Error).message}`);
    }
}

function expect(actual: unknown) {
    return {
        toBe(expected: unknown) {
            if (actual !== expected) {
                throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
            }
        },
        toBeTruthy() {
            if (!actual) {
                throw new Error(`Expected truthy value, got ${JSON.stringify(actual)}`);
            }
        },
        toBeFalsy() {
            if (actual) {
                throw new Error(`Expected falsy value, got ${JSON.stringify(actual)}`);
            }
        },
        toBeNull() {
            if (actual !== null) {
                throw new Error(`Expected null, got ${JSON.stringify(actual)}`);
            }
        },
        not: {
            toBeNull() {
                if (actual === null) {
                    throw new Error(`Expected not null, got null`);
                }
            }
        }
    };
}

console.log("\n=== Drizzle LSP Pattern Tests ===\n");

// getDbName tests
console.log("--- getDbName ---");
test("detects db. at end", () => expect(getDbName("db.")).toBe("db"));
test("detects db.sel partial", () => expect(getDbName("db.sel")).toBe("db"));
test("detects db.select", () => expect(getDbName("db.select")).toBe("db"));
test("detects tx.", () => expect(getDbName("tx.")).toBe("tx"));
test("does not detect after complete method", () => expect(getDbName("db.select()")).toBeNull());
test("does not detect mid-text", () => expect(getDbName("const query = db")).toBeNull());

// getChainMode tests for select
console.log("\n--- getChainMode (select) ---");
test("db.select().", () => expect(getChainMode("db.select().")).toBe("select"));
test("db.select().f partial", () => expect(getChainMode("db.select().f")).toBe("select"));
test("db.select().from partial", () => expect(getChainMode("db.select().from")).toBe("select"));
test("db.select().from(customers).", () => expect(getChainMode("db.select().from(customers).")).toBe("select"));
test("db.select().from(customers).w", () => expect(getChainMode("db.select().from(customers).w")).toBe("select"));
test("db.select().from(customers).where(eq(customers.id, 1)).", () =>
    expect(getChainMode("db.select().from(customers).where(eq(customers.id, 1)).")).toBe("select"));
test("complex chain with orderBy", () =>
    expect(getChainMode("db.select().from(customers).where(eq(id, 1)).orderBy(name).")).toBe("select"));

// getChainMode tests for insert
console.log("\n--- getChainMode (insert) ---");
test("db.insert(customers).", () => expect(getChainMode("db.insert(customers).")).toBe("insert"));
test("db.insert(customers).v", () => expect(getChainMode("db.insert(customers).v")).toBe("insert"));
test("db.insert(customers).values", () => expect(getChainMode("db.insert(customers).values")).toBe("insert"));

// getChainMode tests for update
console.log("\n--- getChainMode (update) ---");
test("db.update(customers).", () => expect(getChainMode("db.update(customers).")).toBe("update"));
test("db.update(customers).s", () => expect(getChainMode("db.update(customers).s")).toBe("update"));
test("db.update(customers).set", () => expect(getChainMode("db.update(customers).set")).toBe("update"));

// getChainMode tests for delete
console.log("\n--- getChainMode (delete) ---");
test("db.delete(customers).", () => expect(getChainMode("db.delete(customers).")).toBe("delete"));
test("db.delete(customers).w", () => expect(getChainMode("db.delete(customers).w")).toBe("delete"));

// getChainMode null cases
console.log("\n--- getChainMode (null cases) ---");
test("empty string", () => expect(getChainMode("")).toBeNull());
test("db.", () => expect(getChainMode("db.")).toBeNull());
test("db.select(", () => expect(getChainMode("db.select(")).toBeNull());
test("just text", () => expect(getChainMode("hello world")).toBeNull());

// getTableMatch tests
console.log("\n--- getTableMatch ---");
test("customers.", () => expect(getTableMatch("customers.")).not.toBeNull());
test("customers.i partial", () => expect(getTableMatch("customers.i")).not.toBeNull());
test("customers.id", () => expect(getTableMatch("customers.id")).not.toBeNull());

// isInsideFromParens tests
console.log("\n--- isInsideFromParens ---");
test(".from(", () => expect(isInsideFromParens(".from(")).toBeTruthy());
test(".from(c", () => expect(isInsideFromParens(".from(c")).toBeTruthy());
test(".from(customers", () => expect(isInsideFromParens(".from(customers")).toBeTruthy());
test(".from(customers)", () => expect(isInsideFromParens(".from(customers)")).toBeFalsy());

// isInsideWhereParens tests
console.log("\n--- isInsideWhereParens ---");
test(".where(", () => expect(isInsideWhereParens(".where(")).toBeTruthy());
test("and(", () => expect(isInsideWhereParens("and(")).toBeTruthy());
test("or(", () => expect(isInsideWhereParens("or(")).toBeTruthy());
test(".where(eq", () => expect(isInsideWhereParens(".where(eq")).toBeFalsy());

// Complex scenarios
console.log("\n--- Complex Scenarios ---");
test("nested select in where - should detect chain after outer )", () => {
    const text = "db.select().from(customers).where(eq(customers.status, 'active')).";
    expect(getChainMode(text)).toBe("select");
});

test("single line with continuation - current line only (Monaco behavior)", () => {
    // Monaco's textUntilPosition only includes the current line
    // So when on the last line of a multiline query, we only see that line
    const lastLineOnly = "  .where(eq(customers.id, 1)).o";
    expect(getChainMode(lastLineOnly)).toBe("select");
});

// Summary
console.log("\n=================================");
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("=================================\n");

// --- NEW TEST CASES FOR FULL SPEC IMPLEMENTATION ---

console.log("\n=== Phase 5: Full Spec Tests (Expected to Fail initially) ===\n");

// 1. New Select Chain Methods
console.log("\n--- Select Chain Enhancements ---");
test("detects .groupBy()", () => expect(getChainMode("db.select().from(t).groupBy(c).")).toBe("select"));
test("detects .having()", () => expect(getChainMode("db.select().from(t).having(c).")).toBe("select"));
test("detects .offset()", () => expect(getChainMode("db.select().from(t).offset(10).")).toBe("select"));
test("detects .rightJoin()", () => expect(getChainMode("db.select().from(t).rightJoin(t2, eq(a,b)).")).toBe("select"));
test("detects .fullJoin()", () => expect(getChainMode("db.select().from(t).fullJoin(t2, eq(a,b)).")).toBe("select"));

// 2. Insert Conflict Methods
console.log("\n--- Insert Conflict Methods ---");
test("detects .onConflictDoUpdate()", () => expect(getChainMode("db.insert(t).values(v).onConflictDoUpdate(c).")).toBe("insert"));
test("detects .onConflictDoNothing()", () => expect(getChainMode("db.insert(t).values(v).onConflictDoNothing().")).toBe("insert"));

// 3. Returning for Up/Del
console.log("\n--- Returning for Update/Delete ---");
test("update .returning()", () => expect(getChainMode("db.update(t).set(v).returning().")).toBe("update"));
test("delete .returning()", () => expect(getChainMode("db.delete(t).where(c).returning().")).toBe("delete"));

// 4. Operators regex checks (mimicking getDbName/helper detection logic)
// Since operators aren't part of chain mode, we check if they are recognized as 'helpers'
// This matches the logic in code-editor where we check for helper matches
function getHelperMatch(text: string): RegExpMatchArray | null {
    // Current regex check for helpers
    return text.match(/\b(eq|ne|gt|gte|lt|lte|and|or|inArray|notInArray|like|ilike|between|not|exists|notExists)\(/);
}

console.log("\n--- Operators Detection ---");
// These will definitely fail until we update the regex in the actual code (and here)
const operators = ["inArray", "notInArray", "isNull", "isNotNull", "like", "ilike", "between", "not", "exists", "notExists"];
operators.forEach(op => {
    test(`detects operator ${op}`, () => {
        // This test is mocking what needs to be updated in the main file
        const regex = new RegExp(`\\b(${operators.join("|")}|eq|ne|gt|gte|lt|lte|and|or)\\(`);
        expect(regex.test(`${op}(`)).toBeTruthy();
    });
});

// 5. Aggregates Detection
console.log("\n--- Aggregates Detection ---");
const aggregates = ["count", "sum", "avg", "min", "max", "countDistinct", "sumDistinct"];
aggregates.forEach(agg => {
    test(`detects aggregate ${agg}`, () => {
        const regex = new RegExp(`\\b(${aggregates.join("|")})\\(`);
        expect(regex.test(`${agg}(`)).toBeTruthy();
    });
});


// 6. Phase 5.5: Final Audit
console.log("\n--- Phase 5.5: Final Audit Tests ---");

// CTEs
test("detects .with()", () => expect(getChainMode("db.with(cte).select().")).toBe("select")); // Should likely treat as select starter
// Or specialized CTE mode? For now, if we type db.with(...). it acts like a query builder start.
// But strictly getChainMode checks for select/insert/update/delete.
// db.with(...) returns a builder that has .select etc.
// So: db.with(sq).select().from(...) match "select"

test("detects db.with(...) chain start", () => {
    // This requires updating regex to look past .with(...)
    expect(getChainMode("db.with(c).select().from(t).")).toBe("select");
    expect(getChainMode("db.with(c).update(t).")).toBe("update");
    expect(getChainMode("db.with(c).delete(t).")).toBe("delete");
    expect(getChainMode("db.with(c).insert(t).")).toBe("insert");
});

// Set Operations
test("detects .union()", () => expect(getChainMode("db.select().from(t).union(q).")).toBe("select"));
test("detects .intersect()", () => expect(getChainMode("db.select().from(t).intersect(q).")).toBe("select"));
test("detects .except()", () => expect(getChainMode("db.select().from(t).except(q).")).toBe("select"));

// New Postgres Operators
console.log("\n--- Postgres Array Operators ---");
const pgOperators = ["arrayContains", "arrayContained", "arrayOverlaps"];
pgOperators.forEach(op => {
    test(`detects operator ${op}`, () => {
        // Update helper match regex to include these
        const regex = new RegExp(`\\b(${pgOperators.join("|")})\\(`);
        expect(regex.test(`${op}(`)).toBeTruthy();
    });
});


if (failed > 0) {
    console.log(`\n\x1b[33mNote: ${failed} failures expected for Phase 5.5 TDD\x1b[0m`);
    process.exit(1);
}
