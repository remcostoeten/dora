import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeftRight, UserMinus } from 'lucide-react'
import { useAdapter } from '@studio/core/data-provider'
import {
	getAdapterError,
	type AdapterResult,
	type QueryResult
} from '@studio/core/data-provider/types'
import { MASK_TOKEN } from '@studio/core/privacy/mask'
import { useSettings } from '@studio/core/settings/settings-store'
import type { DataFileSourceEntry } from '@studio/features/connections/types/data-file-source'
import { Button } from '@studio/shared/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from '@studio/shared/ui/dialog'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@studio/shared/ui/select'
import { Spinner } from '@studio/shared/ui/spinner'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from '@studio/shared/ui/table'
import {
	DATA_FILE_DIFF_ROW_LIMIT,
	buildDescribeDataFileQuery,
	buildMissingDataFileRowsQuery,
	dataFileName,
	extractDescribedColumns,
	findCommonDataFileColumns,
	findDefaultDataFileKeyIndex,
	selectDataFileDiffDisplayColumns,
	type CommonDataFileColumn
} from '../utils/data-file-diff'

type Props = {
	connectionId: string
	entries: DataFileSourceEntry[]
}

type FollowerDiffResult = {
	columns: string[]
	rows: Record<string, unknown>[]
}

function isCsvEntry(entry: DataFileSourceEntry): boolean {
	return entry.status === 'active' && entry.fileType.toLowerCase() === 'csv'
}

function renderDiffValue(value: unknown, masked: boolean): ReactNode {
	if (masked) {
		return (
			<span
				className='select-none tracking-widest text-muted-foreground'
				aria-label='Hidden value'
			>
				{MASK_TOKEN}
			</span>
		)
	}
	if (value === null || value === undefined) {
		return <span className='italic text-muted-foreground'>NULL</span>
	}
	if (typeof value === 'object') return JSON.stringify(value)
	return String(value)
}

function resultError(error: unknown): string {
	return error instanceof Error ? error.message : 'Could not compare the files'
}

