import { useMemo, useRef } from 'react'
import { useLiveMonitor } from '@/core/live-monitor'
import { useNuqsState } from '@/core/url-state/use-nuqs-state'

export function useDatabaseStudioSync(tableRefName: string | null, tableName: string | null) {
	const liveMonitor = useLiveMonitor()
	const {
		urlState,
		setSelectedRow,
		setSelectedCells,
		setFocusedCell,
		setContextMenu,
		setAddRecordMode
	} = useNuqsState()
	const initializedFromUrlRef = useRef(false)
	const isUpdatingUrlRef = useRef(false)

	const stableUrlState = useMemo(
		function () {
			return urlState
		},
		[
			urlState.selectedRow,
			urlState.focusedCell?.row,
			urlState.focusedCell?.col,
			urlState.addRecordMode,
			urlState.addRecordIndex
		]
	)

	return {
		liveMonitor,
		stableUrlState,
		setSelectedRow,
		setSelectedCells,
		setFocusedCell,
		setContextMenu,
		setAddRecordMode,
		initializedFromUrlRef,
		isUpdatingUrlRef,
		tableRefName,
		tableName
	}
}
