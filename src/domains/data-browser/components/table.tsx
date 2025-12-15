'use client'

import { useState, useMemo } from 'react'
import { CellFormatter } from '@/core/formatters'
import { Button } from '@/components/ui/button'
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Download } from 'lucide-react'

type SortDirection = 'asc' | 'desc' | null

type TableProps = {
  columns: string[]
  data: unknown[][]
}

export function Table({ columns, data }: TableProps) {
  const [sortColumn, setSortColumn] = useState<number | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 100

  const sortedData = useMemo(() => {
    if (sortColumn === null || !sortDirection) return data

    return [...data].sort((a, b) => {
      const aValue = a[sortColumn]
      const bValue = b[sortColumn]

      // Handle null values
      if (aValue === null && bValue === null) return 0
      if (aValue === null) return 1
      if (bValue === null) return -1

      // Type-aware comparison
      let comparison = 0
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue
      } else if (aValue instanceof Date && bValue instanceof Date) {
        comparison = aValue.getTime() - bValue.getTime()
      } else {
        const aStr = String(aValue).toLowerCase()
        const bStr = String(bValue).toLowerCase()
        comparison = aStr.localeCompare(bStr)
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [data, sortColumn, sortDirection])

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return sortedData.slice(startIndex, endIndex)
  }, [sortedData, currentPage])

  const totalPages = Math.ceil(sortedData.length / pageSize)

  // Reset to page 1 when sorting changes
  const handleSort = (columnIndex: number) => {
    setCurrentPage(1)

    if (sortColumn === columnIndex) {
      // Toggle direction or reset if already descending
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortColumn(null)
        setSortDirection(null)
      }
    } else {
      // New column, sort ascending
      setSortColumn(columnIndex)
      setSortDirection('asc')
    }
  }

  async function copyCellValue(value: unknown) {
    try {
      const formatted = CellFormatter.formatCellForCopy(value)
      await navigator.clipboard.writeText(formatted)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  function getSortIcon(columnIndex: number) {
    if (sortColumn !== columnIndex) {
      return <ArrowUpDown className="h-3 w-3 opacity-50" />
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="h-3 w-3" />
    }
    if (sortDirection === 'desc') {
      return <ArrowDown className="h-3 w-3" />
    }
    return <ArrowUpDown className="h-3 w-3 opacity-50" />
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  function exportToCSV() {
    const csvContent = [
      columns.join(','),
      ...sortedData.map(row =>
        row.map(cell => {
          const value = cell === null ? 'NULL' : String(cell)
          // Escape quotes and wrap in quotes if contains comma or quote
          if (value.includes(',') || value.includes('"')) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        }).join(',')
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `export_${new Date().toISOString().slice(0, 10)}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  function exportToJSON() {
    const jsonData = sortedData.map(row => {
      const obj: Record<string, unknown> = {}
      columns.forEach((col, index) => {
        obj[col] = row[index]
      })
      return obj
    })

    const jsonContent = JSON.stringify(jsonData, null, 2)
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `export_${new Date().toISOString().slice(0, 10)}.json`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-card border-b border-border">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={index}
                  className="px-4 py-2 text-left font-semibold text-foreground"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 font-semibold hover:bg-transparent"
                    onClick={() => handleSort(index)}
                  >
                    <span className="mr-2">{column}</span>
                    {getSortIcon(index)}
                  </Button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b border-border hover:bg-accent/50 transition-colors"
              >
                {row.map((cell, cellIndex) => {
                  const cellType = CellFormatter.getCellType(cell)
                  return (
                    <td
                      key={cellIndex}
                      className="px-4 py-2 cursor-pointer"
                      onClick={() => copyCellValue(cell)}
                      title={CellFormatter.formatCellTitle(cell)}
                    >
                      <span
                        className={
                          cellType === 'null'
                            ? 'text-muted-foreground italic'
                            : cellType === 'number'
                              ? 'text-primary'
                              : cellType === 'boolean'
                                ? 'text-warning'
                                : cellType === 'object'
                                  ? 'text-success'
                                  : ''
                        }
                      >
                        {CellFormatter.formatCellDisplay(cell as never)}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {paginatedData.length === 0 && (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            No results
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {(totalPages > 1 || sortedData.length > 0) && (
        <div className="border-t border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div className="text-muted-foreground">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} results
              </div>

              {/* Export Controls */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToCSV}
                  disabled={sortedData.length === 0}
                >
                  <Download className="h-4 w-4 mr-1" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToJSON}
                  disabled={sortedData.length === 0}
                >
                  <Download className="h-4 w-4 mr-1" />
                  JSON
                </Button>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => goToPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