export function FollowerDiffButton({ connectionId, entries }: Props) {
	const adapter = useAdapter()
	const { settings } = useSettings()
	const csvEntries = useMemo(() => entries.filter((entry) => isCsvEntry(entry)), [entries])
	const [open, setOpen] = useState(false)
	const [olderPath, setOlderPath] = useState(csvEntries[0]?.path ?? '')
	const [newerPath, setNewerPath] = useState(csvEntries[1]?.path ?? '')
	const [commonColumns, setCommonColumns] = useState<CommonDataFileColumn[]>([])
	const [selectedKeyIndex, setSelectedKeyIndex] = useState('')
	const [isLoadingColumns, setIsLoadingColumns] = useState(false)
	const [isComparing, setIsComparing] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [result, setResult] = useState<FollowerDiffResult | null>(null)
	const requestIdRef = useRef(0)
	const inFlightQueryIdsRef = useRef<number[]>([])

	const olderEntry = csvEntries.find((entry) => entry.path === olderPath)
	const newerEntry = csvEntries.find((entry) => entry.path === newerPath)
	const selectedKey = commonColumns[Number(selectedKeyIndex)]
	const displayColumns = useMemo(
		() =>
			result && selectedKey
				? selectDataFileDiffDisplayColumns(result.columns, selectedKey.olderName)
				: [],
		[result, selectedKey]
	)

	function cancelInFlightQueries() {
		const queryIds = inFlightQueryIdsRef.current
		inFlightQueryIdsRef.current = []
		if (queryIds.length > 0) void adapter.cancelQueries(queryIds)
	}

	async function executeTrackedQuery(query: string): Promise<AdapterResult<QueryResult>> {
		let startedQueryIds: number[] = []
		try {
			return await adapter.executeQuery(connectionId, query, {
				onStarted: (queryIds) => {
					startedQueryIds = queryIds
					inFlightQueryIdsRef.current = queryIds
				}
			})
		} finally {
			if (inFlightQueryIdsRef.current === startedQueryIds) {
				inFlightQueryIdsRef.current = []
			}
		}
	}

	useEffect(() => {
		setOlderPath((currentPath) =>
			csvEntries.some((entry) => entry.path === currentPath)
				? currentPath
				: (csvEntries[0]?.path ?? '')
		)
		setNewerPath((currentPath) =>
			csvEntries.some((entry) => entry.path === currentPath)
				? currentPath
				: (csvEntries[1]?.path ?? csvEntries[0]?.path ?? '')
		)
	}, [csvEntries])

	useEffect(() => {
		if (!open || !olderEntry || !newerEntry || olderEntry.path === newerEntry.path) return

		const selectedOlderEntry = olderEntry
		const selectedNewerEntry = newerEntry
		const requestId = ++requestIdRef.current
		cancelInFlightQueries()
		setIsLoadingColumns(true)
		setCommonColumns([])
		setSelectedKeyIndex('')
		setResult(null)
		setError(null)

		async function loadCommonColumns() {
			try {
				const olderResult = await executeTrackedQuery(
					buildDescribeDataFileQuery(selectedOlderEntry.viewName)
				)
				if (requestId !== requestIdRef.current) return
				if (!olderResult.ok) throw new Error(getAdapterError(olderResult))

				const newerResult = await executeTrackedQuery(
					buildDescribeDataFileQuery(selectedNewerEntry.viewName)
				)
				if (requestId !== requestIdRef.current) return
				if (!newerResult.ok) throw new Error(getAdapterError(newerResult))

				const columns = findCommonDataFileColumns(
					extractDescribedColumns(olderResult.data.rows),
					extractDescribedColumns(newerResult.data.rows)
				)
				const defaultIndex = findDefaultDataFileKeyIndex(columns)
				setCommonColumns(columns)
				setSelectedKeyIndex(defaultIndex >= 0 ? String(defaultIndex) : '')
				if (columns.length === 0) {
					setError('These files do not share a column that can identify followers.')
				}
			} catch (queryError) {
				if (requestId === requestIdRef.current) setError(resultError(queryError))
			} finally {
				if (requestId === requestIdRef.current) setIsLoadingColumns(false)
			}
		}

		void loadCommonColumns()
		return () => {
			requestIdRef.current += 1
			cancelInFlightQueries()
		}
	}, [
		adapter,
		connectionId,
		newerEntry?.path,
		newerEntry?.viewName,
		olderEntry?.path,
		olderEntry?.viewName,
		open
	])

	async function handleCompare() {
		if (!olderEntry || !newerEntry || !selectedKey) return
		const requestId = ++requestIdRef.current
		cancelInFlightQueries()
		setIsComparing(true)
		setResult(null)
		setError(null)

		try {
			const queryResult = await executeTrackedQuery(
				buildMissingDataFileRowsQuery(olderEntry.viewName, newerEntry.viewName, selectedKey)
			)
			if (requestId !== requestIdRef.current) return
			if (!queryResult.ok) throw new Error(getAdapterError(queryResult))
			setResult({
				columns: queryResult.data.columns,
				rows: queryResult.data.rows
			})
		} catch (queryError) {
			if (requestId === requestIdRef.current) setError(resultError(queryError))
		} finally {
			if (requestId === requestIdRef.current) setIsComparing(false)
		}
	}

	function handleOlderPathChange(path: string) {
		if (path === newerPath) setNewerPath(olderPath)
		setOlderPath(path)
	}

	function handleNewerPathChange(path: string) {
		if (path === olderPath) setOlderPath(newerPath)
		setNewerPath(path)
	}

	function handleSwapFiles() {
		setOlderPath(newerPath)
		setNewerPath(olderPath)
	}

	function handleOpenChange(nextOpen: boolean) {
		setOpen(nextOpen)
		if (!nextOpen) {
			requestIdRef.current += 1
			cancelInFlightQueries()
			setIsComparing(false)
		}
	}

	if (csvEntries.length < 2) return null

	return (
		<>
			<Button
				type='button'
				variant='outline'
				size='sm'
				className='h-7 gap-1 px-2 text-xs'
				onClick={() => setOpen(true)}
			>
				<UserMinus className='h-3 w-3' aria-hidden />
				Compare followers
			</Button>

			<Dialog open={open} onOpenChange={handleOpenChange}>
				<DialogContent className='flex max-h-[85vh] max-w-5xl flex-col overflow-hidden'>
					<DialogHeader>
						<DialogTitle>Who unfollowed you?</DialogTitle>
						<DialogDescription>
							Dora finds accounts present in the older export but missing from the
							newer one.
						</DialogDescription>
					</DialogHeader>

					<div className='grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end'>
						<div className='space-y-1.5'>
							<label className='text-xs font-medium' htmlFor='older-follower-export'>
								Older export
							</label>
							<Select value={olderPath} onValueChange={handleOlderPathChange}>
								<SelectTrigger id='older-follower-export'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{csvEntries.map((entry) => (
										<SelectItem key={entry.path} value={entry.path}>
											{dataFileName(entry.path)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<Button
							type='button'
							variant='ghost'
							size='icon'
							className='h-9 w-9 justify-self-center'
							onClick={handleSwapFiles}
							aria-label='Swap older and newer exports'
						>
							<ArrowLeftRight className='h-4 w-4' aria-hidden />
						</Button>

						<div className='space-y-1.5'>
							<label className='text-xs font-medium' htmlFor='newer-follower-export'>
								Newer export
							</label>
							<Select value={newerPath} onValueChange={handleNewerPathChange}>
								<SelectTrigger id='newer-follower-export'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{csvEntries.map((entry) => (
										<SelectItem key={entry.path} value={entry.path}>
											{dataFileName(entry.path)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className='space-y-1.5'>
						<label className='text-xs font-medium' htmlFor='follower-identity-column'>
							Match followers by
						</label>
						<Select
							value={selectedKeyIndex}
							onValueChange={setSelectedKeyIndex}
							disabled={isLoadingColumns || commonColumns.length === 0}
						>
							<SelectTrigger id='follower-identity-column' className='sm:w-72'>
								<SelectValue
									placeholder={
										isLoadingColumns
											? 'Reading columns…'
											: 'Select a shared column'
									}
								/>
							</SelectTrigger>
							<SelectContent>
								{commonColumns.map((column, index) => (
									<SelectItem
										key={`${column.olderName}:${column.newerName}`}
										value={String(index)}
									>
										{column.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{error && (
						<div className='border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive'>
							{error}
						</div>
					)}

					{result && (
						<section
							className='flex min-h-0 flex-1 flex-col gap-2'
							aria-label='Unfollowed accounts'
						>
							<div className='flex items-center justify-between gap-3'>
								<h3 className='font-medium'>Unfollowed ({result.rows.length})</h3>
								{result.rows.length === DATA_FILE_DIFF_ROW_LIMIT && (
									<span className='text-xs text-muted-foreground'>
										Showing the first 10,000 rows
									</span>
								)}
							</div>
							<div className='min-h-0 overflow-auto border border-border/70'>
								<Table>
									<TableHeader className='sticky top-0 bg-background'>
										<TableRow>
											{displayColumns.map((column) => (
												<TableHead
													key={column}
													className='h-9 whitespace-nowrap px-3 text-xs'
												>
													{column}
												</TableHead>
											))}
										</TableRow>
									</TableHeader>
									<TableBody>
										{result.rows.length === 0 ? (
											<TableRow>
												<TableCell
													colSpan={Math.max(displayColumns.length, 1)}
													className='py-10 text-center text-muted-foreground'
												>
													No unfollowed accounts found.
												</TableCell>
											</TableRow>
										) : (
											result.rows.map((row, rowIndex) => (
												<TableRow
													key={`${String(row[selectedKey.olderName] ?? 'row')}:${rowIndex}`}
												>
													{displayColumns.map((column) => (
														<TableCell
															key={column}
															className='max-w-80 truncate px-3 py-2 font-mono text-xs'
														>
															{renderDiffValue(
																row[column],
																settings.privacyMaskData
															)}
														</TableCell>
													))}
												</TableRow>
											))
										)}
									</TableBody>
								</Table>
							</div>
						</section>
					)}

					<DialogFooter>
						<Button
							type='button'
							onClick={handleCompare}
							disabled={!selectedKey || isLoadingColumns || isComparing}
						>
							{isComparing && <Spinner className='mr-2 h-4 w-4' aria-hidden />}
							Find unfollowers
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}
