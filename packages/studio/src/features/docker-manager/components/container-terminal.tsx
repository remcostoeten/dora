import { RotateCcw, XCircle, Eraser, Zap } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { openContainerTerminal } from '../api/container-service'
import type { ContainerTerminalSession, DockerContainer } from '../types'
import { detectKeyValueProvider } from '../utilities/container-connection'
import { StatusDot } from './status-dot'

type Props = {
	container: DockerContainer
	enabled: boolean
}

type TerminalState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

const MAX_OUTPUT_CHARS = 120000

function getErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error) {
		return error.message
	}

	if (typeof error === 'string') {
		return error
	}

	if (error && typeof error === 'object') {
		try {
			return JSON.stringify(error)
		} catch {
			return fallback
		}
	}

	return fallback
}

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
	const keyValueProvider = detectKeyValueProvider(container)

	const appendOutput = useCallback(function (chunk: string) {
		setOutput(function (previous) {
			const next = previous + chunk
			if (next.length <= MAX_OUTPUT_CHARS) {
				return next
			}

			return next.slice(next.length - MAX_OUTPUT_CHARS)
		})
	}, [])

	const disconnectSession = useCallback(
		async function (announce: boolean) {
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
		},
		[appendOutput]
	)

	const connectSession = useCallback(
		async function () {
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
				const message = getErrorMessage(error, 'Failed to open terminal')
				appendOutput(`\n[connection failed] ${message}\n`)
				setTerminalState('error')
			}
		},
		[appendOutput, container.id, container.name, enabled, isRunning]
	)

	useEffect(
		function () {
			if (!enabled || !isRunning) {
				void disconnectSession(false)
				return
			}

			void connectSession()

			return function () {
				void disconnectSession(false)
			}
		},
		[connectSession, disconnectSession, enabled, isRunning]
	)

	useEffect(
		function () {
			if (!outputRef.current) {
				return
			}
			outputRef.current.scrollTop = outputRef.current.scrollHeight
		},
		[output]
	)

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
			const message = getErrorMessage(error, 'Failed to send command')
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
			const message = getErrorMessage(error, 'Failed to send interrupt')
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
			<div className='dk-shell'>
				<div className='dk-t-empty'>
					Terminal is unavailable. Start this container to open a shell session.
				</div>
			</div>
		)
	}

	const isConnected = Boolean(sessionRef.current)
	const stateTone =
		terminalState === 'connected'
			? 'ok'
			: terminalState === 'connecting'
				? 'busy'
				: terminalState === 'error'
					? 'bad'
					: 'off'

	return (
		<div className='dk-shell'>
			<div
				ref={outputRef}
				role='log'
				aria-label='Container terminal output'
				aria-live='polite'
				className='dk-shell-out dk-mono'
			>
				{output || <span className='dk-faint'>docker exec -it {container.name} sh</span>}
			</div>

			<form onSubmit={handleSendCommand} className='dk-shell-in dk-mono'>
				<span className='dk-state-chip' title={`Terminal ${terminalState}`}>
					<StatusDot tone={stateTone} label={`Terminal ${terminalState}`} />
					{container.id.slice(0, 12)}:/#
				</span>
				<input
					ref={inputRef}
					value={command}
					name='terminal_command'
					autoComplete='off'
					spellCheck={false}
					placeholder={
						keyValueProvider
							? `${keyValueProvider}-cli ping`
							: 'psql -U postgres, mysql -u root, ls'
					}
					onChange={(event) => setCommand(event.target.value)}
					onKeyDown={handleCommandHistory}
					disabled={!isConnected}
					aria-label='Terminal command input'
				/>
				<button
					type='button'
					className='dk-ibtn'
					data-size='sm'
					onClick={clearOutput}
					aria-label='Clear terminal output'
					title='Clear'
				>
					<Eraser className='h-3.5 w-3.5' aria-hidden='true' />
				</button>
				<button
					type='button'
					className='dk-ibtn'
					data-size='sm'
					onClick={handleInterrupt}
					disabled={!isConnected}
					aria-label='Send Ctrl+C'
					title='Send Ctrl+C'
				>
					<Zap className='h-3.5 w-3.5' aria-hidden='true' />
				</button>
				<button
					type='button'
					className='dk-ibtn'
					data-size='sm'
					onClick={handleConnectToggle}
					aria-label={isConnected ? 'Disconnect terminal' : 'Connect terminal'}
					title={isConnected ? 'Disconnect' : 'Reconnect'}
				>
					{isConnected ? (
						<XCircle className='h-3.5 w-3.5' aria-hidden='true' />
					) : (
						<RotateCcw className='h-3.5 w-3.5' aria-hidden='true' />
					)}
				</button>
			</form>
		</div>
	)
}
