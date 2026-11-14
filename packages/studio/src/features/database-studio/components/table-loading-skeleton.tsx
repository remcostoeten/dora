import { memo, useEffect, useState } from 'react'
import { TableSkeleton } from '@studio/shared/ui/skeleton'

const TABLE_SKELETON_DELAY_MS = 150

type Props = {
	active: boolean
	rows: number
	columns: number | Array<{ name: string; width?: number }>
}

export const TableLoadingSkeleton = memo(function TableLoadingSkeleton({
	active,
	rows,
	columns
}: Props) {
	const [hasWaited, setHasWaited] = useState(false)
	if (!active && hasWaited) setHasWaited(false)

	useEffect(
		function waitBeforeShowing() {
			if (!active) return
			const timer = window.setTimeout(function () {
				setHasWaited(true)
			}, TABLE_SKELETON_DELAY_MS)
			return function () {
				window.clearTimeout(timer)
			}
		},
		[active]
	)

	if (!active || !hasWaited) return null

	return (
		<div
			className='absolute inset-0 bg-background z-10'
			role='status'
			aria-live='polite'
			aria-label='Loading table data'
		>
			<TableSkeleton rows={rows} columns={columns} />
		</div>
	)
})
