/**
 * Database connection string utilities
 * Analysis, validation, correction, and name suggestion for connection strings
 */

export type DatabaseType = 'postgres' | 'sqlite' | 'libsql'

export type ConnectionAnalysis = {
    original: string
    cleaned: string
    type: DatabaseType | null
    host?: string
    database?: string
    corrections: string[]
    warnings: string[]
}

const POSTGRES_TYPOS: Record<string, string> = {
    'postgre://': 'postgresql://',
    'postgres//': 'postgres://',
    'postgresql//': 'postgresql://',
    'postgress://': 'postgres://',
    'postgresq://': 'postgresql://',
    'psql://': 'postgresql://',
}

const LIBSQL_TYPOS: Record<string, string> = {
    'libsq://': 'libsql://',
    'libsql//': 'libsql://',
    'turso://': 'libsql://',
}

/**
 * Analyze a connection string and detect type, extract components, fix common typos
 */
export function analyzeConnectionString(input: string): ConnectionAnalysis {
    const trimmed = input.trim()
    const corrections: string[] = []
    const warnings: string[] = []
    let cleaned = trimmed
    let type: DatabaseType | null = null

    // Strip surrounding quotes
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
        (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
        cleaned = cleaned.slice(1, -1)
        corrections.push('Removed surrounding quotes')
    }

    // Check for PostgreSQL patterns
    for (const [typo, fix] of Object.entries(POSTGRES_TYPOS)) {
        if (cleaned.toLowerCase().startsWith(typo)) {
            cleaned = fix + cleaned.slice(typo.length)
            corrections.push(`Corrected "${typo}" to "${fix}"`)
            break
        }
    }

    // Check for LibSQL patterns
    for (const [typo, fix] of Object.entries(LIBSQL_TYPOS)) {
        if (cleaned.toLowerCase().startsWith(typo)) {
            cleaned = fix + cleaned.slice(typo.length)
            corrections.push(`Corrected "${typo}" to "${fix}"`)
            break
        }
    }

    // Detect type
    if (cleaned.startsWith('postgresql://') || cleaned.startsWith('postgres://')) {
        type = 'postgres'
    } else if (cleaned.startsWith('libsql://')) {
        type = 'libsql'
    } else if (cleaned.endsWith('.db') || cleaned.endsWith('.sqlite') ||
        cleaned.endsWith('.sqlite3') || cleaned.endsWith('.db3') ||
        cleaned.endsWith('.sdb') || cleaned.endsWith('.sl3') ||
        cleaned.startsWith('/') || cleaned.includes('\\')) {
        type = 'sqlite'
    }

    // Extract host/database for naming
    let host: string | undefined
    let database: string | undefined

    if (type === 'postgres') {
        try {
            const url = new URL(cleaned)
            host = url.hostname
            database = url.pathname.replace(/^\//, '')
        } catch {
            // Invalid URL, try regex
            const match = cleaned.match(/@([^:\/]+).*?\/([^?]+)/)
            if (match) {
                host = match[1]
                database = match[2]
            }
        }
    } else if (type === 'libsql') {
        try {
            const url = new URL(cleaned)
            host = url.hostname
        } catch {
            // Ignore
        }
    } else if (type === 'sqlite') {
        // Extract filename
        const parts = cleaned.replace(/\\/g, '/').split('/')
        database = parts[parts.length - 1]
    }

    return {
        original: input,
        cleaned,
        type,
        host,
        database,
        corrections,
        warnings,
    }
}

/**
 * Format corrections into a user-friendly message
 */
export function formatCorrectionMessage(analysis: ConnectionAnalysis): string | null {
    if (analysis.corrections.length === 0) {
        return null
    }
    return analysis.corrections.join('. ')
}

/**
 * Suggest a connection name based on URL/path
 */
export function suggestConnectionName(url: string, type: DatabaseType): string {
    const analysis = analyzeConnectionString(url)

    if (type === 'postgres') {
        if (analysis.database && analysis.host) {
            return `${analysis.database} @ ${analysis.host}`
        }
        if (analysis.host) {
            return `PostgreSQL - ${analysis.host}`
        }
        return 'PostgreSQL'
    }

    if (type === 'libsql') {
        if (analysis.host) {
            return `LibSQL - ${analysis.host}`
        }
        return 'LibSQL'
    }

    if (type === 'sqlite') {
        if (analysis.database) {
            // Remove extension for cleaner name
            const name = analysis.database.replace(/\.(sqlite3?|db3?|sdb|sl3)$/i, '')
            return name || 'SQLite Database'
        }
        return 'SQLite Database'
    }

    return 'Database'
}

export type ValidationResult = {
    valid: boolean
    error?: string
    corrected?: string
}

/**
 * Validate a connection string for a given database type
 */
export function validateConnectionString(value: string, type: DatabaseType): ValidationResult {
    if (!value.trim()) {
        return { valid: false, error: 'Connection string is required' }
    }

    const analysis = analyzeConnectionString(value)

    if (type === 'postgres') {
        const cleaned = analysis.cleaned

        if (!cleaned.startsWith('postgresql://') && !cleaned.startsWith('postgres://')) {
            // Check if it looks like a postgres URL with typo
            if (cleaned.includes('@') && cleaned.includes(':')) {
                return {
                    valid: false,
                    error: 'URL should start with "postgresql://" or "postgres://"',
                    corrected: `postgresql://${cleaned}`,
                }
            }
            return { valid: false, error: 'Invalid PostgreSQL connection string format' }
        }

        try {
            new URL(cleaned)
            return { valid: true, corrected: analysis.corrections.length > 0 ? cleaned : undefined }
        } catch {
            return { valid: false, error: 'Invalid URL format' }
        }
    }

    if (type === 'sqlite') {
        const cleaned = analysis.cleaned
        const validExtensions = ['.sqlite', '.sqlite3', '.db', '.db3', '.sdb', '.sl3']
        const hasValidExtension = validExtensions.some(ext =>
            cleaned.toLowerCase().endsWith(ext)
        )

        if (!hasValidExtension) {
            return {
                valid: false,
                error: 'SQLite path should end with a valid extension (.sqlite, .sqlite3, .db, .db3, .sdb, .sl3)',
            }
        }

        return { valid: true }
    }

    if (type === 'libsql') {
        const cleaned = analysis.cleaned

        if (!cleaned.startsWith('libsql://')) {
            if (cleaned.includes('.turso.io') || cleaned.includes('turso')) {
                return {
                    valid: false,
                    error: 'URL should start with "libsql://"',
                    corrected: `libsql://${cleaned}`,
                }
            }
            return { valid: false, error: 'Invalid LibSQL connection URL format' }
        }

        try {
            new URL(cleaned)
            return { valid: true, corrected: analysis.corrections.length > 0 ? cleaned : undefined }
        } catch {
            return { valid: false, error: 'Invalid URL format' }
        }
    }

    return { valid: false, error: 'Unknown database type' }
}
