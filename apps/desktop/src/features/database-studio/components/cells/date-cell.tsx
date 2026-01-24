import { format, formatDistanceToNow, isPast, isFuture, isValid, parseISO } from 'date-fns'
import React from 'react'
import { cn } from '@/shared/utils/cn'

type Props = {
	value: unknown
	columnName: string
}

export function DateCell({ value, columnName }: Props) {
	if (!value) return <span className='text-muted-foreground italic'>NULL</span>

	const dateStr = String(value)
	const date = parseISO(dateStr)

	if (!isValid(date)) {
		return <span className='text-foreground'>{dateStr}</span>
	}

	const isExpiringColumn = columnName.includes('expires') || columnName.includes('expiration')
	const isPastDate = isPast(date)
	const relativeTime = formatDistanceToNow(date, { addSuffix: true })
	const fullDate = format(date, 'yyyy-MM-dd')
	const time = format(date, 'HH:mm:ss')

	return (
		<div
			className='group flex items-center gap-2 min-w-0'
			title={`${fullDate} ${time} (${relativeTime})`}
		>
			{isExpiringColumn && (
				<div
					className={cn(
						'w-1.5 h-1.5 rounded-full shrink-0',
						isPastDate ? 'bg-muted-foreground/30' : 'bg-emerald-500'
					)}
				/>
			)}
			<div className='flex items-baseline gap-1.5 truncate font-mono text-xs'>
				<span
					className={cn(
						'text-foreground',
						isExpiringColumn &&
							isPastDate &&
							'text-muted-foreground line-through decoration-muted-foreground/50'
					)}
				>
					{fullDate}
				</span>
				<span className='text-muted-foreground/50 text-[10px] group-hover:text-muted-foreground transition-colors'>
					{time}
				</span>
			</div>
		</div>
	)
}
