import { Check, Copy, Loader2, Play } from 'lucide-react'
import { useCallback, useState } from 'react'
import { commands } from '@/lib/bindings'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/utils/cn'

type Props = {
	language: string | undefined
	code: string
	activeConnectionId: string | null
	onEditorInsert?: (sql: string) => void
}

type RunState =
	| { kind: 'idle' }
	| { kind: 'running' }
	| { kind: 'success'; rowCount: number; durationMs: number }
	| { kind: 'error'; message: string }

export function CodeBlock({ language, code, activeConnectionId, onEditorInsert }: Props) {
	const [copied, setCopied] = useState(false)
	const [runState, setRunState] = useState<RunState>({ kind: 'idle' })

	const isSql = !language || language.toLowerCase() === 'sql'

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

	const handleRun = useCallback(
		async function handleRun() {
			if (!activeConnectionId || runState.kind === 'running') return
			setRunState({ kind: 'running' })
			const started = performance.now()
			try {
				const start = await commands.startQuery(activeConnectionId, code)
				if (start.status === 'error') {
					setRunState({
						kind: 'error',
						message:
							typeof start.error === 'string'
								? start.error
								: start.error?.detail ?? 'Query failed'
					})
					return
				}
				const queryIds = start.data
				const lastId = queryIds[queryIds.length - 1]
				const fetched = await commands.fetchQuery(lastId)
				const elapsed = Math.round(performance.now() - started)
				if (fetched.status === 'error') {
					setRunState({
						kind: 'error',
						message:
							typeof fetched.error === 'string'
								? fetched.error
								: fetched.error?.detail ?? 'Query failed'
					})
					return
				}
				const info = fetched.data
				if (info?.error) {
					setRunState({ kind: 'error', message: info.error })
					return
				}
				const rowCount = info?.affected_rows ?? 0
				setRunState({ kind: 'success', rowCount, durationMs: elapsed })
			} catch (e) {
				setRunState({
					kind: 'error',
					message: e instanceof Error ? e.message : String(e)
				})
			}
		},
		[activeConnectionId, code, runState.kind]
	)

	return (
		<div className='my-2 overflow-hidden rounded-md border border-sidebar-border bg-zinc-900/60'>
			<div className='flex items-center justify-between border-b border-sidebar-border px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground'>
				<span>{language ?? 'code'}</span>
				<div className='flex items-center gap-1'>
					{isSql && (
						<Button
							variant='ghost'
							size='sm'
							className='h-6 px-2 text-[10px]'
							onClick={handleRun}
							disabled={!activeConnectionId || runState.kind === 'running'}
						>
							{runState.kind === 'running' ? (
								<Loader2 className='mr-1 h-3 w-3 animate-spin' />
							) : (
								<Play className='mr-1 h-3 w-3' />
							)}
							Run
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
						>
							Editor
						</Button>
					)}
					<Button
						variant='ghost'
						size='sm'
						className='h-6 px-2 text-[10px]'
						onClick={handleCopy}
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
			<pre className='m-0 overflow-x-auto p-3 text-xs leading-relaxed text-zinc-100'>
				<code>{code}</code>
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
					{runState.kind === 'running' && 'Running…'}
					{runState.kind === 'success' &&
						`${runState.rowCount} row${runState.rowCount === 1 ? '' : 's'} · ${runState.durationMs}ms`}
					{runState.kind === 'error' && runState.message}
				</div>
			)}
		</div>
	)
}
