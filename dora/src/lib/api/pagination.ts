import type { Pagination } from "./types"

export function paginateData<T>(data: T[], page: number, pageSize: number): { items: T[]; pagination: Pagination } {
  const totalRows = data.length
  const totalPages = Math.ceil(totalRows / pageSize)

  // Validate page number
  if (page < 0 || (page >= totalPages && totalRows > 0)) {
    throw new Error(`PAGE_OUT_OF_RANGE: Page ${page} does not exist (total pages: ${totalPages})`)
  }

  const startIndex = page * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalRows)
  const items = data.slice(startIndex, endIndex)

  const pagination: Pagination = {
    page,
    pageSize,
    totalPages,
    totalRows,
    hasNext: page < totalPages - 1,
    hasPrevious: page > 0,
  }

  return { items, pagination }
}

export function convertToArrayFormat(data: unknown[]): unknown[][] {
  if (data.length === 0) return []

  const firstItem = data[0] as Record<string, unknown>
  const columns = Object.keys(firstItem)

  return data.map((item) => {
    const record = item as Record<string, unknown>
    return columns.map((col) => record[col])
  })
}

export function getColumns(data: unknown[]): string[] {
  if (data.length === 0) return []
  const firstItem = data[0] as Record<string, unknown>
  return Object.keys(firstItem)
}
