import { Copy } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Button } from '@studio/shared/ui/button'
import { ScrollArea } from '@studio/shared/ui/scroll-area'
import { useSettings } from '@studio/core/settings'
import { MASK_TOKEN, maskRowsForJson } from '@studio/core/privacy/mask'
import { QueryResult } from '../types'

type Props = {
	result: QueryResult | null
	showJson: boolean
}

const VIRTUALIZE_THRESHOLD = 100

export function ResultsPanel({ result, showJson }: Props) {
	const { settings } = useSettings()
	const masked = settings.privacyMaskData

	const [scrollViewport, setScrollViewport] = useState<HTMLDivElement | null>(null)
	const scrollAreaRef = useCallback((node: HTMLDivElement | null) => {
		setScrollViewport(
			node?.querySelector<HTMLDivElement>('[data-radix-scroll-area-viewport]') ?? null
		)
	}, [])

	const rowCount = result?.rows.length ?? 0
	const shouldVirtualize = !showJson && rowCount > VIRTUALIZE_THRESHOLD
	const rowVirtualizer = useVirtualizer({
		count: shouldVirtualize ? rowCount : 0,
		getScrollElement: () => scrollViewport,
		estimateSize: () => 37,
		overscan: 12,
		enabled: shouldVirtualize
	})

	if (!result) {
		return (
			<div className='flex items-center justify-center h-full text-muted-foreground text-sm'>
				Run a query to see results
			</div>
		)
	}

	if (result.error) {
		return (
			<div className='flex items-center justify-center h-full p-4'>
				<div className='text-destructive text-sm font-mono bg-destructive/10 px-4 py-3 rounded-md border border-destructive/20'>
					{result.error}
				</div>
			</div>
		)
	}

	if (result.rows.length === 0) {
		return (
			<div className='flex flex-col items-center justify-center h-full text-muted-foreground'>
				<span className='text-sm'>No rows</span>
				<span className='text-xs mt-1'>Query executed in {result.executionTime}ms</span>
			</div>
		)
	}

	if (showJson) {
		// Privacy mode: mask values before serializing so the JSON view doesn't
		// leak the raw data.
		const jsonText = JSON.stringify(
			masked ? maskRowsForJson(result.rows) : result.rows,
			null,
			2
		)
		return (
			<div className='relative h-full'>
				<ScrollArea className='h-full'>
					<pre className='p-4 text-sm font-mono text-sidebar-foreground whitespace-pre-wrap'>
						{jsonText}
					</pre>
				</ScrollArea>
				<Button
					variant='ghost'
					size='icon'
					className='absolute top-2 right-2 h-7 w-7 bg-background/80 backdrop-blur-xs border border-border hover:bg-background z-10'
					onClick={() => navigator.clipboard.writeText(jsonText)}
					title='Copy JSON'
				>
					<Copy className='h-3.5 w-3.5' />
				</Button>
			</div>
		)
	}

	const virtualRows = shouldVirtualize ? rowVirtualizer.getVirtualItems() : null
	const totalVirtualSize = shouldVirtualize ? rowVirtualizer.getTotalSize() : 0
	const topPad = virtualRows && virtualRows.length > 0 ? virtualRows[0].start : 0
	const bottomPad =
		virtualRows && virtualRows.length > 0
			? totalVirtualSize - virtualRows[virtualRows.length - 1].end
			: 0
	const rowIndexesToRender = virtualRows
		? virtualRows.map((vr) => vr.index)
		: result.rows.map((_, i) => i)

	return (
		<div className='flex flex-col h-full'>
			{/* Status bar */}
			<div className='flex items-center justify-between px-3 py-1.5 border-b border-sidebar-border text-xs text-muted-foreground'>
				<span>
					{result.rowCount} row{result.rowCount !== 1 ? 's' : ''}
				</span>
				<span>{result.executionTime}ms</span>
			</div>

			{/* Data table */}
			<ScrollArea ref={scrollAreaRef} className='flex-1'>
				<table className='w-full text-sm'>
					<thead className='sticky top-0 bg-sidebar-accent'>
						<tr>
							{result.columns.map((col) => (
								<th
									key={col}
									className='px-3 py-2 text-left font-medium text-sidebar-foreground border-b border-r border-sidebar-border last:border-r-0'
								>
									{col}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{topPad > 0 && (
							<tr style={{ height: topPad }}>
								<td colSpan={result.columns.length} />
							</tr>
						)}
						{rowIndexesToRender.map((rowIndex) => {
							const row = result.rows[rowIndex]
							return (
								<tr
									key={rowIndex}
									className='hover:bg-sidebar-accent/50 transition-colors'
								>
									{result.columns.map((col) => (
										<td
											key={col}
											className='px-3 py-2 text-sidebar-foreground border-b border-r border-sidebar-border last:border-r-0 font-mono'
										>
											{masked ? (
												<span className='select-none tracking-widest text-muted-foreground'>
													{MASK_TOKEN}
												</span>
											) : (
												formatCellValue(row[col])
											)}
										</td>
									))}
								</tr>
							)
						})}
						{bottomPad > 0 && (
							<tr style={{ height: bottomPad }}>
								<td colSpan={result.columns.length} />
							</tr>
						)}
					</tbody>
				</table>
			</ScrollArea>
		</div>
	)
}

function formatCellValue(value: unknown): string {
	if (value === null || value === undefined) {
		return 'NULL'
	}
	if (typeof value === 'object') {
		return JSON.stringify(value)
	}
	return String(value)
}
