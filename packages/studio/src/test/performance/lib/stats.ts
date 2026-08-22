/** Percentile helpers shared by the harness and the report writer. */

export type Summary = {
	samples: number[]
	count: number
	p50: number
	p95: number
	max: number
	min: number
}

/**
 * Nearest-rank percentile. With 20-40 samples an interpolating percentile
 * invents precision the sample size does not support, so a real observed sample
 * is reported instead.
 */
export function percentile(samples: readonly number[], fraction: number): number {
	if (samples.length === 0) return Number.NaN
	const sorted = [...samples].sort(function ascending(a, b) {
		return a - b
	})
	const rank = Math.ceil(fraction * sorted.length)
	const index = Math.min(Math.max(rank - 1, 0), sorted.length - 1)
	return sorted[index] as number
}

export function summarize(samples: readonly number[]): Summary {
	const rounded = samples.map(function round(value) {
		return Math.round(value * 100) / 100
	})
	return {
		samples: rounded,
		count: rounded.length,
		p50: percentile(rounded, 0.5),
		p95: percentile(rounded, 0.95),
		max: rounded.length === 0 ? Number.NaN : Math.max(...rounded),
		min: rounded.length === 0 ? Number.NaN : Math.min(...rounded)
	}
}

export function formatMs(value: number): string {
	return Number.isFinite(value) ? `${value.toFixed(2)} ms` : 'n/a'
}
