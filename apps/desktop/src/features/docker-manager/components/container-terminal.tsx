import { RotateCcw, Send, TerminalSquare, XCircle, Eraser, Zap } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { cn } from '@/shared/utils/cn'
import { openContainerTerminal } from '../api/container-service'
import type { ContainerTerminalSession, DockerContainer } from '../types'

type Props = {
	container: DockerContainer
	enabled: boolean
}

type TerminalState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

const MAX_OUTPUT_CHARS = 120000

export function ContainerTerminal({ container, enabled }: Props) {
	const [output, setOutput] = useState('')
	const [command, setCommand] = useState('')
	const [terminalState, setTerminalState] = useState<TerminalState>('idle')
	const [history, setHistory] = useState<string[]>([])
	const [historyIndex, setHistoryIndex] = useState<number>(-1)

	const sessionRef = useRef<ContainerTerminalSession | null>(null)
	const outputRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)
	const closingRef = useRef(false)
	const connectingRef = useRef(false)
	const connectCounterRef = useRef(0)
	const previousContainerIdRef = useRef(container.id)

	const isRunning = container.state === 'running'

	const appendOutput = useCallback(function (chunk: string) {
		setOutput(function (previous) {
			const next = previous + chunk
			if (next.length <= MAX_OUTPUT_CHARS) {
				return next
			}

			return next.slice(next.length - MAX_OUTPUT_CHARS)
		})
	}, [])

	const disconnectSession = useCallback(async function (announce: boolean) {
		const session = sessionRef.current
		if (!session) {
			return
		}

		closingRef.current = true
		connectingRef.current = false
		sessionRef.current = null

		try {
			await session.kill()
		} catch {
			// Session may already be closed.
		}

		setTerminalState('disconnected')
		if (announce) {
			appendOutput('\n[terminal disconnected]\n')
		}
	}, [appendOutput])

	const connectSession = useCallback(async function () {
		if (!enabled || !isRunning || sessionRef.current || connectingRef.current) {
			return
		}

		const connectId = connectCounterRef.current + 1
		connectCounterRef.current = connectId

		connectingRef.current = true
		setTerminalState('connecting')
		appendOutput(`[connecting to ${container.name}]\n`)

		try {
			const session = await openContainerTerminal(container.id, {
				onOutput: function (chunk) {
					if (connectCounterRef.current !== connectId) {
						return
					}
					appendOutput(chunk)
				},
				onError: function (error) {
					if (connectCounterRef.current !== connectId) {
						return
					}
					appendOutput(`\n[terminal error] ${error}\n`)
					setTerminalState('error')
				},
				onClose: function (code, signal) {
					if (connectCounterRef.current !== connectId) {
						return
					}

					sessionRef.current = null
					setTerminalState('disconnected')
					connectingRef.current = false

					const closedByUser = closingRef.current
					closingRef.current = false

					if (!closedByUser) {
						appendOutput(
							`\n[terminal exited${code !== null ? ` code=${code}` : ''}${signal !== null ? ` signal=${signal}` : ''}]\n`
						)
					}
				}
			})

			if (connectCounterRef.current !== connectId) {
				await session.kill().catch(function () {
					return
				})
				connectingRef.current = false
				return
			}

			sessionRef.current = session
			connectingRef.current = false
			setTerminalState('connected')
			appendOutput(`[connected to ${container.name}]\n`)
			inputRef.current?.focus()
		} catch (error) {
			connectingRef.current = false
			const message = error instanceof Error ? error.message : 'Failed to open terminal'
			appendOutput(`\n[connection failed] ${message}\n`)
			setTerminalState('error')
		}
	}, [appendOutput, container.id, container.name, enabled, isRunning])

	useEffect(function () {
		if (!enabled || !isRunning) {
			void disconnectSession(false)
			return
		}

		void connectSession()

		return function () {
			void disconnectSession(false)
		}
	}, [connectSession, disconnectSession, enabled, isRunning])

	useEffect(function () {
		if (!outputRef.current) {
			return
		}
		outputRef.current.scrollTop = outputRef.current.scrollHeight
	}, [output])

	useEffect(
		function resetStateWhenContainerChanges() {
			if (previousContainerIdRef.current === container.id) {
				return
			}

			previousContainerIdRef.current = container.id
			setOutput('')
			setCommand('')
			setHistory([])
			setHistoryIndex(-1)
			setTerminalState('idle')
		},
		[container.id]
	)

	async function handleSendCommand(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()

		const session = sessionRef.current
		const nextCommand = command.trim()
		if (!session || !nextCommand) {
			return
		}

		appendOutput(`$ ${nextCommand}\n`)
		setHistory(function (current) {
			const updated = [...current, nextCommand]
			return updated.slice(updated.length - 100)
		})
		setHistoryIndex(-1)
		setCommand('')

		try {
			await session.write(`${nextCommand}\n`)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to send command'
			appendOutput(`[write failed] ${message}\n`)
			setTerminalState('error')
		}
	}

	function handleCommandHistory(event: React.KeyboardEvent<HTMLInputElement>) {
		if (!history.length) {
			return
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault()
			const nextIndex = historyIndex < 0 ? history.length - 1 : Math.max(historyIndex - 1, 0)
			setHistoryIndex(nextIndex)
			setCommand(history[nextIndex] ?? '')
		}

		if (event.key === 'ArrowDown') {
			event.preventDefault()
			if (historyIndex < 0) {
				return
			}

			const nextIndex = historyIndex + 1
			if (nextIndex >= history.length) {
				setHistoryIndex(-1)
				setCommand('')
				return
			}

			setHistoryIndex(nextIndex)
			setCommand(history[nextIndex] ?? '')
		}
	}

	async function handleInterrupt() {
		if (!sessionRef.current) {
			return
		}

		try {
			await sessionRef.current.write('\u0003')
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to send interrupt'
			appendOutput(`[interrupt failed] ${message}\n`)
		}
	}

	async function handleConnectToggle() {
		if (sessionRef.current) {
			await disconnectSession(true)
			return
		}

		await connectSession()
	}

	function clearOutput() {
		setOutput('')
	}

	if (!isRunning) {
		return (
			<div className='flex h-full items-center justify-center rounded-lg border border-border/70 bg-muted/20 p-4 text-center'>
				<div className='space-y-1'>
					<p className='text-sm font-medium'>Terminal is unavailable</p>
					<p className='text-xs text-muted-foreground'>
						Start this container to open a real shell session.
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className='flex h-full flex-col'>
			<div className='mb-2 flex items-center justify-between gap-2'>
				<div className='flex items-center gap-2'>
					<TerminalSquare className='h-3.5 w-3.5 text-muted-foreground' aria-hidden='true' />
					<span className='text-xs font-medium'>Container Terminal</span>
					<span
						className={cn(
							'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
							terminalState === 'connected' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500',
							terminalState === 'connecting' && 'border-amber-500/30 bg-amber-500/10 text-amber-500',
							terminalState === 'error' && 'border-destructive/30 bg-destructive/10 text-destructive',
							(terminalState === 'disconnected' || terminalState === 'idle') &&
								'border-zinc-500/30 bg-zinc-500/10 text-zinc-400'
						)}
					>
						{terminalState}
					</span>
				</div>

				<div className='flex items-center gap-1'>
					<Button
						type='button'
						size='icon-sm'
						variant='outline'
						onClick={clearOutput}
						aria-label='Clear terminal output'
					>
						<Eraser className='h-3.5 w-3.5' aria-hidden='true' />
					</Button>

					<Button
						type='button'
						size='icon-sm'
						variant='outline'
						onClick={handleInterrupt}
						disabled={!sessionRef.current}
						aria-label='Send Ctrl+C'
					>
						<Zap className='h-3.5 w-3.5' aria-hidden='true' />
					</Button>

					<Button
						type='button'
						size='icon-sm'
						variant='outline'
						onClick={handleConnectToggle}
						aria-label={sessionRef.current ? 'Disconnect terminal' : 'Connect terminal'}
					>
						{sessionRef.current ? (
							<XCircle className='h-3.5 w-3.5' aria-hidden='true' />
						) : (
							<RotateCcw className='h-3.5 w-3.5' aria-hidden='true' />
						)}
					</Button>
				</div>
			</div>

			<div
				ref={outputRef}
				role='log'
				aria-label='Container terminal output'
				aria-live='polite'
				className='flex-1 overflow-auto rounded-lg border border-border/70 bg-zinc-950 p-3 text-xs font-mono text-zinc-200'
			>
				{output ? (
					<pre className='whitespace-pre-wrap break-words'>{output}</pre>
				) : (
					<p className='text-zinc-400'>No terminal output yet.</p>
				)}
			</div>

			<form onSubmit={handleSendCommand} className='mt-2 flex items-center gap-2'>
				<Input
					ref={inputRef}
					value={command}
					name='terminal_command'
					autoComplete='off'
					placeholder='Type command (example: psql -U postgres -d postgres)...'
					onChange={function (event) {
						setCommand(event.target.value)
					}}
					onKeyDown={handleCommandHistory}
					disabled={!sessionRef.current}
					className='h-8 text-xs'
					aria-label='Terminal command input'
				/>
				<Button
					type='submit'
					size='sm'
					className='h-8 gap-1.5'
					disabled={!sessionRef.current || !command.trim()}
				>
					<Send className='h-3.5 w-3.5' aria-hidden='true' />
					Run
				</Button>
			</form>
		</div>
	)
}
