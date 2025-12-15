import { format as sqlFormat, type SqlLanguage } from 'sql-formatter'

// ============================================================================
// Types & Interfaces
// ============================================================================

export type SupportedLanguage = 'sql' | 'postgresql' | 'json' | 'yaml'

export interface FormatOptions {
    /** Indentation string (default: 2 spaces) */
    indent?: string
    /** Uppercase SQL keywords (default: true) */
    uppercaseKeywords?: boolean
    /** How many lines before a new section (default: 1) */
    linesBetweenQueries?: number
    /** Tab width for JSON/YAML (default: 2) */
    tabWidth?: number
}

export interface FormatResult {
    success: boolean
    formatted: string
    error?: string
    language: SupportedLanguage
}

// ============================================================================
// SQL Formatter
// ============================================================================

const SQL_LANGUAGE_MAP: Record<string, SqlLanguage> = {
    sql: 'sql',
    postgresql: 'postgresql',
    postgres: 'postgresql',
    pg: 'postgresql',
}

function formatSQL(code: string, options: FormatOptions = {}): FormatResult {
    const {
        indent = '  ',
        uppercaseKeywords = true,
        linesBetweenQueries = 1,
    } = options

    try {
        const formatted = sqlFormat(code, {
            language: 'postgresql',
            tabWidth: indent.length,
            keywordCase: uppercaseKeywords ? 'upper' : 'preserve',
            linesBetweenQueries,
            indentStyle: 'standard',
            logicalOperatorNewline: 'before',
            expressionWidth: 50,
            denseOperators: false,
            newlineBeforeSemicolon: false,
        })

        return {
            success: true,
            formatted,
            language: 'postgresql',
        }
    } catch (error) {
        return {
            success: false,
            formatted: code,
            error: error instanceof Error ? error.message : 'Unknown SQL formatting error',
            language: 'postgresql',
        }
    }
}

// ============================================================================
// JSON Formatter
// ============================================================================

function formatJSON(code: string, options: FormatOptions = {}): FormatResult {
    const { tabWidth = 2 } = options

    try {
        // First, try to parse valid JSON
        const parsed = JSON.parse(code)
        const formatted = JSON.stringify(parsed, null, tabWidth)

        return {
            success: true,
            formatted,
            language: 'json',
        }
    } catch (error) {
        // Try to fix common issues before giving up
        try {
            // Attempt to handle trailing commas by removing them
            const cleaned = code
                .replace(/,(\s*[}\]])/g, '$1')
                .replace(/'/g, '"') // Replace single quotes with double quotes

            const parsed = JSON.parse(cleaned)
            const formatted = JSON.stringify(parsed, null, tabWidth)

            return {
                success: true,
                formatted,
                language: 'json',
            }
        } catch {
            return {
                success: false,
                formatted: code,
                error: error instanceof Error ? error.message : 'Invalid JSON',
                language: 'json',
            }
        }
    }
}

// ============================================================================
// YAML Formatter (basic implementation without external deps)
// ============================================================================

function formatYAML(code: string, options: FormatOptions = {}): FormatResult {
    const { tabWidth = 2 } = options
    const indent = ' '.repeat(tabWidth)

    try {
        const lines = code.split('\n')
        const formatted: string[] = []
        let currentIndent = 0

        for (const line of lines) {
            const trimmed = line.trim()

            // Skip empty lines but preserve them
            if (!trimmed) {
                formatted.push('')
                continue
            }

            // Handle list items
            if (trimmed.startsWith('-')) {
                formatted.push(indent.repeat(currentIndent) + trimmed)
                continue
            }

            // Handle key-value pairs
            const colonIndex = trimmed.indexOf(':')
            if (colonIndex > 0) {
                const key = trimmed.slice(0, colonIndex).trim()
                const value = trimmed.slice(colonIndex + 1).trim()

                // Check if this is a nested object (no value after colon)
                if (!value) {
                    formatted.push(indent.repeat(currentIndent) + key + ':')
                    currentIndent++
                } else {
                    // Format the value
                    formatted.push(indent.repeat(currentIndent) + key + ': ' + value)
                }
                continue
            }

            // Regular line
            formatted.push(indent.repeat(currentIndent) + trimmed)
        }

        return {
            success: true,
            formatted: formatted.join('\n'),
            language: 'yaml',
        }
    } catch (error) {
        return {
            success: false,
            formatted: code,
            error: error instanceof Error ? error.message : 'YAML formatting error',
            language: 'yaml',
        }
    }
}

// ============================================================================
// Language Detection
// ============================================================================

/**
 * Attempt to auto-detect the language of the code
 */
