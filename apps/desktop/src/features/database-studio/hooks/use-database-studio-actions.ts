import { useCallback } from 'react'
import { useToast } from '@/shared/ui/use-toast'
import { useDatabaseStudioBulkActions } from './use-database-studio-bulk-actions'
import { useDatabaseStudioDraftRow } from './use-database-studio-draft-row'
import { useDatabaseStudioRowActions } from './use-database-studio-row-actions'
import type { FilterDescriptor, TableData } from '../types'

type EditingRowState = {
	primaryKeyColumn: string
	primaryKeyValue: unknown
	originalRow: Record<string, unknown>
} | null

type Args = {
	activeConnectionId?: string
	tableId: string | null
	tableName: string | null
	tableRefName: string | null
	tableData: TableData | null
	draftRow: Record<string, unknown> | null
	addDialogMode: 'add' | 'duplicate' | 'edit'
	editingRowState: EditingRowState
	selectedRows: Set<number>
	rowsForActions: Set<number>
	settingsConfirmBeforeDelete: boolean
	updateCell: { mutate: Function; mutateAsync: Function }
	deleteRows: { mutate: Function }
	insertRow: { mutateAsync: Function; mutate: Function }
	onLoadTableData: () => void
	setSelectedRows: React.Dispatch<React.SetStateAction<Set<number>>>
	setSelectedCells: React.Dispatch<React.SetStateAction<Set<string>>>
	setFocusedCell: React.Dispatch<React.SetStateAction<{ row: number; col: number } | null>>
	setShowDeleteConfirmDialog: React.Dispatch<React.SetStateAction<boolean>>
	setPendingSingleDeleteRow: React.Dispatch<
		React.SetStateAction<{
			row: Record<string, unknown>
			primaryKeyColumn: string
			primaryKeyValue: unknown
		} | null>
	>
	setShowAddDialog: React.Dispatch<React.SetStateAction<boolean>>
	setIsBulkActionLoading: React.Dispatch<React.SetStateAction<boolean>>
	setDraftRow: React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>
	setDraftInsertIndex: React.Dispatch<React.SetStateAction<number | null>>
	setEditingRowState: React.Dispatch<React.SetStateAction<EditingRowState>>
	setDuplicateInitialData: React.Dispatch<React.SetStateAction<Record<string, unknown> | undefined>>
	setAddDialogMode: React.Dispatch<React.SetStateAction<'add' | 'duplicate' | 'edit'>>
	setSelectedRowForDetail: React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>
	setShowRowDetail: React.Dispatch<React.SetStateAction<boolean>>
	setFilters: React.Dispatch<React.SetStateAction<FilterDescriptor[]>>
	displayTableName: string | null
}

export function useDatabaseStudioActions(args: Args) {
	const { toast } = useToast()
	const {
		activeConnectionId,
		tableId,
		tableName,
		tableRefName,
		tableData,
		draftRow,
		addDialogMode,
		editingRowState,
		selectedRows,
		rowsForActions,
		settingsConfirmBeforeDelete,
		updateCell,
		deleteRows,
		insertRow,
		onLoadTableData,
		setSelectedRows,
		setSelectedCells,
		setFocusedCell,
		setShowDeleteConfirmDialog,
		setPendingSingleDeleteRow,
		setShowAddDialog,
		setIsBulkActionLoading,
		setDraftRow,
		setDraftInsertIndex,
		setEditingRowState,
		setDuplicateInitialData,
		setAddDialogMode,
		setSelectedRowForDetail,
		setShowRowDetail,
		setFilters,
		displayTableName
	} = args

	const notifyActionFailure = useCallback(function (title: string, error: unknown) {
		toast({
			title,
			description: error instanceof Error ? error.message : 'An error occurred',
			variant: 'destructive'
		})
	}, [toast])

	const notifyMissingPrimaryKey = useCallback(function (actionLabel: string) {
		toast({
			title: `Cannot ${actionLabel}`,
			description: `Table "${displayTableName ?? tableRefName}" has no primary key, so this action cannot be saved safely.`,
			variant: 'destructive'
		})
	}, [displayTableName, tableRefName, toast])

	const bulkActions = useDatabaseStudioBulkActions({
		activeConnectionId,
		tableId,
		tableName,
		tableRefName,
		tableData,
		selectedRows,
		rowsForActions,
		settingsConfirmBeforeDelete,
		deleteRows,
		insertRow,
		onLoadTableData,
		setSelectedRows,
		setSelectedCells,
		setFocusedCell,
		setShowDeleteConfirmDialog,
		setIsBulkActionLoading,
		setFilters,
		notifyActionFailure
	})

	const rowActions = useDatabaseStudioRowActions({
		activeConnectionId,
		tableId,
		tableRefName,
		tableData,
		settingsConfirmBeforeDelete,
		deleteRows,
		insertRow,
		onLoadTableData,
		setSelectedRows,
		setShowDeleteConfirmDialog,
		setPendingSingleDeleteRow,
		setIsBulkActionLoading,
		setDraftRow,
		setDraftInsertIndex,
		setEditingRowState,
		setDuplicateInitialData,
		setAddDialogMode,
		setShowAddDialog,
		setSelectedRowForDetail,
		setShowRowDetail,
		notifyMissingPrimaryKey,
		notifyActionFailure
	})

	const draftRowActions = useDatabaseStudioDraftRow({
		activeConnectionId,
		tableId,
		tableRefName,
		tableData,
		draftRow,
		addDialogMode,
		editingRowState,
		updateCell,
		insertRow,
		onLoadTableData,
		setDraftRow,
		setDraftInsertIndex,
		setEditingRowState,
		setDuplicateInitialData,
		setAddDialogMode,
		setShowAddDialog,
		notifyActionFailure
	})

	return {
		...bulkActions,
		...rowActions,
		...draftRowActions,
		notifyMissingPrimaryKey,
		notifyActionFailure
	}
}
