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

    // Step 3: Detect and correct typos (apply longest match first to avoid overlapping)
    let lowerCleaned = cleaned.toLowerCase()
    const sortedTypos = Object.entries(TYPO_CORRECTIONS).sort((a, b) => b[0].length - a[0].length)

    for (const [typo, correction] of sortedTypos) {
        const lowerCheck = cleaned.toLowerCase()
        if (lowerCheck.includes(typo)) {
            const index = lowerCheck.indexOf(typo)
            const actualTypo = cleaned.substring(index, index + typo.length)
            cleaned = cleaned.substring(0, index) + correction + cleaned.substring(index + typo.length)
            corrections.push({ original: actualTypo, corrected: correction })
            // Only apply one correction to avoid overlapping issues
            break
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

/**
 * Get autocomplete suggestions for connection strings
 */
export function getConnectionStringSuggestions(
    currentValue: string,
    dbType: 'postgres' | 'sqlite',
    history: string[] = []
): Array<{ value: string; label?: string; description?: string }> {
    const suggestions: Array<{ value: string; label?: string; description?: string }> = []

    if (dbType === 'postgres') {
        // Protocol prefixes
        if (!currentValue || 'postgresql://'.startsWith(currentValue.toLowerCase())) {
            suggestions.push({
                value: 'postgresql://',
                label: 'postgresql://',
                description: 'Standard PostgreSQL protocol'
            })
        }
        if (!currentValue || 'postgres://'.startsWith(currentValue.toLowerCase())) {
            suggestions.push({
                value: 'postgres://',
                label: 'postgres://',
                description: 'Short PostgreSQL protocol'
            })
        }

        // Common templates
        if (currentValue.endsWith('://') || !currentValue) {
            suggestions.push({
                value: 'postgresql://localhost:5432/',
                label: 'postgresql://localhost:5432/',
                description: 'Local PostgreSQL (default port)'
            })
            suggestions.push({
                value: 'postgresql://user:password@localhost:5432/database',
                label: 'postgresql://...@localhost/database',
                description: 'Full connection template'
            })
        }

        // User templates after protocol
        if (currentValue.match(/postgresql:\/\/$/i) || currentValue.match(/postgres:\/\/$/i)) {
            const prefix = currentValue
            suggestions.push({
                value: prefix + 'localhost:5432/',
                label: prefix + 'localhost:5432/',
                description: 'Local connection'
            })
            suggestions.push({
                value: prefix + 'user:password@',
                label: prefix + 'user:password@',
                description: 'With credentials'
            })
        }

        // Host suggestions after @
        if (currentValue.includes('@') && !currentValue.includes('@localhost') && !currentValue.match(/@[\w.-]+:/)) {
            const beforeAt = currentValue.split('@')[0]
            suggestions.push({
                value: beforeAt + '@localhost:5432/',
                label: '...@localhost:5432/',
                description: 'Local host'
            })
            suggestions.push({
                value: beforeAt + '@127.0.0.1:5432/',
                label: '...@127.0.0.1:5432/',
                description: 'Loopback address'
            })
        }
    } else {
        // SQLite suggestions
        if (!currentValue) {
            suggestions.push({
                value: './database.db',
                label: './database.db',
                description: 'Current directory'
            })
            suggestions.push({
                value: '~/.local/share/',
                label: '~/.local/share/',
                description: 'User data directory'
            })
        }

        // File extension
        if (currentValue && !currentValue.endsWith('.db') && !currentValue.endsWith('.sqlite')) {
            suggestions.push({
                value: currentValue + '.db',
                label: currentValue + '.db',
                description: 'Add .db extension'
            })
            suggestions.push({
                value: currentValue + '.sqlite',
                label: currentValue + '.sqlite',
                description: 'Add .sqlite extension'
            })
        }
    }

    // Add history items
    const filteredHistory = history
        .filter(h => !currentValue || h.toLowerCase().includes(currentValue.toLowerCase()))
        .slice(0, 5)

    for (const item of filteredHistory) {
        if (!suggestions.find(s => s.value === item)) {
            suggestions.push({
                value: item,
                label: item.length > 40 ? item.slice(0, 37) + '...' : item,
                description: 'Recent connection'
            })
        }
    }

    return suggestions
}

