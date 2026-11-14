import { lazy, memo, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { useIsTauri } from '@studio/core/data-provider'
import { Dialog, DialogContent } from '@studio/shared/ui/dialog'
import { toast } from '@studio/shared/ui/notifier'
import type { Connection, DatabaseType } from '../types'
import { classifyDroppedPaths } from '../utils/data-files'
import type { NewConnection } from './connection-dialog/connection-mapping'
import { detect, isActionable } from './connection-dialog/detect'
import { ConnectionDialogFooter } from './connection-dialog/dialog-footer'
import { ConnectionDialogHeader } from './connection-dialog/dialog-header'
import { runConnectionTest } from './connection-dialog/run-connection-test'
import { SourceStep } from './connection-dialog/source-step'
import { createDialogStore, type DialogDeps, type DialogStore } from './connection-dialog/store'
import { DialogStoreProvider, useDialog } from './connection-dialog/store-context'

const DetailsStep = lazy(function loadDetailsStep() {
	return import('./connection-dialog/details-step').then((module) => ({
		default: module.DetailsStep
	}))
})

type Props = {
	open: boolean
	onOpenChange: (open: boolean) => void
	onSave: (connection: NewConnection) => void | Promise<void>
	/** Opens data files, with paths from a drop, or opens the picker when omitted. */
	onOpenDataFiles?: (paths?: string[]) => void | Promise<void>
	/** Resolve `.db` and other ambiguous database files via header probing. */
	resolveDatabaseType?: (path: string) => Promise<DatabaseType>
	droppedFilePaths?: string[] | null
	externalDropActive?: boolean
	onDroppedFilePathsHandled?: () => void
	initialValues?: Connection
}

type Session = {
	open: boolean
	connectionId: string | null
	store: DialogStore
}

const PANE =
	'flex min-h-0 flex-1 animate-in flex-col duration-150 fade-in-0 motion-reduce:animate-none'

function startSession(
	open: boolean,
	original: Connection | undefined,
	deps: { current: DialogDeps }
): Session {
	return {
		open,
		connectionId: original?.id ?? null,
		store: createDialogStore({ original: original ?? null, deps })
	}
}

function prefetchDetailsStep() {
	void import('./connection-dialog/details-step')
}

export function ConnectionDialog({
	open,
	onOpenChange,
	onSave,
	onOpenDataFiles,
	resolveDatabaseType,
	droppedFilePaths,
	externalDropActive = false,
	onDroppedFilePathsHandled,
	initialValues
}: Props) {
	const isTauri = useIsTauri()
	const deps = useRef<DialogDeps>({
		onSave,
		isTauri: () => isTauri,
		testConnection: runConnectionTest
	})

	useEffect(() => {
		deps.current = { onSave, isTauri: () => isTauri, testConnection: runConnectionTest }
	})

	const [session, setSession] = useState(() => startSession(open, initialValues, deps))
	const wantedId = initialValues?.id ?? null
	if (open && (!session.open || session.connectionId !== wantedId)) {
		setSession(startSession(true, initialValues, deps))
	} else if (!open && session.open) {
		setSession({ ...session, open: false })
	}
	const store = session.store

	useEffect(() => {
		if (!open) return
		const handle = window.setTimeout(prefetchDetailsStep, 150)
		return () => window.clearTimeout(handle)
	}, [open])

	const handlePaths = useCallback(
		async function handlePaths(paths: string[]) {
			const { dataFiles, databaseFiles, unsupported } = classifyDroppedPaths(paths)

			if (unsupported.length > 0) {
				toast.error('Unsupported file type', {
					description: unsupported
						.map((path) => path.split(/[\\/]/).pop() ?? path)
						.join(', ')
				})
			}
			if (dataFiles.length > 0 && databaseFiles.length > 0) {
				toast.error('Drop one kind at a time', {
					description:
						'Drop either data files (CSV, Parquet, JSON) or a database file, not both.'
				})
				return
			}
			if (dataFiles.length > 0) {
				await onOpenDataFiles?.(dataFiles)
				return
			}
			if (databaseFiles.length > 1) {
				toast.error('One database file at a time', {
					description: 'Drop a single SQLite or DuckDB file to pre-fill this connection.'
				})
				return
			}
			if (databaseFiles.length === 1) {
				const path = databaseFiles[0]
				const type = resolveDatabaseType
					? await resolveDatabaseType(path)
					: path.toLowerCase().endsWith('.duckdb')
						? 'duckdb'
						: 'sqlite'
				store.getState().applyDatabaseFile(type === 'duckdb' ? 'duckdb' : 'sqlite', path)
			}
		},
		[onOpenDataFiles, resolveDatabaseType, store]
	)

	useEffect(
		function consumeExternalDrop() {
			if (!open || !droppedFilePaths?.length || initialValues) return
			void handlePaths(droppedFilePaths).finally(() => onDroppedFilePathsHandled?.())
		},
		[open, droppedFilePaths, initialValues, handlePaths, onDroppedFilePathsHandled]
	)

	useEffect(
		function applyPastedConnectionUrl() {
			if (!open) return

			function onPaste(event: ClipboardEvent) {
				const target = event.target
				if (
					target instanceof HTMLInputElement ||
					target instanceof HTMLTextAreaElement ||
					(target instanceof HTMLElement && target.isContentEditable)
				) {
					return
				}
				const text = event.clipboardData?.getData('text')
				if (!text) return
				const found = detect(text)
				const state = store.getState()
				if (state.original || !isActionable(found) || found.kind === 'datafile') return

				event.preventDefault()
				if (state.step === 'source') {
					state.setQuery(text.trim())
					state.requestFocus('omni')
				} else {
					state.applyDetection(found, 'url')
				}
			}

			document.addEventListener('paste', onPaste)
			return () => document.removeEventListener('paste', onPaste)
		},
		[open, store]
	)

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			const state = store.getState()
			if (state.step !== 'details') return
			const mod = event.metaKey || event.ctrlKey

			if (mod && event.key === 'Enter') {
				event.preventDefault()
				void state.runTest()
			} else if (mod && event.key.toLowerCase() === 's') {
				event.preventDefault()
				void state.save()
			} else if (event.altKey && event.key === 'ArrowLeft') {
				event.preventDefault()
				state.back()
			} else if (
				event.key === 'Enter' &&
				event.target instanceof HTMLInputElement &&
				event.target.id.startsWith('cd-') &&
				event.target.id !== 'cd-omni'
			) {
				event.preventDefault()
				void state.save()
			}
		},
		[store]
	)

	const handleEscape = useCallback(
		(event: KeyboardEvent) => {
			const state = store.getState()
			if (state.confirmSave) {
				event.preventDefault()
				state.cancelConfirm()
			} else if (state.step === 'source' && state.query !== '') {
				event.preventDefault()
				state.setQuery('')
			}
		},
		[store]
	)

	const handleProviderComplete = useCallback(
		(connection: NewConnection) => {
			void onSave(connection)
			onOpenChange(false)
		},
		[onSave, onOpenChange]
	)

	const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange])

	const dropEnabled = !initialValues && (!!onOpenDataFiles || !!resolveDatabaseType)

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				onKeyDown={handleKeyDown}
				onEscapeKeyDown={handleEscape}
				className='flex h-[min(calc(100vh-2rem),668px)] flex-col gap-0 overflow-hidden rounded-none border-border/70 bg-background p-0 sm:max-w-[760px] [&_button]:rounded-none [&_input]:rounded-none [&_textarea]:rounded-none'
			>
				<DialogStoreProvider value={store}>
					<DropZone
						enabled={dropEnabled}
						external={externalDropActive}
						onPaths={handlePaths}
					>
						<ConnectionDialogHeader />
						<DialogBody
							canOpenDataFiles={!!onOpenDataFiles}
							onPickFiles={() => void onOpenDataFiles?.()}
							onOpenDataFiles={(paths) => void onOpenDataFiles?.(paths)}
							onProviderComplete={handleProviderComplete}
						/>
						<ConnectionDialogFooter onCancel={handleCancel} />
					</DropZone>
				</DialogStoreProvider>
			</DialogContent>
		</Dialog>
	)
}

