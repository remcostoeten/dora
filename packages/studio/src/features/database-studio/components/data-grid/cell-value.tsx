import { Check, X, ChevronRight, ChevronDown } from 'lucide-react'
import React, { useState } from 'react'
import { ColumnDefinition } from '../../types'
import { DateCell } from '../cells/date-cell'
import { IpCell } from '../cells/ip-cell'
import { TokenCell } from '../cells/token-cell'

function JsonCell({ value }: { value: object }) {
	const [expanded, setExpanded] = useState(false)
	const isArray = Array.isArray(value)
	const keys = isArray ? value.length : Object.keys(value).length
	const summary = isArray ? `[${keys} item${keys !== 1 ? 's' : ''}]` : `{${keys} key${keys !== 1 ? 's' : ''}}`

	if (!expanded) {
		return (
			<button
				className='flex items-center gap-1 text-warning hover:text-warning/80 font-mono text-xs transition-colors'
				onClick={function (e) {
					e.stopPropagation()
					setExpanded(true)
				}}
			>
				<ChevronRight className='w-3 h-3 shrink-0' />
				<span>{summary}</span>
			</button>
		)
	}

	return (
		<div className='text-xs font-mono' onClick={function (e) { e.stopPropagation() }}>
			<button
				className='flex items-center gap-1 text-warning hover:text-warning/80 transition-colors mb-1'
				onClick={function () { setExpanded(false) }}
			>
				<ChevronDown className='w-3 h-3 shrink-0' />
				<span>{summary}</span>
			</button>
			<div className='max-h-48 overflow-auto rounded border border-sidebar-border bg-sidebar/60 p-2 space-y-0.5'>
				{isArray
					? (value as unknown[]).map(function (item, i) {
						return (
							<div key={i} className='flex gap-2'>
								<span className='text-muted-foreground shrink-0'>{i}</span>
								<span className='text-foreground break-all'>
									{typeof item === 'object' && item !== null
										? JSON.stringify(item)
										: String(item)}
								</span>
							</div>
						)
					})
					: Object.entries(value as Record<string, unknown>).map(function ([k, v]) {
						return (
							<div key={k} className='flex gap-2'>
								<span className='text-primary/70 shrink-0'>{k}:</span>
								<span className='text-foreground break-all'>
									{typeof v === 'object' && v !== null
										? JSON.stringify(v)
										: String(v ?? 'null')}
								</span>
							</div>
						)
					})}
			</div>
		</div>
	)
}

function tryParseJson(value: string): object | null {
	const trimmed = value.trimStart()
	if (trimmed[0] !== '{' && trimmed[0] !== '[') return null
	try {
		const parsed = JSON.parse(value)
		return typeof parsed === 'object' && parsed !== null ? parsed : null
	} catch {
		return null
	}
}

export function formatCellValue(value: unknown, column: ColumnDefinition): React.ReactNode {
	if (value === null || value === undefined) {
		return <span className='text-muted-foreground italic'>NULL</span>
	}

	const colName = column.name.toLowerCase()

	if (colName.includes('ip_address') || colName.includes('ip_addr')) {
		return <IpCell value={String(value)} />
	}

	if (
		(colName.includes('token') ||
			colName.includes('hash') ||
			colName.includes('key') ||
			colName.includes('signature')) &&
		typeof value === 'string' &&
		value.length > 20
	) {
		return <TokenCell value={value} />
	}

	if (
		colName.endsWith('_at') ||
		colName.endsWith('_date') ||
		colName === 'date' ||
		colName === 'timestamp' ||
		column.type?.includes('timestamp') ||
		column.type?.includes('date')
	) {
		return <DateCell value={value} columnName={colName} />
	}

	if (typeof value === 'boolean') {
		return (
			<div className='flex items-center justify-center'>
				{value ? (
					<Check className='w-3.5 h-3.5 text-emerald-500' />
				) : (
					<X className='w-3.5 h-3.5 text-muted-foreground/30' />
				)}
			</div>
		)
	}

	if (typeof value === 'number') {
		return <div className='text-right font-mono text-primary w-full'>{value}</div>
	}

	if (typeof value === 'object') {
		return <JsonCell value={value as object} />
	}

	// JSON stored as string (common in Postgres jsonb / MySQL JSON columns)
	if (typeof value === 'string' && column.type?.toLowerCase().includes('json')) {
		const parsed = tryParseJson(value)
		if (parsed) return <JsonCell value={parsed} />
	}

	return <span className='text-foreground'>{String(value)}</span>
}
