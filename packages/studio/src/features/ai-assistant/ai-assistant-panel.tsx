import { Send, Sparkles, Square, Trash2, X } from 'lucide-react'
import { notify } from '@remcostoeten/notifier'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAdapter, useIsTauri } from '@studio/core/data-provider'
import type { DatabaseSchema } from '@studio/lib/bindings'
import { Button } from '@studio/shared/ui/button'
import { cn } from '@studio/shared/utils/cn'
import { noop } from '@studio/shared/utils/noop'
import { getTableRefId } from '@studio/shared/utils/table-ref'
import { formatAiStatusBadge, useAiStatus } from './use-ai-status'
import { MessageBubble } from './message-bubble'
import { useAiAssistantStore } from './store'
import { buildDynamicSuggestions, getQuickActions } from './suggestions'
import type { AiAssistantContext, AiAssistantEditorContext } from './types'
import { useAiChat } from './use-ai-chat'

type Props = {
	activeConnectionId: string | null
	activeView?: string
	selectedTableId?: string | null
	selectedTableName?: string | null
	editorContext?: AiAssistantEditorContext | null
	onEditorInsert?: (sql: string) => void
	onRunInConsole?: (sql: string) => void
}

const VIEW_LABELS: Record<string, string> = {
	'sql-console': 'SQL console',
	'database-studio': 'Data viewer',
	'schema-visualizer': 'Schema',
	'orm-cockpit': 'Schema Diff',
	docker: 'Docker Manager',
	analytics: 'Analytics',
	settings: 'Settings'
}

function formatActiveView(activeView: string): string {
	return VIEW_LABELS[activeView] ?? activeView
}

