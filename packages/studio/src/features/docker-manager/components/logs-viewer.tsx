import { useEffect, useMemo, useRef } from 'react'
import { EmptyState } from '@studio/shared/ui/empty-state'
import { RecordIllustration } from '@studio/shared/ui/empty-state-illustrations'

type Props = {
	logs: string
	isLoading: boolean
}

type LogLevel = 'warn' | 'error' | 'info'

type ParsedLine = {
	key: number
	timestamp: string
	level: string
	levelKind: LogLevel
	message: string
}

// Leading ISO-8601 timestamp, as written by `docker logs --timestamps` and most images.
const TIMESTAMP_PATTERN = /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z?\s?)/
// Postgres-style or bracketed level keyword at the start of the message.
const LEVEL_PATTERN =
	/^\[?(LOG|ERROR|FATAL|PANIC|WARNING|WARN|HINT|NOTICE|DEBUG|INFO|DETAIL|STATEMENT)\]?(\s*:?\s*)/

function toLevelKind(level: string): LogLevel {
	if (level === 'ERROR' || level === 'FATAL' || level === 'PANIC') return 'error'
	if (level === 'WARNING' || level === 'WARN') return 'warn'
	return 'info'
}

function parseLine(line: string, key: number): ParsedLine {
	const timestamp = line.match(TIMESTAMP_PATTERN)?.[1] ?? ''
	const rest = line.slice(timestamp.length)
	const levelMatch = rest.match(LEVEL_PATTERN)
	if (!levelMatch) {
		return { key, timestamp, level: '', levelKind: 'info', message: rest }
	}
	return {
		key,
		timestamp,
		level: levelMatch[1] + levelMatch[2],
		levelKind: toLevelKind(levelMatch[1]),
		message: rest.slice(levelMatch[0].length)
	}
}

export function LogsViewer({ logs, isLoading }: Props) {
	const logsContainerRef = useRef<HTMLDivElement>(null)
	const lines = useMemo(
		() =>
			logs
				.split('\n')
				.filter((line, index, all) => line || index < all.length - 1)
				.map((line, index) => parseLine(line, index)),
		[logs]
	)

	useEffect(
		function scrollToBottom() {
			const node = logsContainerRef.current
			if (node) node.scrollTop = node.scrollHeight
		},
		[logs]
	)

	return (
		<div
			ref={logsContainerRef}
			role='log'
			aria-label='Container logs'
			aria-live='polite'
			aria-busy={isLoading}
			tabIndex={0}
			className='dk-logs dk-mono'
		>
			{logs ? (
				lines.map((line) => (
					<div key={line.key} className='dk-ll'>
						{line.timestamp && <span className='dk-ll-ts'>{line.timestamp}</span>}
						{line.level && (
							<span className='dk-ll-lv' data-level={line.levelKind}>
								{line.level}
							</span>
						)}
						{line.message}
					</div>
				))
			) : (
				<EmptyState
					size='xs'
					headingLevel='h3'
					className='h-full font-sans'
					illustration={<RecordIllustration />}
					title={isLoading ? 'Loading logs' : 'No output yet'}
					description='Output appears here once the container writes to stdout or stderr.'
				/>
			)}
		</div>
	)
}
