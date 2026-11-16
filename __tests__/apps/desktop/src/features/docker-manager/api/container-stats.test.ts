import { describe, expect, it } from 'vitest'
import { parseStatsLine } from '@/features/docker-manager/api/queries/use-container-stats'

const SAMPLE = '{"CPUPerc":"12.5%","MemUsage":"512MiB / 2GiB","MemPerc":"25.00%","PIDs":"9"}'

describe('parseStatsLine', function () {
	it('parses a plain stats sample', function () {
		expect(parseStatsLine(SAMPLE)).toEqual({
			cpuPercent: 12.5,
			memoryUsageBytes: 512 * 1024 * 1024,
			memoryLimitBytes: 2 * 1024 * 1024 * 1024,
			memoryPercent: 25,
			pids: 9
		})
	})

	it('ignores the clear-screen codes that prefix streamed samples', function () {
		expect(parseStatsLine(`\u001b[2J\u001b[H${SAMPLE}`)?.cpuPercent).toBe(12.5)
	})

	it('returns null for lines without a sample', function () {
		expect(parseStatsLine('')).toBeNull()
		expect(parseStatsLine('\u001b[2J\u001b[H')).toBeNull()
		expect(parseStatsLine('{not json')).toBeNull()
	})

	it('reads placeholder values from a stopping container as zero', function () {
		const stats = parseStatsLine('{"CPUPerc":"--","MemUsage":"-- / --","MemPerc":"--","PIDs":"--"}')
		expect(stats).toEqual({
			cpuPercent: 0,
			memoryUsageBytes: 0,
			memoryLimitBytes: 0,
			memoryPercent: 0,
			pids: 0
		})
	})
})
