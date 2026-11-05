import { describe, expect, it } from 'vitest'
import {
	buildChartDataset,
	getChartDegenerateReason,
	inferColumnKind,
	suggestChartConfig
} from '../../../../packages/studio/src/features/result-charts/chart-data'
import type {
	ResultChartColumn,
	ResultChartConfig
} from '../../../../packages/studio/src/features/result-charts/types'

describe('result chart data', function () {
	it('uses backend column metadata before value sniffing', function () {
		const rows = [{ total: '42', created_at: '2026-01-02' }]

		expect(inferColumnKind({ name: 'total', type: 'numeric' }, rows)).toBe('number')
		expect(inferColumnKind({ name: 'created_at', type: 'timestamp' }, rows)).toBe('date')
		expect(inferColumnKind({ name: 'name', type: 'varchar' }, [{ name: 12 }])).toBe('text')
	})

	it('falls back to value sniffing for untyped providers', function () {
		expect(inferColumnKind({ name: 'x' }, [{ x: 1 }, { x: '2' }])).toBe('number')
		expect(inferColumnKind({ name: 'd' }, [{ d: '2026-06-13' }])).toBe('date')
		expect(inferColumnKind({ name: 'label' }, [{ label: 'ready' }])).toBe('text')
	})

	it('suggests line for date plus numeric, bar for text plus numeric, and scatter for two numerics', function () {
		expect(
			suggestChartConfig({
				columns: [
					{ name: 'created_at', type: 'date' },
					{ name: 'count', type: 'int' }
				],
				rows: [{ created_at: '2026-06-13', count: 3 }]
			})?.type
		).toBe('line')

		expect(
			suggestChartConfig({
				columns: [
					{ name: 'status', type: 'text' },
					{ name: 'count', type: 'int' }
				],
				rows: [{ status: 'open', count: 3 }]
			})?.type
		).toBe('bar')

		expect(
			suggestChartConfig({
				columns: [
					{ name: 'lat', type: 'float' },
					{ name: 'lon', type: 'float' }
				],
				rows: [{ lat: 1, lon: 2 }]
			})?.type
		).toBe('scatter')
	})

	it('keeps a still-valid previous config', function () {
		const previous: ResultChartConfig = {
			type: 'area',
			xColumn: 'day',
			yColumns: ['revenue'],
			aggregation: 'avg'
		}

		expect(
			suggestChartConfig({
				columns: [
					{ name: 'day', type: 'date' },
					{ name: 'revenue', type: 'numeric' }
				],
				rows: [{ day: '2026-06-13', revenue: 10 }],
				previous
			})
		).toBe(previous)
	})

	it('aggregates duplicate x values with sum, average, and count', function () {
		const rows = [
			{ status: 'open', total: 2 },
			{ status: 'open', total: 4 },
			{ status: 'done', total: 8 }
		]

		const base: ResultChartConfig = {
			type: 'bar',
			xColumn: 'status',
			yColumns: ['total'],
			aggregation: 'sum'
		}

		expect(buildChartDataset({ rows, config: base }).points).toEqual([
			{ __x: 'open', total: 6 },
			{ __x: 'done', total: 8 }
		])

		expect(
			buildChartDataset({ rows, config: { ...base, aggregation: 'avg' } }).points[0].total
		).toBe(3)

		expect(
			buildChartDataset({ rows, config: { ...base, aggregation: 'count' } }).points[0].total
		).toBe(2)
	})

	it('builds grouped multi-series keys', function () {
		const dataset = buildChartDataset({
			rows: [
				{ day: 'Mon', region: 'EU', revenue: 10 },
				{ day: 'Mon', region: 'US', revenue: 20 }
			],
			config: {
				type: 'line',
				xColumn: 'day',
				yColumns: ['revenue'],
				groupByColumn: 'region',
				aggregation: 'sum'
			}
		})

		expect(
			dataset.series.map(function (series) {
				return series.key
			})
		).toEqual(['EU · revenue', 'US · revenue'])
		expect(dataset.points[0]).toEqual({
			__x: 'Mon',
			'EU · revenue': 10,
			'US · revenue': 20
		})
	})

	it('downsamples large result sets without changing the source rows', function () {
		const rows = Array.from({ length: 12 }, function (_, index) {
			return { index, value: index }
		})
		const dataset = buildChartDataset({
			rows,
			maxPoints: 5,
			config: {
				type: 'line',
				xColumn: 'index',
				yColumns: ['value'],
				aggregation: 'sum'
			}
		})

		expect(dataset.wasDownsampled).toBe(true)
		expect(dataset.originalPointCount).toBe(12)
		expect(dataset.points).toHaveLength(4)
	})

	it('returns useful degenerate-state reasons', function () {
		const columns: ResultChartColumn[] = [{ name: 'label', type: 'text' }]

		expect(getChartDegenerateReason({ columns, rows: [], config: null })).toContain('no rows')
		expect(
			getChartDegenerateReason({
				columns,
				rows: [{ label: 'a' }],
				config: null
			})
		).toContain('numeric column')
		expect(
			getChartDegenerateReason({
				columns: [
					{ name: 'label', type: 'text' },
					{ name: 'value', type: 'numeric' }
				],
				rows: [{ label: 'a', value: null }],
				config: {
					type: 'bar',
					xColumn: 'label',
					yColumns: ['value'],
					aggregation: 'sum'
				}
			})
		).toContain('empty or non-numeric')
	})
})
