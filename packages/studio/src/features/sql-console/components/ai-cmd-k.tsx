import { Channel } from '@tauri-apps/api/core'
import { Sparkles, X } from 'lucide-react'
import { Spinner } from '@studio/shared/ui/spinner'
import { useCallback, useEffect, useRef, useState } from 'react'
import { commands } from '@studio/lib/bindings'
import type { AiStreamEvent } from '@studio/lib/bindings'
import { formatAiStatusBadge, useAiStatus } from '@studio/features/ai-assistant/use-ai-status'
import { buildMockSqlJson, streamMockText } from '@studio/features/ai-assistant/mock-ai'
import { Button } from '@studio/shared/ui/button'
import { cn } from '@studio/shared/utils/cn'

type Props = {
	open: boolean
	onClose: () => void
	onApplySql: (sql: string, explanation: string, warnings: string[], execute: boolean) => void
	activeConnectionId: string | undefined
	isTauri: boolean
}

type ParsedResult = {
	sql: string
	explanation: string
	warnings: string[]
}

function parseLlmJson(raw: string): ParsedResult {
	const trimmed = raw.trim()
	const tryParse = (s: string): ParsedResult | null => {
		try {
			const parsed = JSON.parse(s)
			return {
				sql: String(parsed.sql ?? '').trim(),
				explanation: String(parsed.explanation ?? '').trim(),
				warnings: Array.isArray(parsed.warnings)
					? parsed.warnings.map((w: unknown) => String(w))
					: [],
			}
		} catch {
			return null
		}
	}
	const direct = tryParse(trimmed)
	if (direct) return direct
	const fenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
	const fencedParsed = tryParse(fenced)
	if (fencedParsed) return fencedParsed
	return { sql: trimmed, explanation: '', warnings: ['Response was not valid JSON.'] }
}

