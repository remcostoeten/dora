import type { ColumnDefinition } from '../types'

type Props = {
	open: boolean
	onClose: () => void
	row: Record<string, unknown>
	columns: ColumnDefinition[]
	tableName: string
}

export function RowDetailPanel({ open, onClose, row, columns, tableName }: Props) {
	if (!open) return null

	return (
		<div className='fixed inset-y-0 right-0 w-96 bg-card border-l border-sidebar-border shadow-xl z-50 flex flex-col'>
			<div className='flex items-center justify-between h-12 px-4 border-b border-sidebar-border shrink-0'>
				<h2 className='text-sm font-semibold text-foreground'>Row Details</h2>
				<button
					onClick={onClose}
					className='h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-md transition-colors'
				>
					<svg
						className='h-4 w-4'
						viewBox='0 0 24 24'
						fill='none'
						stroke='currentColor'
						strokeWidth='2'
					>
						<line x1='18' y1='6' x2='6' y2='18' />
						<line x1='6' y1='6' x2='18' y2='18' />
					</svg>
				</button>
			</div>

			<div className='flex-1 overflow-y-auto p-4'>
				<div className='text-xs text-muted-foreground mb-4'>
					Table: <span className='font-mono text-foreground'>{tableName}</span>
				</div>

				<div className='space-y-4'>
					{columns.map(function renderColumn(col) {
						const value = row[col.name]
						const displayValue =
							value === null
								? 'NULL'
								: value === undefined
									? '—'
									: typeof value === 'object'
										? JSON.stringify(value, null, 2)
										: String(value)

						const isNull = value === null
						const isLongText = typeof value === 'string' && value.length > 100

						return (
							<div key={col.name} className='space-y-1'>
								<div className='flex items-center gap-2'>
									<span className='text-sm font-medium text-foreground'>
										{col.name}
									</span>
									{col.primaryKey && (
										<span className='text-[10px] px-1.5 py-0.5 rounded bg-warning/20 text-warning font-medium'>
											PK
										</span>
									)}
									<span className='text-xs text-muted-foreground font-mono'>
										{col.type}
									</span>
								</div>
								<div
									className={`text-sm p-2 rounded-md border border-sidebar-border bg-sidebar ${isNull ? 'text-muted-foreground italic' : 'text-foreground'} ${isLongText ? 'font-mono text-xs whitespace-pre-wrap break-all' : ''}`}
								>
									{displayValue}
								</div>
							</div>
						)
					})}
				</div>
			</div>
		</div>
	)
}
