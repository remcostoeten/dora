import { useMemo, useState } from 'react'
import { vi } from 'vitest'
import { usePendingEdits } from '@studio/core/pending-edits'
import { DataGrid } from '@studio/features/database-studio/components/data-grid'
import type { StagedAction } from '@studio/features/database-studio/components/data-grid/grid-edits'
import { DiscardEditsDialog } from '@studio/features/database-studio/components/discard-edits-dialog'
import { PendingSqlPreviewDialog } from '@studio/features/database-studio/components/pending-sql-preview-dialog'
import { useDatabaseStudioEdits } from '@studio/features/database-studio/hooks/use-database-studio-edits'
import type { TableData } from '@studio/features/database-studio/types'
import { buildPendingEditsSql } from '@studio/features/database-studio/utils/pending-edits-sql'
import { PEOPLE_COLUMNS, createPeople } from './grid-harness'

const TABLE_ID = 'people'

export function createStagingMocks() {
	return {
		updateCell: { mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(undefined) },
		updateCells: { mutateAsync: vi.fn().mockResolvedValue(undefined) },
		loadTableData: vi.fn(),
		notifyActionFailure: vi.fn(),
		notifyMissingPrimaryKey: vi.fn()
	}
}

type Props = {
	connectionId: string
	mocks: ReturnType<typeof createStagingMocks>
}

export function StagingHarness({ connectionId, mocks }: Props) {
	const [tableData, setTableData] = useState<TableData | null>({
		columns: PEOPLE_COLUMNS,
		rows: createPeople(4),
		totalCount: 4,
		executionTime: 0
	})
	const [selectedRows, setSelectedRows] = useState(new Set<number>())
	const [selectedCells, setSelectedCells] = useState(new Set<string>())
	const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null)
	const [isDiscardOpen, setIsDiscardOpen] = useState(false)
	const [isPreviewOpen, setIsPreviewOpen] = useState(false)
	const pending = usePendingEdits(connectionId)

	const edits = useDatabaseStudioEdits({
		activeConnectionId: connectionId,
		tableId: TABLE_ID,
		tableRefName: TABLE_ID,
		tableData,
		isDryEditMode: pending.isDryEditMode,
		pendingEdits: pending.pendingEdits,
		getEditsForTable: pending.getEditsForTable,
		hasEdits: pending.hasEdits,
		addEdit: pending.addEdit,
		addEdits: pending.addEdits,
		removeEdit: pending.removeEdit,
		revertEdits: pending.revertEdits,
		clearEdits: pending.clearEdits,
		undoStagedEdit: pending.undoStagedEdit,
		redoStagedEdit: pending.redoStagedEdit,
		updateCell: mocks.updateCell,
		updateCells: mocks.updateCells,
		setTableData,
		setIsApplyingEdits: vi.fn(),
		loadTableData: mocks.loadTableData,
		trackCellMutation: vi.fn(),
		trackBatchCellMutation: vi.fn(),
		notifyMissingPrimaryKey: mocks.notifyMissingPrimaryKey,
		notifyActionFailure: mocks.notifyActionFailure
	})

	const stagedEdits = pending.getEditsForTable(TABLE_ID)
	const dirtyCells = useMemo(
		() => new Set(stagedEdits.map((edit) => `${edit.primaryKeyValue}:${edit.columnName}`)),
		[stagedEdits]
	)

	function handleStagedAction(action: StagedAction) {
		if (action === 'toggle-dry-mode') pending.setDryEditMode(!pending.isDryEditMode)
		if (action === 'apply') void edits.handleApplyPendingEdits()
		if (action === 'discard') setIsDiscardOpen(true)
		if (action === 'preview') setIsPreviewOpen(true)
		if (action === 'undo') edits.handleUndoStaged()
		if (action === 'redo') edits.handleRedoStaged()
	}

	function focusGrid() {
		document.querySelector<HTMLElement>('table[role="grid"]')?.focus()
	}

	if (!tableData) return null

	return (
		<>
			<output aria-label='Staged edits'>{stagedEdits.length}</output>
			<output aria-label='Dry run mode'>{pending.isDryEditMode ? 'on' : 'off'}</output>
			<DataGrid
				columns={tableData.columns}
				rows={tableData.rows}
				tableName='people'
				workspaceStateKey={`staging-${connectionId}`}
				selectedRows={selectedRows}
				onRowSelect={(rowIndex, checked) => {
					setSelectedRows((current) => {
						const next = new Set(current)
						if (checked) next.add(rowIndex)
						else next.delete(rowIndex)
						return next
					})
				}}
				onSelectAll={() => setSelectedRows(new Set())}
				selectedCells={selectedCells}
				onCellSelectionChange={setSelectedCells}
				initialFocusedCell={focusedCell}
				onFocusedCellChange={setFocusedCell}
				onCellEdit={edits.handleCellEdit}
				onCellsEdit={edits.handleCellsEdit}
				onBatchCellEdit={edits.handleBatchCellEdit}
				pendingEdits={dirtyCells}
				onStagedAction={handleStagedAction}
				onRevertStaged={edits.handleRevertStaged}
			/>
			<DiscardEditsDialog
				open={isDiscardOpen}
				onOpenChange={setIsDiscardOpen}
				editCount={stagedEdits.length}
				onConfirm={() => {
					setIsDiscardOpen(false)
					edits.handleDiscardPendingEdits()
				}}
				onReturnFocus={focusGrid}
			/>
			<PendingSqlPreviewDialog
				open={isPreviewOpen}
				onOpenChange={setIsPreviewOpen}
				statements={isPreviewOpen ? buildPendingEditsSql(stagedEdits, TABLE_ID) : []}
				onReturnFocus={focusGrid}
			/>
		</>
	)
}
