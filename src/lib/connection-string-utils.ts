/**
 * Connection String Utilities
 * Auto-fill detection, prefix stripping, and typo correction
 */

// Common environment variable prefixes to strip
const ENV_PREFIXES = [
    'DATABASE_URL=',
    'DB_URL=',
    'POSTGRES_URL=',
    'POSTGRESQL_URL=',
    'PG_URL=',
    'DATABASE_URL="',
    'DATABASE_URL=\'',
    'DB_URL="',
    'DB_URL=\'',
    'export DATABASE_URL=',
    'export DB_URL=',
]

// Common typos and their corrections
const TYPO_CORRECTIONS: Record<string, string> = {
    // PostgreSQL typos
    'postttgr': 'postgres',
    'posttgre': 'postgres',
    'postgrs': 'postgres',
    'postrgres': 'postgres',
    'postgress': 'postgres',
    'postgressql': 'postgresql',
    'postgrsql': 'postgresql',
    'postgresssql': 'postgresql',
    'postgree': 'postgres',
    'posgres': 'postgres',
    'potgres': 'postgres',
    'posgtres': 'postgres',
    'prostgres': 'postgres',
    'postgers': 'postgres',
    'postgrse': 'postgres',
    'pgsql': 'postgres',
    'psql': 'postgres',
    // Protocol typos
    'postgresql//': 'postgresql://',
    'postgres//': 'postgresql://',
    'psql://': 'postgresql://',
    'postgressql://': 'postgresql://',
}

export type ConnectionStringAnalysis = {
    /** The cleaned/corrected connection string */
    cleaned: string
    /** Original input */
    original: string
    /** Detected database type */
    detectedType: 'postgres' | 'sqlite' | 'unknown'
    /** Prefix that was stripped, if any */
    strippedPrefix: string | null
    /** Typos that were detected and corrected */
    corrections: Array<{ original: string; corrected: string }>
    /** Whether any modifications were made */
    wasModified: boolean
}

/**
 * Analyze and clean a connection string
 * - Strips environment variable prefixes (DATABASE_URL=, etc.)
 * - Detects and corrects common typos
 * - Trims whitespace and quotes
 */
export function analyzeConnectionString(input: string): ConnectionStringAnalysis {
    let cleaned = input.trim()
    const original = input
    let strippedPrefix: string | null = null
    const corrections: Array<{ original: string; corrected: string }> = []

    // Step 1: Strip environment variable prefixes
    for (const prefix of ENV_PREFIXES) {
        if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
            strippedPrefix = cleaned.substring(0, prefix.length)
            cleaned = cleaned.substring(prefix.length)
            break
        }
    }

    // Step 2: Strip surrounding quotes
    cleaned = cleaned.trim()
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
        (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
        cleaned = cleaned.slice(1, -1)
    }

    // Step 3: Detect and correct typos
    const lowerCleaned = cleaned.toLowerCase()
    for (const [typo, correction] of Object.entries(TYPO_CORRECTIONS)) {
        if (lowerCleaned.includes(typo)) {
            // Find the actual case in the string
            const index = lowerCleaned.indexOf(typo)
            const actualTypo = cleaned.substring(index, index + typo.length)
            cleaned = cleaned.substring(0, index) + correction + cleaned.substring(index + typo.length)
            corrections.push({ original: actualTypo, corrected: correction })
        }
    }

    // Step 4: Detect database type
    let detectedType: 'postgres' | 'sqlite' | 'unknown' = 'unknown'
    const lowerFinal = cleaned.toLowerCase()

    if (lowerFinal.startsWith('postgresql://') || lowerFinal.startsWith('postgres://')) {
        detectedType = 'postgres'
    } else if (lowerFinal.endsWith('.db') || lowerFinal.endsWith('.sqlite') ||
        lowerFinal.endsWith('.sqlite3') || lowerFinal.includes('sqlite')) {
        detectedType = 'sqlite'
    }

    const wasModified = cleaned !== original.trim()

    return {
        cleaned,
        original,
        detectedType,
        strippedPrefix,
        corrections,
        wasModified,
    }
}

/**
 * Format a user-friendly message about what was auto-corrected
 */
export function formatCorrectionMessage(analysis: ConnectionStringAnalysis): string | null {
    const parts: string[] = []

    if (analysis.strippedPrefix) {
        parts.push(`Stripped prefix: ${analysis.strippedPrefix.trim()}`)
    }

    if (analysis.corrections.length > 0) {
        const correctionTexts = analysis.corrections.map(
            c => `"${c.original}" → "${c.corrected}"`
        )
        parts.push(`Corrected: ${correctionTexts.join(', ')}`)
    }

    return parts.length > 0 ? parts.join(' • ') : null
}

/**
 * Suggest a connection name based on the connection string
 */
export function suggestConnectionName(connectionString: string, dbType: 'postgres' | 'sqlite'): string {
    if (dbType === 'sqlite') {
        // Extract filename from path
        const parts = connectionString.split(/[/\\]/)
        const filename = parts[parts.length - 1] || 'SQLite Database'
        return filename.replace(/\.(db|sqlite|sqlite3)$/i, '')
    }

    try {
        // Try to parse PostgreSQL connection string
        const url = new URL(connectionString)
        const dbName = url.pathname.replace('/', '') || 'database'
        const host = url.hostname || 'localhost'

        if (host === 'localhost' || host === '127.0.0.1') {
            return `Local - ${dbName}`
        }
        return `${host} - ${dbName}`
    } catch {
        return 'My Database'
    }
}

/**
 * Validate a connection string format
 */
export function validateConnectionString(
    value: string,
    dbType: 'postgres' | 'sqlite'
): { valid: boolean; error?: string } {
    if (!value.trim()) {
        return { valid: false, error: 'Connection string is required' }
    }

    if (dbType === 'postgres') {
        const lower = value.toLowerCase()
        if (!lower.startsWith('postgresql://') && !lower.startsWith('postgres://')) {
            return {
                valid: false,
                error: 'PostgreSQL connection string should start with postgresql:// or postgres://'
            }
        }

        try {
            new URL(value)
        } catch {
            return { valid: false, error: 'Invalid URL format' }
        }
    }

    if (dbType === 'sqlite') {
        // Basic path validation
        if (value.includes('://') && !value.toLowerCase().includes('sqlite')) {
            return { valid: false, error: 'This looks like a PostgreSQL URL, not a SQLite path' }
        }
    }

    return { valid: true }
}