type BodyProps = {
	canOpenDataFiles: boolean
	onPickFiles: () => void
	onOpenDataFiles: (paths: string[]) => void
	onProviderComplete: (connection: NewConnection) => void
}

const DialogBody = memo(function DialogBody({
	canOpenDataFiles,
	onPickFiles,
	onOpenDataFiles,
	onProviderComplete
}: BodyProps) {
	const step = useDialog((state) => state.step)

	if (step === 'source') {
		return (
			<div key='source' className={PANE}>
				<SourceStep
					canOpenDataFiles={canOpenDataFiles}
					onPickFiles={onPickFiles}
					onOpenDataFiles={onOpenDataFiles}
				/>
			</div>
		)
	}

	return (
		<div key='details' className={PANE}>
			<Suspense fallback={null}>
				<DetailsStep onProviderComplete={onProviderComplete} />
			</Suspense>
		</div>
	)
})

type DropProps = {
	enabled: boolean
	external: boolean
	onPaths: (paths: string[]) => Promise<void>
	children: React.ReactNode
}

function DropZone({ enabled, external, onPaths, children }: DropProps) {
	const [dragging, setDragging] = useState(false)
	const depth = useRef(0)

	function hasFiles(event: React.DragEvent) {
		return Array.from(event.dataTransfer.types).includes('Files')
	}

	return (
		<div
			className='relative flex min-h-0 flex-1 flex-col'
			onDragEnter={(event) => {
				if (!enabled || !hasFiles(event)) return
				depth.current += 1
				setDragging(true)
			}}
			onDragOver={(event) => {
				if (enabled && hasFiles(event)) event.preventDefault()
			}}
			onDragLeave={(event) => {
				if (!enabled || !hasFiles(event)) return
				depth.current = Math.max(0, depth.current - 1)
				if (depth.current === 0) setDragging(false)
			}}
			onDrop={(event) => {
				depth.current = 0
				setDragging(false)
				if (!enabled || !hasFiles(event)) return
				event.preventDefault()
				event.stopPropagation()
				const paths = Array.from(event.dataTransfer.files)
					.map((file) =>
						'path' in file && typeof file.path === 'string' ? file.path : ''
					)
					.filter(Boolean)
				if (paths.length > 0) void onPaths(paths)
			}}
		>
			{children}
			{enabled && (dragging || external) ? (
				<div
					aria-hidden='true'
					className='pointer-events-none absolute inset-0 z-50 grid place-items-center border border-dashed border-foreground/35 bg-card/95'
				>
					<div className='grid justify-items-center gap-2.5 text-center'>
						<FileSpreadsheet className='h-7 w-7 text-foreground/80' strokeWidth={1.8} />
						<div className='text-base font-semibold'>Drop to detect file type</div>
						<div className='font-mono text-xs text-muted-foreground'>
							SQLite, DuckDB, CSV, Parquet or JSON
						</div>
					</div>
				</div>
			) : null}
		</div>
	)
}
