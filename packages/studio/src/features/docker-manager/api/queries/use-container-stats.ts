import { useEffect, useState } from 'react'
import { deps } from '../docker-client'

export type ContainerStats = {
	cpuPercent: number
	memoryUsageBytes: number
	memoryLimitBytes: number
	memoryPercent: number
	pids: number
}

type DockerStatsResult = {
	CPUPerc: string
	MemUsage: string
	MemPerc: string
	PIDs: string
}

function parseBytes(str: string): number {
	const match = str.trim().match(/^([\d.]+)\s*([KMGT]?i?B?)$/i)
	if (!match) return 0

	const value = parseFloat(match[1])
	const unit = (match[2] || 'B').toUpperCase()

	const multipliers: Record<string, number> = {
		B: 1,
		KB: 1000,
		KIB: 1024,
		MB: 1000 * 1000,
		MIB: 1024 * 1024,
		GB: 1000 * 1000 * 1000,
		GIB: 1024 * 1024 * 1024,
		TB: 1000 * 1000 * 1000 * 1000,
		TIB: 1024 * 1024 * 1024 * 1024
	}

	return value * (multipliers[unit] ?? 1)
}

/**
 * @name parseStatsLine
 * @description Parses one line of `docker stats --format '{{json .}}'` output into numeric stats, or null when the line holds no sample.
 * @example
 * parseStatsLine('{"CPUPerc":"1.5%","MemUsage":"10MiB / 1GiB","MemPerc":"1%","PIDs":"4"}')
 */
export function parseStatsLine(line: string): ContainerStats | null {
	// Streaming mode prefixes every sample with ANSI clear-screen codes.
	const jsonStart = line.indexOf('{')
	if (jsonStart === -1) return null

	try {
		const parsed: DockerStatsResult = JSON.parse(line.slice(jsonStart).trim())

		const cpuPercent = parseFloat(parsed.CPUPerc?.replace('%', '') || '0')
		const memoryPercent = parseFloat(parsed.MemPerc?.replace('%', '') || '0')
		const pids = parseInt(parsed.PIDs || '0', 10)

		// MemUsage format: "123MiB / 1GiB"
		const [usageStr, limitStr] = (parsed.MemUsage || '0B / 0B').split('/')

		return {
			cpuPercent: Number.isNaN(cpuPercent) ? 0 : cpuPercent,
			memoryUsageBytes: parseBytes(usageStr),
			memoryLimitBytes: parseBytes(limitStr ?? '0B'),
			memoryPercent: Number.isNaN(memoryPercent) ? 0 : memoryPercent,
			pids: Number.isNaN(pids) ? 0 : pids
		}
	} catch {
		return null
	}
}

async function streamContainerStats(
	containerId: string,
	onStats: (stats: ContainerStats) => void
): Promise<() => void> {
	const Command = await deps.getCommand()
	const command = Command.create('docker', ['stats', '--format', '{{json .}}', containerId])

	command.stdout.on('data', function (line) {
		const stats = parseStatsLine(line)
		if (stats) onStats(stats)
	})

	const child = await command.spawn()

	return function stop() {
		void child.kill().catch(function ignoreAlreadyExited() {})
	}
}

type UseContainerStatsOptions = {
	enabled?: boolean
}

type StatsState = {
	containerId: string
	stats: ContainerStats
}

const isTauri =
	typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)

/**
 * @name useContainerStats
 * @description Live CPU, memory and PID stats for one container, fed by a single long-lived `docker stats` process instead of a blocking poll.
 * @example
 * const { data: stats, isFetching } = useContainerStats(container.id, { enabled: isRunning })
 */
export function useContainerStats(
	containerId: string | null,
	options: UseContainerStatsOptions = {}
) {
	const { enabled = true } = options
	const [state, setState] = useState<StatsState | null>(null)
	const isStreaming = isTauri && enabled && Boolean(containerId)

	useEffect(
		function streamStats() {
			if (!isStreaming || !containerId) return

			let cancelled = false
			let stop: (() => void) | null = null

			streamContainerStats(containerId, function (stats) {
				if (!cancelled) setState({ containerId, stats })
			})
				.then(function (stopStream) {
					if (cancelled) stopStream()
					else stop = stopStream
				})
				.catch(function (error) {
					console.error('Failed to stream container stats:', error)
				})

			return function stopStats() {
				cancelled = true
				stop?.()
			}
		},
		[containerId, isStreaming]
	)

	const data = isStreaming && state?.containerId === containerId ? state.stats : null

	return { data, isFetching: isStreaming && !data }
}
