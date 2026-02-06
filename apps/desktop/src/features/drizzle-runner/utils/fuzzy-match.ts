export function levenshtein(a: string, b: string): number {
    const aLower = a.toLowerCase()
    const bLower = b.toLowerCase()

    if (aLower === bLower) return 0
    if (aLower.length === 0) return bLower.length
    if (bLower.length === 0) return aLower.length

    const matrix: number[][] = []

    for (let i = 0; i <= bLower.length; i++) {
        matrix[i] = [i]
    }

    for (let j = 0; j <= aLower.length; j++) {
        matrix[0][j] = j
    }

    for (let i = 1; i <= bLower.length; i++) {
        for (let j = 1; j <= aLower.length; j++) {
            if (bLower.charAt(i - 1) === aLower.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1]
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                )
            }
        }
    }

    return matrix[bLower.length][aLower.length]
}

export function similarity(a: string, b: string, distance?: number): number {
    const maxLen = Math.max(a.length, b.length)
    if (maxLen === 0) return 1
    const computedDistance = distance ?? levenshtein(a, b)
    return 1 - computedDistance / maxLen
}

type FuzzyMatch = {
    value: string
    distance: number
    similarity: number
}

export function findClosestMatch(
    input: string,
    candidates: string[],
    maxDistance: number = 2
): FuzzyMatch | null {
    if (!input || candidates.length === 0) return null

    let bestMatch: FuzzyMatch | null = null

    for (const candidate of candidates) {
        const distance = levenshtein(input, candidate)

        if (distance <= maxDistance) {
            const sim = similarity(input, candidate, distance)
            if (!bestMatch || distance < bestMatch.distance) {
                bestMatch = {
                    value: candidate,
                    distance: distance,
                    similarity: sim
                }
            }
        }
    }

    return bestMatch
}

export function getSuggestions(
    input: string,
    candidates: string[],
    maxResults: number = 3,
    maxDistance: number = 3
): FuzzyMatch[] {
    if (!input || candidates.length === 0) return []

    const matches: FuzzyMatch[] = []

    for (const candidate of candidates) {
        const distance = levenshtein(input, candidate)

        if (distance <= maxDistance && distance > 0) {
            matches.push({
                value: candidate,
                distance: distance,
                similarity: similarity(input, candidate, distance)
            })
        }
    }

    matches.sort(function (a, b) {
        return a.distance - b.distance
    })

    return matches.slice(0, maxResults)
}

type TypoInfo = {
    word: string
    startIndex: number
    endIndex: number
    suggestion: string | null
    distance: number
}

type LspConfig = {
    reservedWords: Set<string>
    identifiers: string[]
    tableNames: string[]
}

export function createTypoDetector(config: LspConfig) {
    const reservedLower = new Set(
        Array.from(config.reservedWords, function (word) {
            return word.toLowerCase()
        })
    )

    return function detectTypos(query: string): TypoInfo[] {
        const typos: TypoInfo[] = []
        const identifierPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)\b/g

        let match
        while ((match = identifierPattern.exec(query)) !== null) {
            const word = match[1]
            const startIndex = match.index
            const endIndex = startIndex + word.length

            if (reservedLower.has(word.toLowerCase())) continue
            if (/^\d/.test(word)) continue

            const isDotNotation = word.includes('.')
            let candidates: string[]
            let isExactMatch: boolean

            if (isDotNotation) {
                candidates = config.identifiers
                isExactMatch = config.identifiers.includes(word)
            } else {
                candidates = config.tableNames
                isExactMatch = config.tableNames.includes(word)
            }

            if (!isExactMatch && candidates.length > 0) {
                const closest = findClosestMatch(word, candidates, 2)
                if (closest) {
                    typos.push({
                        word: word,
                        startIndex: startIndex,
                        endIndex: endIndex,
                        suggestion: closest.value,
                        distance: closest.distance
                    })
                }
            }
        }

        return typos
    }
}

const DRIZZLE_RESERVED = new Set([
    'db', 'tx', 'select', 'insert', 'update', 'delete', 'from', 'where',
    'orderBy', 'groupBy', 'limit', 'offset', 'leftJoin', 'innerJoin',
    'rightJoin', 'fullJoin', 'values', 'set', 'returning', 'execute',
    'eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'inArray',
    'notInArray', 'isNull', 'isNotNull', 'and', 'or', 'not', 'asc', 'desc',
    'count', 'sum', 'avg', 'min', 'max', 'param', 'true', 'false', 'null',
    'new', 'Date', 'const', 'let', 'var', 'function', 'async', 'await',
    'return', 'if', 'else', 'for', 'while', 'break', 'continue', 'batch',
    'transaction', 'having', 'union', 'unionAll', 'intersect', 'except',
    'sql', 'raw'
])

