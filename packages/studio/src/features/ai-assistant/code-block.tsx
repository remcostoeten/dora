import {
	Check,
	Copy,
	FileInput,
	Loader2,
	Maximize2,
	Minimize2,
	Play,
	ShieldCheck
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { getEnv } from '@studio/core/env'
import { commands } from '@studio/lib/bindings'
import { Button } from '@studio/shared/ui/button'
import { cn } from '@studio/shared/utils/cn'
import {
	buildDryRunSql,
	getSqlStatementKind,
	splitSqlStatements,
	tokenizeSql,
	type SqlTokenKind
} from './sql-code-utils'

const DEFAULT_QUERY_POLL_INTERVAL_MS = 100
const DEFAULT_QUERY_POLL_ATTEMPTS = 50

const QUERY_POLL_INTERVAL_MS =
	Number.parseInt(getEnv('VITE_AI_QUERY_POLL_INTERVAL_MS') ?? '', 10) ||
	DEFAULT_QUERY_POLL_INTERVAL_MS

const QUERY_POLL_ATTEMPTS =
	Number.parseInt(getEnv('VITE_AI_QUERY_POLL_ATTEMPTS') ?? '', 10) ||
	DEFAULT_QUERY_POLL_ATTEMPTS

type Props = {
	language: string | undefined
	code: string
	activeConnectionId: string | null
	onEditorInsert?: (sql: string) => void
	queryPollIntervalMs?: number
	queryPollAttempts?: number
}

type RunState =
	| { kind: 'idle' }
	| { kind: 'running'; mode: 'run' | 'dry-run' }
	| { kind: 'success'; mode: 'run' | 'dry-run'; rowCount: number; durationMs: number }
	| { kind: 'error'; mode: 'run' | 'dry-run'; message: string }

const tokenClassName: Record<SqlTokenKind, string> = {
	keyword: 'text-sky-300',
	function: 'text-violet-300',
	string: 'text-emerald-300',
	number: 'text-amber-300',
	comment: 'text-zinc-500',
	operator: 'text-zinc-400',
	identifier: 'text-zinc-100',
	plain: 'text-zinc-100'
}

function formatError(error: unknown): string {
	if (typeof error === 'string') return error
	if (error && typeof error === 'object' && 'detail' in error) {
		return String((error as { detail?: unknown }).detail ?? 'Query failed')
	}
	return 'Query failed'
}

function delay(ms: number): Promise<void> {
	return new Promise(function (resolve) {
		setTimeout(resolve, ms)
	})
}

function getFirstPageRowCount(firstPage: unknown): number {
	if (!Array.isArray(firstPage)) return 0
	return firstPage.length
}

export function CodeBlock({
	language,
	code,
	activeConnectionId,
	onEditorInsert,
	queryPollIntervalMs,
	queryPollAttempts
}: Props) {
	const [copied, setCopied] = useState(false)
	const [runState, setRunState] = useState<RunState>({ kind: 'idle' })
	const [expanded, setExpanded] = useState(false)

	const isSql = !language || language.toLowerCase() === 'sql'
	const sqlKind = useMemo(
		function () {
			return isSql ? getSqlStatementKind(code) : undefined
		},
		[code, isSql]
	)
	const statementCount = useMemo(
		function () {
			return isSql ? splitSqlStatements(code).length : 0
		},
		[code, isSql]
	)
	const highlightedTokens = useMemo(
		function () {
			return isSql ? tokenizeSql(code) : []
		},
		[code, isSql]
	)
	const lineCount = code.split('\n').length
	const shouldClamp = lineCount > 12 && !expanded

	const handleCopy = useCallback(
		async function handleCopy() {
			try {
				await navigator.clipboard.writeText(code)
				setCopied(true)
				setTimeout(function () {
					setCopied(false)
				}, 1200)
			} catch {
				/* clipboard refused; swallow */
			}
		},
		[code]
	)

	const runSql = useCallback(
		async function runSql(sql: string, mode: 'run' | 'dry-run') {
			if (!activeConnectionId || runState.kind === 'running') return
			setRunState({ kind: 'running', mode })
			const started = performance.now()
			const pollInterval = queryPollIntervalMs ?? QUERY_POLL_INTERVAL_MS
			const pollAttempts = queryPollAttempts ?? QUERY_POLL_ATTEMPTS
			try {
				const start = await commands.startQuery(activeConnectionId, sql)
				if (start.status === 'error') {
					setRunState({
						kind: 'error',
						mode,
						message: formatError(start.error)
					})
					return
				}
				const queryIds = start.data
				const lastId = queryIds[queryIds.length - 1]
				if (lastId === undefined) {
					setRunState({ kind: 'error', mode, message: 'No query was started.' })
					return
				}
				let info
				let lastStatus: string | undefined
				for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
					const fetched = await commands.fetchQuery(lastId)
					if (fetched.status === 'error') {
						setRunState({
							kind: 'error',
							mode,
							message: formatError(fetched.error)
						})
						return
					}

					info = fetched.data
					lastStatus = info.status
					if (info.status === 'Completed' || info.status === 'Error') {
						break
					}

					await delay(pollInterval)
				}

				const elapsed = Math.round(performance.now() - started)
				if (!info) {
					setRunState({ kind: 'error', mode, message: 'Query timed out.' })
					return
				}
				if (info.error) {
					setRunState({ kind: 'error', mode, message: info.error })
					return
				}
				if (info.status !== 'Completed') {
					const totalMs = pollInterval * pollAttempts
					setRunState({
						kind: 'error',
						mode,
						message: `Query polling reached the client timeout limit (~${totalMs}ms). Last known status: ${lastStatus ?? 'unknown'}. The query may still be executing.`
					})
					return
				}
				const firstPageRowCount = getFirstPageRowCount(info.first_page)
				const rowCount = info.returns_values
					? Math.max(info.affected_rows ?? 0, firstPageRowCount)
					: (info.affected_rows ?? 0)
				setRunState({ kind: 'success', mode, rowCount, durationMs: elapsed })
			} catch (e) {
				setRunState({
					kind: 'error',
					mode,
					message: e instanceof Error ? e.message : String(e)
				})
			}
		},
		[activeConnectionId, queryPollIntervalMs, queryPollAttempts, runState.kind]
	)

	const handleRun = useCallback(
		async function handleRun() {
			await runSql(code, 'run')
		},
		[code, runSql]
	)

	const handleDryRun = useCallback(
		async function handleDryRun() {
			const dryRunSql = buildDryRunSql(code)
			if (!dryRunSql) return
			await runSql(dryRunSql, 'dry-run')
		},
		[code, runSql]
	)

	return (
		<div className='my-2 overflow-hidden rounded-md border border-sidebar-border bg-zinc-900/60'>
			<div className='flex items-center justify-between gap-2 border-b border-sidebar-border px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground'>
				<div className='flex min-w-0 items-center gap-2'>
					<span className='font-semibold text-zinc-300'>{language ?? 'code'}</span>
					{isSql && (
						<span className='truncate normal-case tracking-normal text-muted-foreground'>
							{sqlKind} · {statementCount} stmt{statementCount === 1 ? '' : 's'} · {lineCount} line{lineCount === 1 ? '' : 's'}
						</span>
					)}
				</div>
				<div className='flex shrink-0 items-center gap-1'>
					{isSql && (
						<Button
							variant='ghost'
							size='sm'
							className='h-6 px-2 text-[10px]'
							onClick={handleRun}
							disabled={!activeConnectionId || runState.kind === 'running'}
							title='Run SQL'
						>
							{runState.kind === 'running' && runState.mode === 'run' ? (
								<Loader2 className='mr-1 h-3 w-3 animate-spin' />
							) : (
								<Play className='mr-1 h-3 w-3' />
							)}
							Run
						</Button>
					)}
					{isSql && (
						<Button
							variant='ghost'
							size='sm'
							className='h-6 px-2 text-[10px]'
							onClick={handleDryRun}
							disabled={!activeConnectionId || runState.kind === 'running'}
							title='Dry run with EXPLAIN'
						>
							{runState.kind === 'running' && runState.mode === 'dry-run' ? (
								<Loader2 className='mr-1 h-3 w-3 animate-spin' />
							) : (
								<ShieldCheck className='mr-1 h-3 w-3' />
							)}
							Dry
						</Button>
					)}
					{isSql && onEditorInsert && (
						<Button
							variant='ghost'
							size='sm'
							className='h-6 px-2 text-[10px]'
							onClick={function () {
								onEditorInsert(code)
							}}
							title='Insert into editor'
						>
							<FileInput className='mr-1 h-3 w-3' />
							Editor
						</Button>
					)}
					{lineCount > 12 && (
						<Button
							variant='ghost'
							size='sm'
							className='h-6 px-2 text-[10px]'
							onClick={function () {
								setExpanded(function (value) {
									return !value
								})
							}}
							title={expanded ? 'Collapse SQL' : 'Expand SQL'}
						>
							{expanded ? (
								<Minimize2 className='mr-1 h-3 w-3' />
							) : (
								<Maximize2 className='mr-1 h-3 w-3' />
							)}
							{expanded ? 'Less' : 'More'}
						</Button>
					)}
					<Button
						variant='ghost'
						size='sm'
						className='h-6 px-2 text-[10px]'
						onClick={handleCopy}
						title='Copy code'
					>
						{copied ? (
							<Check className='mr-1 h-3 w-3' />
						) : (
							<Copy className='mr-1 h-3 w-3' />
						)}
						{copied ? 'Copied' : 'Copy'}
					</Button>
				</div>
			</div>
			<pre
				className={cn(
					'm-0 overflow-auto p-3 text-xs leading-relaxed text-zinc-100',
					shouldClamp && 'max-h-64'
				)}
			>
				<code>
					{isSql
						? highlightedTokens.map(function (token, index) {
								return (
									<span key={`${index}-${token.text}`} className={tokenClassName[token.kind]}>
										{token.text}
									</span>
								)
							})
						: code}
				</code>
			</pre>
			{runState.kind !== 'idle' && (
				<div
					className={cn(
						'border-t border-sidebar-border px-3 py-1.5 text-[11px]',
						runState.kind === 'error'
							? 'bg-red-500/10 text-red-400'
							: runState.kind === 'success'
								? 'bg-emerald-500/10 text-emerald-400'
								: 'text-muted-foreground'
					)}
				>
					{runState.kind === 'running' &&
						(runState.mode === 'dry-run' ? 'Dry running with EXPLAIN…' : 'Running…')}
					{runState.kind === 'success' &&
						(runState.mode === 'dry-run'
							? `Dry run passed · ${runState.durationMs}ms`
							: `${runState.rowCount} row${runState.rowCount === 1 ? '' : 's'} · ${runState.durationMs}ms`)}
					{runState.kind === 'error' && runState.message}
				</div>
			)}
		</div>
	)
}
