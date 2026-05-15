import { Loader2, Send, Sparkles, Square, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { commands } from '@/lib/bindings'
import type { DatabaseSchema, GroqStatus } from '@/lib/bindings'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/utils/cn'
import { MessageBubble } from './message-bubble'
import { useAiAssistantStore } from './store'
import { buildDynamicSuggestions, getQuickActions } from './suggestions'
import { useAiChat } from './use-ai-chat'

type Props = {
	activeConnectionId: string | null
	onEditorInsert?: (sql: string) => void
}

export function AiAssistantPanel({ activeConnectionId, onEditorInsert }: Props) {
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

	const { messages, isStreaming, error, send, abort, clear } = useAiChat(activeConnectionId)
	const [input, setInput] = useState('')
	const [groqStatus, setGroqStatus] = useState<GroqStatus | null>(null)
	const [schema, setSchema] = useState<DatabaseSchema | null>(null)
	const scrollRef = useRef<HTMLDivElement | null>(null)
	const inputRef = useRef<HTMLTextAreaElement | null>(null)

	useEffect(
		function checkGroq() {
			if (!open) return
			commands
				.aiGroqStatus()
				.then(function (res) {
					if (res.status === 'ok') setGroqStatus(res.data)
				})
				.catch(function () {})
		},
		[open]
	)

	useEffect(
		function loadSchema() {
			if (!open || !activeConnectionId) {
				setSchema(null)
				return
			}
			commands
				.getDatabaseSchema(activeConnectionId, null)
				.then(function (res) {
					if (res.status === 'ok') setSchema(res.data)
				})
				.catch(function () {})
		},
		[open, activeConnectionId]
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
		function autoScroll() {
			if (!scrollRef.current) return
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight
		},
		[messages]
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

	const handleSend = useCallback(
		async function handleSend() {
			if (!input.trim() || isStreaming) return
			const text = input
			setInput('')
			await send({ prompt: text, activeConnectionId })
		},
		[input, isStreaming, send, activeConnectionId]
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

	if (!open) return null

	const keysAvailable = groqStatus?.available ?? false
	const keyLabel = groqStatus
		? keysAvailable
			? `${groqStatus.key_count} key${groqStatus.key_count === 1 ? '' : 's'}`
			: 'no keys'
		: '…'

	return (
		<aside
			className={cn(
				'fixed right-0 top-0 z-40 flex h-full w-[420px] max-w-[90vw] flex-col border-l border-sidebar-border bg-sidebar shadow-2xl'
			)}
		>
			<header className='flex items-center gap-2 border-b border-sidebar-border px-3 py-2'>
				<Sparkles className='h-4 w-4 text-primary' />
				<span className='text-xs font-semibold'>AI Assistant</span>
				<span
					className={cn(
						'rounded px-1.5 py-0.5 text-[10px]',
						keysAvailable
							? 'bg-emerald-500/10 text-emerald-500'
							: 'bg-amber-500/10 text-amber-500'
					)}
					title='Configured Groq API keys'
				>
					{keyLabel}
				</span>
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
					>
						<X className='h-3.5 w-3.5' />
					</Button>
				</div>
			</header>

			<div ref={scrollRef} className='flex-1 overflow-y-auto'>
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
					<div className='divide-y divide-sidebar-border/40'>
						{messages.map(function (m) {
							return (
								<MessageBubble
									key={m.id}
									message={m}
									activeConnectionId={activeConnectionId}
									onEditorInsert={onEditorInsert}
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

			<div className='border-t border-sidebar-border p-2'>
				{!activeConnectionId && (
					<div className='mb-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-500'>
						No active connection — schema context disabled.
					</div>
				)}
				{!keysAvailable && (
					<div className='mb-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-500'>
						Add a Groq API key in Settings → AI Keys to start chatting.
					</div>
				)}
				<div className='relative'>
					<textarea
						ref={inputRef}
						value={input}
						onChange={function (e) {
							setInput(e.target.value)
						}}
						onKeyDown={handleKeyDown}
						disabled={isStreaming || !keysAvailable}
						placeholder='Ask anything about your database…'
						rows={3}
						className='w-full resize-none rounded-md border border-sidebar-border bg-background px-3 py-2 pr-10 text-sm outline-none focus:border-primary disabled:opacity-50'
					/>
					<div className='absolute bottom-1.5 right-1.5'>
						{isStreaming ? (
							<Button
								variant='ghost'
								size='icon'
								className='h-7 w-7'
								onClick={abort}
								title='Stop'
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
							>
								<Send className='h-3.5 w-3.5' />
							</Button>
						)}
					</div>
				</div>
				<div className='mt-1 flex items-center justify-between text-[10px] text-muted-foreground'>
					<span>Enter to send · Shift+Enter newline · Esc to close</span>
					{isStreaming && (
						<span className='flex items-center gap-1'>
							<Loader2 className='h-3 w-3 animate-spin' />
							streaming…
						</span>
					)}
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
		<div className='p-3'>
			<div className='mb-3'>
				<div className='mb-2 text-[10px] uppercase tracking-wider text-muted-foreground'>
					Quick actions
				</div>
				<div className='grid grid-cols-2 gap-1.5'>
					{quickActions.map(function (action) {
						return (
							<button
								key={action.label}
								onClick={function () {
									onPick(action.prompt)
								}}
								className='rounded border border-sidebar-border bg-sidebar-accent/30 px-2 py-1.5 text-left text-[11px] hover:bg-sidebar-accent'
							>
								{action.label}
							</button>
						)
					})}
				</div>
			</div>
			<div>
				<div className='mb-2 text-[10px] uppercase tracking-wider text-muted-foreground'>
					{hasConnection ? 'Suggestions from your schema' : 'Suggestions'}
				</div>
				<div className='space-y-1'>
					{suggestions.map(function (s) {
						return (
							<button
								key={s}
								onClick={function () {
									onPick(s)
								}}
								className='block w-full rounded border border-sidebar-border bg-sidebar-accent/20 px-2 py-1.5 text-left text-[11px] hover:bg-sidebar-accent'
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