const PRISMA_RESERVED = new Set([
    'prisma', 'findMany', 'findUnique', 'findFirst', 'findFirstOrThrow',
    'findUniqueOrThrow', 'create', 'createMany', 'update', 'updateMany',
    'upsert', 'delete', 'deleteMany', 'aggregate', 'groupBy', 'count',
    'where', 'select', 'include', 'orderBy', 'skip', 'take', 'cursor',
    'distinct', 'data', 'contains', 'startsWith', 'endsWith', 'equals',
    'not', 'in', 'notIn', 'lt', 'lte', 'gt', 'gte', 'AND', 'OR', 'NOT',
    'true', 'false', 'null', 'const', 'let', 'var', 'function', 'async',
    'await', 'return', 'if', 'else', 'for', 'while', 'new', 'Date',
    'connect', 'disconnect', 'set', 'push', 'unset', 'increment', 'decrement',
    'multiply', 'divide', 'createManyAndReturn', 'stream'
])

const SQL_RESERVED = new Set([
    'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'INTO',
    'VALUES', 'SET', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL',
    'ON', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS', 'NULL',
    'ORDER', 'BY', 'ASC', 'DESC', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET',
    'UNION', 'INTERSECT', 'EXCEPT', 'AS', 'DISTINCT', 'COUNT', 'SUM',
    'AVG', 'MIN', 'MAX', 'CREATE', 'TABLE', 'ALTER', 'DROP', 'INDEX',
    'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'CONSTRAINT', 'CASCADE',
    'RETURNING', 'WITH', 'RECURSIVE', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'
])

type SchemaLike = {
    name: string
    columns: Array<{ name: string }>
}

function extractIdentifiers(tables: SchemaLike[]): string[] {
    const identifiers: string[] = []
    for (const table of tables) {
        identifiers.push(table.name)
        for (const column of table.columns) {
            identifiers.push(`${table.name}.${column.name}`)
        }
    }
    return identifiers
}

function extractTableNames(tables: SchemaLike[]): string[] {
    return tables.map(function (table) {
        return table.name
    })
}

export function createDrizzleTypoDetector(tables: SchemaLike[]) {
    return createTypoDetector({
        reservedWords: DRIZZLE_RESERVED,
        identifiers: extractIdentifiers(tables),
        tableNames: extractTableNames(tables)
    })
}

export function createPrismaTypoDetector(models: SchemaLike[]) {
    return createTypoDetector({
        reservedWords: PRISMA_RESERVED,
        identifiers: extractIdentifiers(models),
        tableNames: extractTableNames(models)
    })
}

export function createSqlTypoDetector(tables: SchemaLike[]) {
    return createTypoDetector({
        reservedWords: SQL_RESERVED,
        identifiers: extractIdentifiers(tables),
        tableNames: extractTableNames(tables)
    })
}

export function getTableNames(tables: SchemaLike[]): string[] {
    return extractTableNames(tables)
}

export function getColumnNames(tables: SchemaLike[], tableName: string): string[] {
    const table = tables.find(function (t) {
        return t.name === tableName
    })
    if (!table) return []
    return table.columns.map(function (col) {
        return col.name
    })
}

export function detectTyposInQuery(query: string, tables: SchemaLike[]): TypoInfo[] {
    const detector = getOrCreateDrizzleDetector(tables)
    return detector(query)
}

const drizzleDetectorCache = new Map<string, ReturnType<typeof createDrizzleTypoDetector>>()

function getOrCreateDrizzleDetector(tables: SchemaLike[]) {
    const signature = tables
        .map(function (table) {
            const columnNames = table.columns.map(function (col) {
                return col.name
            })
            return `${table.name}:${columnNames.join(',')}`
        })
        .join('|')

    const cached = drizzleDetectorCache.get(signature)
    if (cached) return cached

    const detector = createDrizzleTypoDetector(tables)
    drizzleDetectorCache.set(signature, detector)
    return detector
}
