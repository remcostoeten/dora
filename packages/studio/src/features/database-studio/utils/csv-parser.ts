export type ParseCSVResult = {
  headers: string[]
  rows: string[][]
  error?: string
}

export function parseCSV(text: string): ParseCSVResult {
  const content = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  if (!content.trim()) return { headers: [], rows: [], error: 'File is empty' }

  const lines = splitLines(content)
  if (lines.length === 0) return { headers: [], rows: [], error: 'File is empty' }

  const delimiter = detectDelimiter(lines[0])
  const headers = parseRow(lines[0], delimiter)
  const rows: string[][] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '') continue
    rows.push(parseRow(line, delimiter))
  }

  return { headers, rows }
}

const DELIMITER_CANDIDATES = [',', ';', '\t']

function detectDelimiter(headerLine: string): string {
  let best = ','
  let bestCount = 0

  for (const candidate of DELIMITER_CANDIDATES) {
    const count = countOutsideQuotes(headerLine, candidate)
    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  }

  return best
}

function countOutsideQuotes(line: string, delimiter: string): number {
  let count = 0
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === delimiter && !inQuotes) {
      count++
    }
  }

  return count
}

function splitLines(text: string): string[] {
  const lines: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (ch === '"') {
      if (inQuotes && next === '"') {
        // Escaped quote inside quoted field: keep both quotes
        current += '""'
        i++
      } else {
        // Toggle quote state and keep the quote
        inQuotes = !inQuotes
        current += ch
      }
    } else if ((ch === '\n' || (ch === '\r' && next === '\n')) && !inQuotes) {
      if (ch === '\r') i++
      lines.push(current)
      current = ''
    } else {
      current += ch
    }
  }

  if (current) lines.push(current)
  return lines
}

function parseRow(line: string, delimiter: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  let i = 0

  while (i < line.length) {
    const ch = line[i]
    const next = line[i + 1]

    if (ch === '"') {
      if (!inQuotes) {
        // Starting a quoted field
        inQuotes = true
        i++
        continue
      } else {
        // We're inside quotes
        if (next === '"') {
          // Escaped quote: "" becomes "
          current += '"'
          i += 2
          continue
        } else {
          // End of quoted field
          inQuotes = false
          i++
          continue
        }
      }
    }
    if (ch === delimiter && !inQuotes) {
      fields.push(current)
      current = ''
      i++
      continue
    }
    current += ch
    i++
  }

  fields.push(current)
  return fields
}
