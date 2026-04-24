import { Check, X } from 'lucide-react'
import type React from 'react'
import { matchesShortcut, parseShortcut } from '@/core/shortcuts'
import { ColumnDefinition } from '../../types'

const enterShortcut = parseShortcut('enter')
const escapeShortcut = parseShortcut('escape')
const tabShortcut = parseShortcut('tab')
const shiftTabShortcut = parseShortcut('shift+tab')

type Props = {
	columns: ColumnDefinition[]
	draftRow: Record<string, unknown>
	getColumnWidth: (columnName: string) => number | undefined
	onDraftChange?: (columnName: string, value: unknown) => void
	onDraftSave?: () => void
	onDraftCancel?: () => void
	variant: 'top' | 'inline'
}

export function DraftRow({
	columns,
	draftRow,
	getColumnWidth,
	onDraftChange,
	onDraftSave,
	onDraftCancel,
	variant
}: Props) {
	const isTop = variant === 'top'

	return (
		<tr
			className={
				isTop
					? 'bg-emerald-500/10 border-l-2 border-l-emerald-500'
					: 'bg-emerald-500/10 border-b border-sidebar-border group relative'
			}
		>
			<td
				className={
					isTop
						? 'px-1 py-1.5 text-center border-b border-r border-sidebar-border'
						: 'w-[30px] border-r border-sidebar-border bg-emerald-500/20 text-center align-middle'
				}
			>
				{isTop ? (
					<DraftActions onDraftSave={onDraftSave} onDraftCancel={onDraftCancel} />
				) : (
					<div className='h-full w-full flex items-center justify-center text-emerald-500 font-bold text-xs'>
						+
					</div>
				)}
			</td>
			{columns.map(function (col, colIndex) {
				const width = getColumnWidth(col.name)

				return (
					<td
						key={isTop ? col.name : `draft-${col.name}`}
						className='border-b border-r border-sidebar-border last:border-r-0 font-mono text-sm px-0 py-0'
						style={width ? { maxWidth: width } : undefined}
					>
						{col.primaryKey ? (
							<div className='px-3 py-1.5 text-muted-foreground italic text-xs'>
								auto
							</div>
						) : (
							<DraftInput
								col={col}
								colIndex={colIndex}
								columns={columns}
								draftRow={draftRow}
								onDraftChange={onDraftChange}
								onDraftSave={onDraftSave}
								onDraftCancel={onDraftCancel}
							/>
						)}
					</td>
				)
			})}
			{!isTop && (
				<td className='w-[80px] border-b border-sidebar-border p-0'>
					<DraftActions onDraftSave={onDraftSave} onDraftCancel={onDraftCancel} />
				</td>
			)}
		</tr>
	)
}

type TProps = {
	col: ColumnDefinition
	colIndex: number
	columns: ColumnDefinition[]
	draftRow: Record<string, unknown>
	onDraftChange?: (columnName: string, value: unknown) => void
	onDraftSave?: () => void
	onDraftCancel?: () => void
}

function DraftInput({
	col,
	colIndex,
	columns,
	draftRow,
	onDraftChange,
	onDraftSave,
	onDraftCancel
}: TProps) {
	return (
		<input
			type='text'
			autoFocus={colIndex === 0 || (colIndex === 1 && columns[0]?.primaryKey)}
			value={draftRow[col.name] === null ? '' : String(draftRow[col.name] ?? '')}
			onChange={function (e) {
				onDraftChange?.(col.name, e.target.value)
			}}
			onKeyDown={function (e) {
				handleDraftKeyDown(e, col.name, columns, onDraftSave, onDraftCancel)
			}}
			data-draft-col={col.name}
			data-no-shortcuts='true'
			className='w-full h-full bg-transparent px-3 py-1.5 outline-none focus:bg-emerald-500/10 font-mono text-sm'
			placeholder={col.nullable ? 'NULL' : ''}
		/>
	)
}

function handleDraftKeyDown(
	e: React.KeyboardEvent<HTMLInputElement>,
	columnName: string,
	columns: ColumnDefinition[],
	onDraftSave?: () => void,
	onDraftCancel?: () => void
) {
	const nativeEvent = e.nativeEvent

	if (matchesShortcut(nativeEvent, enterShortcut)) {
		e.preventDefault()
		onDraftSave?.()
		return
	}

	if (matchesShortcut(nativeEvent, escapeShortcut)) {
		e.preventDefault()
		onDraftCancel?.()
		return
	}

	const isShiftTab = matchesShortcut(nativeEvent, shiftTabShortcut)
	const isTab = matchesShortcut(nativeEvent, tabShortcut)

	if (!isShiftTab && !isTab) return

	const editableCols = columns.filter(function (c) {
		return !c.primaryKey
	})
	const curIdx = editableCols.findIndex(function (c) {
		return c.name === columnName
	})

	if (isShiftTab) {
		if (curIdx > 0) {
			e.preventDefault()
			const prev = e.currentTarget
				.closest('tr')
				?.querySelector<HTMLInputElement>(
					`input[data-draft-col="${editableCols[curIdx - 1].name}"]`
				)
			prev?.focus()
		}
		return
	}

	if (isTab) {
		if (curIdx < editableCols.length - 1) {
			e.preventDefault()
			const next = e.currentTarget
				.closest('tr')
				?.querySelector<HTMLInputElement>(
					`input[data-draft-col="${editableCols[curIdx + 1].name}"]`
				)
			next?.focus()
			return
		}

		e.preventDefault()
		onDraftSave?.()
		return
	}
}

type DraftActionsProps = {
	onDraftSave?: () => void
	onDraftCancel?: () => void
}

function DraftActions({ onDraftSave, onDraftCancel }: DraftActionsProps) {
	return (
		<div className='flex items-center justify-center h-full gap-1 px-2'>
			<button
				type='button'
				onClick={onDraftSave}
				className='inline-flex h-6 w-6 items-center justify-center text-emerald-500 hover:text-emerald-400 transition-colors'
				title='Save (Enter)'
				aria-label='Save draft row'
			>
				<Check className='h-3.5 w-3.5' />
			</button>
			<button
				type='button'
				onClick={onDraftCancel}
				className='inline-flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-destructive transition-colors'
				title='Cancel (Escape)'
				aria-label='Cancel draft row'
			>
				<X className='h-3.5 w-3.5' />
			</button>
		</div>
	)
}
