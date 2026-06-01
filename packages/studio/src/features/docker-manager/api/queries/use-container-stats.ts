import { useQuery } from '@tanstack/react-query'
import { executeDockerCommand } from '../docker-client'

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

async function fetchContainerStats(containerId: string): Promise<ContainerStats | null> {
	const result = await executeDockerCommand([
		'stats',
		'--no-stream',
		'--format',
		'{{json .}}',
		containerId
	])

	if (result.exitCode !== 0 || !result.stdout.trim()) {
		return null
	}

	try {
		const parsed: DockerStatsResult = JSON.parse(result.stdout.trim().split('\n')[0])

		const cpuPercent = parseFloat(parsed.CPUPerc?.replace('%', '') || '0')
		const memoryPercent = parseFloat(parsed.MemPerc?.replace('%', '') || '0')
		const pids = parseInt(parsed.PIDs || '0', 10)

		// MemUsage format: "123MiB / 1GiB"
		const [usageStr, limitStr] = (parsed.MemUsage || '0B / 0B').split('/')
		const memoryUsageBytes = parseBytes(usageStr)
		const memoryLimitBytes = parseBytes(limitStr)

		return {
			cpuPercent,
			memoryUsageBytes,
			memoryLimitBytes,
			memoryPercent,
			pids
		}
	} catch {
		return null
	}
}

type UseContainerStatsOptions = {
	enabled?: boolean
	refetchInterval?: number
}

export function useContainerStats(
	containerId: string | null,
	options: UseContainerStatsOptions = {}
) {
	const { enabled = true, refetchInterval = 5000 } = options

	return useQuery<ContainerStats | null, Error>({
		queryKey: ['docker-container-stats', containerId],
		queryFn: function () {
			if (!containerId) return Promise.resolve(null)
			return fetchContainerStats(containerId)
		},
		enabled: enabled && Boolean(containerId),
		refetchInterval,
		staleTime: 3000
	})
}