export function AiAssistantPanel({
	activeConnectionId,
	activeView,
	selectedTableId,
	selectedTableName,
	editorContext,
	onEditorInsert,
	onRunInConsole
}: Props) {
	const adapter = useAdapter()
	const isTauri = useIsTauri()
	const open = useAiAssistantStore(function (s) {
		return s.open
	})
	const setOpen = useAiAssistantStore(function (s) {
		return s.setOpen
	})
	const pendingPrompt = useAiAssistantStore(function (s) {
		return s.pendingPrompt
	})
	const setPendingPrompt = useAiAssistantStore(function (s) {
		return s.setPendingPrompt
	})

	const { messages, streamingSnapshot, isStreaming, error, send, abort, clear } =
		useAiChat(activeConnectionId)
	const { status: aiStatus, isMock } = useAiStatus(open)
	const [input, setInput] = useState('')
	const [schema, setSchema] = useState<DatabaseSchema | null>(null)
	const scrollRef = useRef<HTMLDivElement | null>(null)
	const inputRef = useRef<HTMLTextAreaElement | null>(null)
	const stickToBottomRef = useRef(true)

	useEffect(
		function loadSchema() {
			if (!open || !activeConnectionId) {
				setSchema(null)
				return
			}
			adapter
				.getSchema(activeConnectionId)
				.then(function (res) {
					if (res.ok) setSchema(res.data)
				})
				.catch(function () {
					noop()
				})
		},
		[open, activeConnectionId, adapter]
	)

	useEffect(
		function applyPending() {
			if (!open || !pendingPrompt) return
			setInput(pendingPrompt)
			setPendingPrompt(null)
			setTimeout(function () {
				inputRef.current?.focus()
			}, 30)
		},
		[open, pendingPrompt, setPendingPrompt]
	)

	useEffect(
		function trackScrollIntent() {
			const el = scrollRef.current
			if (!el) return

			function onScroll() {
				const target = scrollRef.current
				if (!target) return
				const distanceFromBottom =
					target.scrollHeight - target.scrollTop - target.clientHeight
				stickToBottomRef.current = distanceFromBottom < 96
			}

			el.addEventListener('scroll', onScroll, { passive: true })
			return function cleanup() {
				el.removeEventListener('scroll', onScroll)
			}
		},
		[open]
	)

	useEffect(
		function autoScroll() {
			const el = scrollRef.current
			if (!el) return
			if (!stickToBottomRef.current && !isStreaming) return

			const frame = requestAnimationFrame(function () {
				el.scrollTop = el.scrollHeight
			})
			return function cleanup() {
				cancelAnimationFrame(frame)
			}
		},
		[messages, streamingSnapshot, isStreaming]
	)

	const suggestions = useMemo(
		function () {
			const tables =
				schema?.tables.map(function (t) {
					return { name: t.name, schema: t.schema, columns: t.columns }
				}) ?? []
			return buildDynamicSuggestions(tables)
		},
		[schema]
	)

	const assistantContext = useMemo<AiAssistantContext>(
		function () {
			const selectedTable = schema?.tables.find(function (table) {
				const tableId = getTableRefId(table)
				return (
					tableId === selectedTableId ||
					table.name === selectedTableName ||
					table.name === selectedTableId
				)
			})

			return {
				activeView,
				activeConnectionId,
				selectedTableId: selectedTableId || null,
				selectedTableName: selectedTable?.name ?? selectedTableName ?? null,
				selectedTableColumns: selectedTable?.columns.map(function (column) {
					return {
						name: column.name,
						dataType: column.data_type,
						nullable: column.is_nullable,
						primaryKey: column.is_primary_key,
						foreignKey: column.foreign_key
							? `${column.foreign_key.referenced_schema ? `${column.foreign_key.referenced_schema}.` : ''}${column.foreign_key.referenced_table}.${column.foreign_key.referenced_column}`
							: undefined
					}
				}),
				editor: editorContext ?? null
			}
		},
		[activeView, activeConnectionId, selectedTableId, selectedTableName, schema, editorContext]
	)

	const handleSend = useCallback(
		async function handleSend() {
			if (!input.trim() || isStreaming) return
			const text = input
			setInput('')
			try {
				await send({ prompt: text, activeConnectionId, context: assistantContext })
			} catch (e) {
				setInput(text)
				notify.error(
					`Could not send the message: ${e instanceof Error ? e.message : String(e)}`
				)
			}
		},
		[input, isStreaming, send, activeConnectionId, assistantContext]
	)

	const handleKeyDown = useCallback(
		function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault()
				handleSend()
				return
			}
			if (e.key === 'Escape') {
				e.preventDefault()
				if (isStreaming) abort()
				else setOpen(false)
			}
		},
		[handleSend, isStreaming, abort, setOpen]
	)

	const keysAvailable = aiStatus?.ready ?? false
	const keyLabel = formatAiStatusBadge(aiStatus, isMock)
	const activeProvider = aiStatus?.active_provider ?? 'groq'
	const streamingAssistant = messages.find(function (message) {
		return message.role === 'assistant' && message.streaming
	})
	const liveStreamContent =
		streamingSnapshot != null && streamingSnapshot.messageId === streamingAssistant?.id
			? streamingSnapshot.content
			: (streamingAssistant?.content ?? '')
	const isWaitingForFirstToken = isStreaming && liveStreamContent.trim().length === 0

	return (
		<aside
			id='ai-assistant-panel'
			aria-label='AI assistant'
			className='flex h-full w-[clamp(360px,30vw,460px)] shrink-0 border-l border-sidebar-border bg-sidebar'
		>
			<div className='flex h-full min-w-0 flex-1 flex-col'>
				<header className='flex min-h-14 items-center gap-3 border-b border-sidebar-border px-4 py-2.5'>
					<div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary'>
						<Sparkles className='h-4 w-4' />
					</div>
					<div className='min-w-0 flex-1'>
						<div className='flex items-center gap-2'>
							<span className='text-sm font-semibold'>AI assistant</span>
							<span
								className={cn(
									'h-1.5 w-1.5 rounded-full',
									keysAvailable ? 'bg-emerald-500' : 'bg-amber-500'
								)}
								aria-hidden='true'
							/>
						</div>
						<p
							className='truncate text-[11px] text-muted-foreground'
							title={`Active provider: ${activeProvider}. ${keyLabel}`}
						>
							{selectedTableName
								? `Using ${selectedTableName}`
								: activeView
									? `Using ${formatActiveView(activeView)}`
									: keyLabel}
						</p>
					</div>
					<div className='ml-auto flex items-center gap-1'>
						{messages.length > 0 && (
							<Button
								variant='ghost'
								size='icon'
								className='h-7 w-7'
								onClick={function () {
									clear(activeConnectionId)
								}}
								title='Clear chat'
								aria-label='Clear chat'
							>
								<Trash2 className='h-3.5 w-3.5' />
							</Button>
						)}
						<Button
							variant='ghost'
							size='icon'
							className='h-7 w-7'
							onClick={function () {
								setOpen(false)
							}}
							aria-label='Close AI assistant'
						>
							<X className='h-3.5 w-3.5' />
						</Button>
					</div>
				</header>

				<div ref={scrollRef} className='min-h-0 flex-1 overflow-y-auto bg-background/20'>
					{messages.length === 0 ? (
						<EmptyState
							suggestions={suggestions}
							onPick={function (prompt) {
								setInput(prompt)
								inputRef.current?.focus()
							}}
							hasConnection={Boolean(activeConnectionId)}
						/>
					) : (
						<div>
							{messages.map(function (m) {
								const liveContent =
									streamingSnapshot != null &&
									streamingSnapshot.messageId === m.id
										? streamingSnapshot.content
										: m.content
								const message =
									liveContent === m.content ? m : { ...m, content: liveContent }

								return (
									<MessageBubble
										key={m.id}
										message={message}
										activeConnectionId={activeConnectionId}
										onEditorInsert={onEditorInsert}
										onRunInConsole={onRunInConsole}
									/>
								)
							})}
						</div>
					)}
				</div>

				{error && messages.length === 0 && (
					<div className='border-t border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-400'>
						{error}
					</div>
				)}

				<div className='border-t border-sidebar-border bg-sidebar/95 p-3'>
					{!activeConnectionId && (
						<div className='mb-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-500'>
							No active connection — schema context disabled.
						</div>
					)}
					{isTauri && !keysAvailable && (
						<div className='mb-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-500'>
							Configure the active AI provider in Settings → AI Provider
							{activeProvider ? ` (${activeProvider})` : ''}.
						</div>
					)}
					<div className='relative rounded-lg border border-sidebar-border bg-background shadow-xs transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out)] focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/15'>
						<textarea
							ref={inputRef}
							value={input}
							onChange={function (e) {
								setInput(e.target.value)
							}}
							onKeyDown={handleKeyDown}
							disabled={isStreaming || !keysAvailable}
							placeholder='Ask about your schema or query…'
							rows={2}
							className='max-h-32 min-h-16 w-full resize-none border-0 bg-transparent px-3 py-2.5 pr-11 text-sm leading-relaxed outline-none disabled:opacity-50'
						/>
						<div className='absolute bottom-1.5 right-1.5'>
							{isStreaming ? (
								<Button
									variant='ghost'
									size='icon'
									className='h-7 w-7'
									onClick={abort}
									title='Stop'
									aria-label='Stop generating response'
								>
									<Square className='h-3.5 w-3.5 fill-current' />
								</Button>
							) : (
								<Button
									variant='ghost'
									size='icon'
									className='h-7 w-7'
									onClick={handleSend}
									disabled={!input.trim() || !keysAvailable}
									aria-label='Send message'
								>
									<Send className='h-3.5 w-3.5' />
								</Button>
							)}
						</div>
					</div>
					<div className='mt-1.5 flex items-center justify-between px-0.5 text-[10px] text-muted-foreground'>
						<span>Enter sends · Shift+Enter adds a line</span>
						{isStreaming && (
							<span
								className={cn(
									'font-medium text-primary/80',
									!isWaitingForFirstToken && 'opacity-80'
								)}
							>
								{isWaitingForFirstToken ? 'Thinking…' : 'Writing…'}
							</span>
						)}
					</div>
				</div>
			</div>
		</aside>
	)
}