function makeRequestId() {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function AiCmdK({ open, onClose, onApplySql, activeConnectionId, isTauri }: Props) {
	const [prompt, setPrompt] = useState('')
	const [isGenerating, setIsGenerating] = useState(false)
	const [streamedContent, setStreamedContent] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [lastResult, setLastResult] = useState<ParsedResult | null>(null)
	const { status: aiStatus, isMock } = useAiStatus(open)
	const promptRef = useRef<HTMLTextAreaElement | null>(null)
	const abortRef = useRef<{ cancelled: boolean; requestId: string | null }>({
		cancelled: false,
		requestId: null,
	})

	useEffect(
		function resetOnOpen() {
			if (open) {
				setError(null)
				setStreamedContent('')
				setLastResult(null)
				setIsGenerating(false)
				abortRef.current.cancelled = false
				abortRef.current.requestId = null
				setTimeout(() => promptRef.current?.focus(), 30)
			}
		},
		[open]
	)

	const abortInFlight = useCallback(function abortInFlight() {
		const id = abortRef.current.requestId
		abortRef.current.cancelled = true
		if (id) {
			commands.aiAbortStream(id).catch(() => {})
		}
	}, [])

	const handleClose = useCallback(
		function handleClose() {
			abortInFlight()
			setIsGenerating(false)
			onClose()
		},
		[onClose, abortInFlight]
	)

	const generate = useCallback(
		async function generate() {
			if (!prompt.trim() || isGenerating) return
			if (isTauri && aiStatus && !aiStatus.ready) {
				setError(
					`AI provider "${aiStatus.active_provider}" is not ready. Open Settings → AI Provider to configure it.`
				)
				return
			}

			setError(null)
			setStreamedContent('')
			setLastResult(null)
			setIsGenerating(true)
			abortRef.current.cancelled = false
			const requestId = makeRequestId()
			abortRef.current.requestId = requestId

			if (!isTauri) {
				let accumulated = ''
				try {
					await streamMockText({
						text: buildMockSqlJson(prompt, activeConnectionId ?? null),
						onToken(token) {
							accumulated += token
							setStreamedContent(accumulated)
						},
						isCancelled() {
							return abortRef.current.cancelled
						}
					})
					if (!abortRef.current.cancelled) {
						setLastResult(parseLlmJson(accumulated))
					}
				} catch (e) {
					if (!abortRef.current.cancelled) {
						setError(e instanceof Error ? e.message : String(e))
					}
				} finally {
					if (!abortRef.current.cancelled) {
						setIsGenerating(false)
					}
					abortRef.current.requestId = null
				}
				return
			}

			const channel = new Channel<AiStreamEvent>()
			let accumulated = ''

			channel.onmessage = function onmessage(event) {
				if (abortRef.current.cancelled) return
				switch (event.type) {
					case 'token':
						accumulated += event.text
						setStreamedContent(accumulated)
						break
					case 'final':
						if (event.content && event.content.length > accumulated.length) {
							accumulated = event.content
							setStreamedContent(accumulated)
						}
						break
					case 'error':
						setError(event.message)
						break
				}
			}

			try {
				const result = await commands.aiCompleteStream(
					requestId,
					prompt,
					activeConnectionId ?? null,
					null,
					null,
					channel
				)
				if (abortRef.current.cancelled) return
				if (result.status === 'error') {
					setError(typeof result.error === 'string' ? result.error : JSON.stringify(result.error))
					return
				}
				const parsed = parseLlmJson(accumulated)
				setLastResult(parsed)
			} catch (e) {
				if (!abortRef.current.cancelled) {
					setError(e instanceof Error ? e.message : String(e))
				}
			} finally {
				if (!abortRef.current.cancelled) {
					setIsGenerating(false)
				}
				abortRef.current.requestId = null
			}
		},
		[prompt, isGenerating, activeConnectionId, isTauri, aiStatus]
	)

	const accept = useCallback(
		function accept(execute: boolean) {
			if (!lastResult || !lastResult.sql) return
			onApplySql(lastResult.sql, lastResult.explanation, lastResult.warnings, execute)
			onClose()
		},
		[lastResult, onApplySql, onClose]
	)

	const handleKeyDown = useCallback(
		function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
			if (e.key === 'Escape') {
				e.preventDefault()
				handleClose()
				return
			}
			if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
				e.preventDefault()
				if (lastResult) accept(true)
				else generate()
				return
			}
			if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
				e.preventDefault()
				generate()
				return
			}
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault()
				if (lastResult) accept(false)
				else generate()
			}
		},
		[handleClose, lastResult, accept, generate]
	)

	if (!open) return null

	const statusLabel = formatAiStatusBadge(aiStatus, isMock)
	const providerReady = aiStatus?.ready ?? false
	const activeProvider = aiStatus?.active_provider ?? 'groq'

	return (
		<div
			className='fixed inset-0 z-[60] flex items-start justify-center bg-black/40 backdrop-blur-sm'
			onClick={handleClose}
		>
			<div
				className='mt-24 w-[min(720px,90vw)] rounded-lg border border-sidebar-border bg-sidebar shadow-2xl overflow-hidden'
				onClick={(e) => e.stopPropagation()}
			>
				<div className='flex items-center gap-2 border-b border-sidebar-border px-3 py-2'>
					<Sparkles className='h-4 w-4 text-primary' />
					<span className='text-xs font-semibold text-sidebar-foreground'>AI SQL</span>
					<span className='text-[10px] text-muted-foreground'>
						schema-grounded · via {activeProvider}
					</span>
					<span
						className={cn(
							'text-[10px] rounded px-1.5 py-0.5',
							providerReady
								? 'bg-emerald-500/10 text-emerald-500'
								: 'bg-amber-500/10 text-amber-500'
						)}
						title={`Active provider: ${activeProvider}`}
					>
						{statusLabel}
					</span>
					<div className='ml-auto flex items-center gap-1'>
						{isGenerating && (
							<Spinner className='h-3.5 w-3.5 text-muted-foreground' />
						)}
						<Button
							variant='ghost'
							size='icon'
							className='h-6 w-6'
							onClick={handleClose}
							aria-label='Close AI SQL dialog'
						>
							<X className='h-3.5 w-3.5' />
						</Button>
					</div>
				</div>

				<div className='px-3 pt-3'>
					<textarea
						ref={promptRef}
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
						onKeyDown={handleKeyDown}
						disabled={isGenerating}
						placeholder="e.g. users who signed up last week but haven't logged in"
						className='w-full resize-none rounded-md border border-sidebar-border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-50'
						rows={2}
					/>
					<div className='mt-1 flex items-center justify-between text-[10px] text-muted-foreground'>
						<span>
							{lastResult
								? 'Enter to insert · ⌘⏎ to insert + run · ⌘R to regenerate · Esc to close'
								: 'Enter to generate · ⌘R to regenerate · Esc to close'}
						</span>
						{!activeConnectionId && (
							<span className='text-amber-500'>
								No active connection — schema context disabled
							</span>
						)}
					</div>
				</div>

				{error && (
					<div className='mx-3 mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive font-mono'>
						{error}
					</div>
				)}

				{streamedContent && (
					<div className='mx-3 mb-3 mt-3 rounded-md border border-sidebar-border bg-background'>
						<div className='flex items-center justify-between border-b border-sidebar-border px-3 py-1.5'>
							<span className='text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'>
								{lastResult ? 'Generated SQL' : 'Streaming...'}
							</span>
							{lastResult && (
								<div className='flex items-center gap-1'>
									<Button
										variant='ghost'
										size='sm'
										className='h-6 px-2 text-[10px]'
										onClick={generate}
									>
										Regenerate
									</Button>
									<Button
										variant='ghost'
										size='sm'
										className='h-6 px-2 text-[10px]'
										onClick={() => accept(false)}
									>
										Insert
									</Button>
									<Button
										variant='default'
										size='sm'
										className='h-6 px-2 text-[10px]'
										onClick={() => accept(true)}
									>
										Insert + Run
									</Button>
								</div>
							)}
						</div>
						<pre
							className={cn(
								'max-h-60 overflow-auto px-3 py-2 text-xs font-mono text-sidebar-foreground whitespace-pre-wrap',
								!lastResult && 'opacity-70'
							)}
						>
							{lastResult ? lastResult.sql : streamedContent}
						</pre>
						{lastResult && lastResult.explanation && (
							<div className='border-t border-sidebar-border px-3 py-2 text-[11px] text-muted-foreground'>
								{lastResult.explanation}
							</div>
						)}
						{lastResult && lastResult.warnings.length > 0 && (
							<div className='border-t border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400'>
								{lastResult.warnings.map((w, i) => (
									<div key={i}>⚠ {w}</div>
								))}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	)
}
