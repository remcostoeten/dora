import { useEffect, useRef, useMemo } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { LOG_TAIL_OPTIONS } from '../constants'

type Props = {
	logs: string
	isLoading: boolean
	tailLines: number
	onTailLinesChange: (lines: number) => void
}

type LogToken = {
	text: string
	className: string
}

function tokenizeLine(line: string): LogToken[] {
	const tokens: LogToken[] = []

	// Match timestamp at the start: 2026-02-06T00:06:27.545Z or similar ISO formats
	const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z?\s?)/)
	let remaining = line

	if (timestampMatch) {
		tokens.push({
			text: timestampMatch[1],
			className: 'text-muted-foreground/60'
		})
		remaining = line.slice(timestampMatch[1].length)
	}

	// Match log level keywords
	const levelMatch = remaining.match(/^(LOG|ERROR|FATAL|PANIC|WARNING|HINT|NOTICE|DEBUG|INFO|DETAIL|STATEMENT)(\s*:\s*)/)
	if (levelMatch) {
		const level = levelMatch[1]
		let levelColor = 'text-blue-400'
		if (level === 'ERROR' || level === 'FATAL' || level === 'PANIC') {
			levelColor = 'text-red-400 font-semibold'
		} else if (level === 'WARNING' || level === 'HINT') {
			levelColor = 'text-yellow-400'
		} else if (level === 'LOG' || level === 'INFO') {
			levelColor = 'text-emerald-400'
		} else if (level === 'DEBUG') {
			levelColor = 'text-zinc-500'
		} else if (level === 'NOTICE') {
			levelColor = 'text-cyan-400'
		}

		tokens.push({ text: level, className: levelColor })
		tokens.push({ text: levelMatch[2], className: 'text-zinc-600' })
		remaining = remaining.slice(levelMatch[0].length)
	}

	// Highlight remaining text with inline patterns
	if (remaining) {
		// Highlight quoted strings, numbers, and key patterns in the message
		const parts = remaining.split(/("[^"]*"|'[^']*'|\b\d+\.\d+%?\b|\b\d{3,}\b|\bport\s+\d+\b)/g)
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i]
			if (!part) continue
			if ((part.startsWith('"') && part.endsWith('"')) || (part.startsWith("'") && part.endsWith("'"))) {
				tokens.push({ text: part, className: 'text-amber-300/80' })
			} else if (/^\d+\.\d+%?$/.test(part) || /^\d{3,}$/.test(part)) {
				tokens.push({ text: part, className: 'text-purple-400/80' })
			} else if (/^port\s+\d+$/i.test(part)) {
				tokens.push({ text: part, className: 'text-cyan-400/80' })
			} else {
				tokens.push({ text: part, className: 'text-zinc-300' })
			}
		}
	}

	return tokens
}

function HighlightedLogs({ logs }: { logs: string }) {
	const lines = useMemo(function () {
		return logs.split('\n').map(function (line, i) {
			return { key: i, tokens: tokenizeLine(line) }
		})
	}, [logs])

	return (
		<>
			{lines.map(function (line) {
				return (
					<div key={line.key} className='leading-5 hover:bg-white/[0.02]'>
						{line.tokens.map(function (token, j) {
							return (
								<span key={j} className={token.className}>
									{token.text}
								</span>
							)
						})}
					</div>
				)
			})}
		</>
	)
}

export function LogsViewer({ logs, isLoading, tailLines, onTailLinesChange }: Props) {
	const logsContainerRef = useRef<HTMLDivElement>(null)

	useEffect(
		function scrollToBottom() {
			if (logsContainerRef.current) {
				logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight
			}
		},
		[logs]
	)

	function handleTailChange(value: string) {
		onTailLinesChange(parseInt(value, 10))
	}

	return (
		<div className='flex flex-col h-full'>
			<div className='flex items-center justify-between gap-2 pb-2 border-b border-border'>
				<div className='flex items-center gap-2'>
					<span id='logs-tail-label' className='text-xs text-muted-foreground'>
						Show last
					</span>
					<Select value={String(tailLines)} onValueChange={handleTailChange}>
						<SelectTrigger
							className='h-7 w-20 text-xs'
							aria-label='Number of log lines to show'
							aria-labelledby='logs-tail-label'
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{LOG_TAIL_OPTIONS.map(function (option) {
								return (
									<SelectItem key={option} value={String(option)}>
										{option} lines
									</SelectItem>
								)
							})}
						</SelectContent>
					</Select>
				</div>
			</div>

			<div
				ref={logsContainerRef}
				role='log'
				aria-label='Container logs'
				aria-live='polite'
				aria-busy={isLoading}
				tabIndex={0}
				className='flex-1 mt-2 p-3 rounded-lg bg-zinc-950 text-xs font-mono overflow-auto border border-border/50'
			>
				{logs ? (
					<HighlightedLogs logs={logs} />
				) : (
					<span className='text-zinc-500'>No logs available</span>
				)}
			</div>
		</div>
	)
}