type EmptyStateProps = {
	suggestions: string[]
	onPick: (prompt: string) => void
	hasConnection: boolean
}

function EmptyState({ suggestions, onPick, hasConnection }: EmptyStateProps) {
	const quickActions = getQuickActions()

	return (
		<div className='mx-auto flex w-full max-w-md flex-col px-4 py-6'>
			<div className='mb-6'>
				<h2 className='text-base font-semibold text-foreground'>Work with your database</h2>
				<p className='mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground'>
					{hasConnection
						? 'Ask for SQL, inspect your schema, or turn an idea into a query.'
						: 'Connect a database to include schema context in your questions.'}
				</p>
			</div>
			<div className='mb-6'>
				<div className='mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground'>
					Quick actions
				</div>
				<div className='grid grid-cols-2 gap-2'>
					{quickActions.map(function (action) {
						return (
							<button
								type='button'
								key={action.label}
								onClick={function () {
									onPick(action.prompt)
								}}
								className='min-h-12 rounded-md border border-sidebar-border bg-sidebar-accent/25 px-3 py-2 text-left text-xs font-medium text-foreground transition-[background-color,border-color] duration-150 ease-[var(--ease-out)] hover:border-sidebar-foreground/20 hover:bg-sidebar-accent focus-visible:bg-focus'
							>
								{action.label}
							</button>
						)
					})}
				</div>
			</div>
			<div>
				<div className='mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground'>
					{hasConnection ? 'Suggestions from your schema' : 'Suggestions'}
				</div>
				<div className='space-y-1.5'>
					{suggestions.slice(0, 4).map(function (s) {
						return (
							<button
								type='button'
								key={s}
								onClick={function () {
									onPick(s)
								}}
								className='block w-full rounded-md border border-transparent px-3 py-2 text-left text-xs leading-relaxed text-muted-foreground transition-[background-color,color] duration-150 ease-[var(--ease-out)] hover:bg-sidebar-accent/70 hover:text-foreground focus-visible:bg-focus focus-visible:text-foreground'
							>
								{s}
							</button>
						)
					})}
				</div>
			</div>
		</div>
	)
}
