import { Check, X } from 'lucide-react'
import React from 'react'
import { ColumnDefinition } from '../../types'
import { DateCell } from '../cells/date-cell'
import { IpCell } from '../cells/ip-cell'
import { TokenCell } from '../cells/token-cell'

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
		return <span className='text-warning'>{JSON.stringify(value)}</span>
	}

	return <span className='text-foreground'>{String(value)}</span>
}