export function detectLanguage(code: string): SupportedLanguage | null {
    const trimmed = code.trim()

    // JSON detection
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            JSON.parse(trimmed)
            return 'json'
        } catch {
            // Could still be JSON with syntax errors, check for common patterns
            if (/^[\s]*[{[]/.test(trimmed) && /[}\]]\s*$/.test(trimmed)) {
                return 'json'
            }
        }
    }

    // YAML detection (simple heuristic)
    if (/^[\s]*\w+:\s*.*/m.test(trimmed) && !trimmed.includes(';')) {
        // Has key: value pattern and no semicolons
        if (/^---/.test(trimmed) || /^\w+:\s*$/m.test(trimmed)) {
            return 'yaml'
        }
    }

    // SQL detection - check for common SQL keywords
    const sqlKeywords = [
        /^\s*SELECT\s/i,
        /^\s*INSERT\s/i,
        /^\s*UPDATE\s/i,
        /^\s*DELETE\s/i,
        /^\s*CREATE\s/i,
        /^\s*ALTER\s/i,
        /^\s*DROP\s/i,
        /^\s*WITH\s/i,
        /^\s*GRANT\s/i,
        /^\s*REVOKE\s/i,
        /^\s*BEGIN\s/i,
        /^\s*COMMIT\s/i,
        /^\s*ROLLBACK\s/i,
        /^\s*EXPLAIN\s/i,
        /^\s*TRUNCATE\s/i,
        /^\s*COPY\s/i,
        /^\s*VACUUM\s/i,
        /^\s*ANALYZE\s/i,
    ]

    if (sqlKeywords.some((pattern) => pattern.test(trimmed))) {
        return 'postgresql'
    }

    // Default to SQL for this application (database client)
    return 'sql'
}

// ============================================================================
// Main Formatter API
// ============================================================================

/**
 * Format code based on the specified or detected language
 */
export function prettifyCode(
    code: string,
    language?: SupportedLanguage,
    options: FormatOptions = {}
): FormatResult {
    const detectedLang = language || detectLanguage(code) || 'sql'

    switch (detectedLang) {
        case 'sql':
        case 'postgresql':
            return formatSQL(code, options)
        case 'json':
            return formatJSON(code, options)
        case 'yaml':
            return formatYAML(code, options)
        default:
            return {
                success: false,
                formatted: code,
                error: `Unsupported language: ${detectedLang}`,
                language: detectedLang,
            }
    }
}

/**
 * Format SQL specifically for PostgreSQL
 */
export function prettifySQL(code: string, options: FormatOptions = {}): FormatResult {
    return formatSQL(code, options)
}

/**
 * Format JSON with optional settings
 */
export function prettifyJSON(code: string, options: FormatOptions = {}): FormatResult {
    return formatJSON(code, options)
}

/**
 * Format YAML
 */
export function prettifyYAML(code: string, options: FormatOptions = {}): FormatResult {
    return formatYAML(code, options)
}

/**
 * Minify SQL (remove unnecessary whitespace)
 */
export function minifySQL(code: string): FormatResult {
    try {
        // Remove comments
        const noComments = code
            .replace(/--.*$/gm, '') // Remove single-line comments
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments

        // Normalize whitespace
        const minified = noComments
            .replace(/\s+/g, ' ')
            .replace(/\s*([(),;])\s*/g, '$1')
            .replace(/\(\s+/g, '(')
            .replace(/\s+\)/g, ')')
            .trim()

        return {
            success: true,
            formatted: minified,
            language: 'sql',
        }
    } catch (error) {
        return {
            success: false,
            formatted: code,
            error: error instanceof Error ? error.message : 'Minification error',
            language: 'sql',
        }
    }
}

/**
 * Minify JSON
 */
export function minifyJSON(code: string): FormatResult {
    try {
        const parsed = JSON.parse(code)
        const minified = JSON.stringify(parsed)

        return {
            success: true,
            formatted: minified,
            language: 'json',
        }
    } catch (error) {
        return {
            success: false,
            formatted: code,
            error: error instanceof Error ? error.message : 'Invalid JSON',
            language: 'json',
        }
    }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if the code has valid syntax for the given language
 */
export function validateSyntax(code: string, language: SupportedLanguage): { valid: boolean; error?: string } {
    switch (language) {
        case 'json':
            try {
                JSON.parse(code)
                return { valid: true }
            } catch (error) {
                return {
                    valid: false,
                    error: error instanceof Error ? error.message : 'Invalid JSON syntax',
                }
            }
        case 'sql':
        case 'postgresql':
            // Basic SQL syntax validation
            try {
                sqlFormat(code, { language: 'postgresql' })
                return { valid: true }
            } catch (error) {
                return {
                    valid: false,
                    error: error instanceof Error ? error.message : 'Invalid SQL syntax',
                }
            }
        default:
            return { valid: true } // No validation for other languages
    }
}

/**
 * Get list of supported languages
 */
export function getSupportedLanguages(): SupportedLanguage[] {
    return ['sql', 'postgresql', 'json', 'yaml']
}
