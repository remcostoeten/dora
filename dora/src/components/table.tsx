'use client'

import { CellFormatter } from '@/lib/cell-formatter'

type TableProps = {
  columns: string[]
  data: unknown[][]
}

export function Table({ columns, data }: TableProps) {
  async function copyCellValue(value: unknown) {
    try {
      const formatted = CellFormatter.formatCellForCopy(value)
      await navigator.clipboard.writeText(formatted)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  return (
    <div className="h-full w-full overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-card border-b border-border">
          <tr>
            {columns.map((column, index) => (
              <th
                key={index}
                className="px-4 py-2 text-left font-semibold text-foreground"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
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
      {data.length === 0 && (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          No results
        </div>
      )}
    </div>
  )
}
