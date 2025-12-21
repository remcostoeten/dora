type SQLError = {
  line: number
  column: number
  message: string
  suggestion?: string
}

export function validateSQL(query: string): SQLError[] {
  const errors: SQLError[] = []
  const lines = query.split("\n")

  const keywords = [
    "SELECT",
    "FROM",
    "WHERE",
    "INSERT",
    "UPDATE",
    "DELETE",
    "JOIN",
    "LEFT",
    "RIGHT",
    "INNER",
    "OUTER",
    "ON",
    "AND",
    "OR",
    "ORDER",
    "BY",
    "GROUP",
    "HAVING",
    "LIMIT",
    "OFFSET",
    "AS",
    "INTO",
    "VALUES",
    "SET",
    "CREATE",
    "ALTER",
    "DROP",
    "TABLE",
    "INDEX",
  ]

  const suggestions: Record<string, string> = {
    SELCT: "SELECT",
    SLECT: "SELECT",
    SELET: "SELECT",
    FORM: "FROM",
    WHRE: "WHERE",
    WHER: "WHERE",
    UPDAE: "UPDATE",
    UPDTE: "UPDATE",
    DELTE: "DELETE",
    DLEET: "DELETE",
    INSRT: "INSERT",
    ISNERT: "INSERT",
    JION: "JOIN",
    GRUP: "GROUP",
    GRUOP: "GROUP",
    ORDRE: "ORDER",
    LIMTI: "LIMIT",
  }

  lines.forEach((line, lineIndex) => {
    const words = line.split(/\s+/)

    words.forEach((word, wordIndex) => {
      const upperWord = word.toUpperCase().replace(/[;,()]/g, "")

      // Check for common typos
      if (suggestions[upperWord]) {
        errors.push({
          line: lineIndex + 1,
          column: line.indexOf(word) + 1,
          message: `Unknown keyword '${word}'`,
          suggestion: suggestions[upperWord],
        })
      }
    })

    // Check for unclosed quotes
    const singleQuotes = (line.match(/'/g) || []).length
    const doubleQuotes = (line.match(/"/g) || []).length

    if (singleQuotes % 2 !== 0) {
      errors.push({
        line: lineIndex + 1,
        column: line.lastIndexOf("'") + 1,
        message: "Unclosed string literal",
        suggestion: "Add closing quote '",
      })
    }

    if (doubleQuotes % 2 !== 0) {
      errors.push({
        line: lineIndex + 1,
        column: line.lastIndexOf('"') + 1,
        message: "Unclosed string literal",
        suggestion: 'Add closing quote "',
      })
    }

    // Check for missing semicolon at end (if it's the last non-empty line)
    if (lineIndex === lines.length - 1 && line.trim() && !line.trim().endsWith(";")) {
      errors.push({
        line: lineIndex + 1,
        column: line.length + 1,
        message: "Missing semicolon at end of statement",
        suggestion: "Add ; at the end",
      })
    }
  })

  return errors
}
