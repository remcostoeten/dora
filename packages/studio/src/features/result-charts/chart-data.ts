import type {
	ResultChartAggregation,
	ResultChartColumn,
	ResultChartColumnKind,
	ResultChartConfig,
	ResultChartDataset,
	ResultChartPoint,
	ResultChartSeries,
	ResultChartType
} from './types'

const MAX_CHART_POINTS = 10_000
const SAMPLE_SCAN_LIMIT = 50

const NUMBER_TYPE_RE =
	/(^|\b)(int|integer|bigint|smallint|serial|decimal|numeric|real|float|double|money)(\b|$)/i
const DATE_TYPE_RE = /(^|\b)(date|time|timestamp|datetime|timestamptz)(\b|$)/i
const BOOLEAN_TYPE_RE = /(^|\b)(bool|boolean)(\b|$)/i
const TEXT_TYPE_RE = /(^|\b)(char|text|uuid|json|xml|varchar|string)(\b|$)/i

export function inferColumnKind(
	column: ResultChartColumn,
	rows: Record<string, unknown>[]
): ResultChartColumnKind {
	const type = column.type?.trim()
	if (type) {
		if (NUMBER_TYPE_RE.test(type)) return 'number'
		if (DATE_TYPE_RE.test(type)) return 'date'
		if (BOOLEAN_TYPE_RE.test(type)) return 'boolean'
		if (TEXT_TYPE_RE.test(type)) return 'text'
	}

	const values = rows
		.map(function (row) {
			return row[column.name]
		})
		.filter(function (value) {
			return value !== null && value !== undefined
		})
		.slice(0, SAMPLE_SCAN_LIMIT)

	if (values.length === 0) return 'unknown'
	if (values.every(isNumericLike)) return 'number'
	if (values.every(isDateLike)) return 'date'
	if (
		values.every(function (value) {
			return typeof value === 'boolean'
		})
	)
		return 'boolean'
	return 'text'
}

export function suggestChartConfig(params: {
	columns: ResultChartColumn[]
	rows: Record<string, unknown>[]
	previous?: ResultChartConfig | null
}): ResultChartConfig | null {
	const { columns, rows, previous } = params
	if (previous && isConfigUsable(previous, columns)) return previous
	if (columns.length === 0 || rows.length === 0) return null

	const kinds = columns.map(function (column) {
		return { column, kind: inferColumnKind(column, rows) }
	})
	const numericColumns = kinds.filter(function (entry) {
		return entry.kind === 'number'
	})
	const dateColumns = kinds.filter(function (entry) {
		return entry.kind === 'date'
	})
	const textColumns = kinds.filter(function (entry) {
		return entry.kind === 'text'
	})

	if (dateColumns.length > 0 && numericColumns.length > 0) {
		return {
			type: 'line',
			xColumn: dateColumns[0].column.name,
			yColumns: [numericColumns[0].column.name],
			aggregation: 'sum'
		}
	}

	if (textColumns.length > 0 && numericColumns.length > 0) {
		return {
			type: 'bar',
			xColumn: textColumns[0].column.name,
			yColumns: [numericColumns[0].column.name],
			aggregation: 'sum'
		}
	}

	if (numericColumns.length >= 2) {
		return {
			type: 'scatter',
			xColumn: numericColumns[0].column.name,
			yColumns: [numericColumns[1].column.name],
			aggregation: 'avg'
		}
	}

	return null
}

export function getChartDegenerateReason(params: {
	columns: ResultChartColumn[]
	rows: Record<string, unknown>[]
	config: ResultChartConfig | null
}): string | null {
	const { columns, rows, config } = params
	if (rows.length === 0) return 'This result set has no rows to chart.'
	if (columns.length === 0) return 'This result set has no columns to chart.'
	if (!config) return 'Add at least one numeric column and a text, date, or numeric axis column.'

	const names = new Set(
		columns.map(function (column) {
			return column.name
		})
	)
	if (!names.has(config.xColumn)) return 'Choose an X column that exists in the result set.'
	if (config.yColumns.length === 0) return 'Choose at least one numeric Y column.'
	const missingY = config.yColumns.find(function (column) {
		return !names.has(column)
	})
	if (missingY) return `The Y column "${missingY}" is no longer in this result set.`

	const hasUsableX = rows.some(function (row) {
		const value = row[config.xColumn]
		return value !== null && value !== undefined && value !== ''
	})
	if (!hasUsableX) return 'The selected X column only contains empty values.'

	if (config.type !== 'pie') {
		const hasNumericY = rows.some(function (row) {
			return config.yColumns.some(function (column) {
				return toNumber(row[column]) !== null
			})
		})
		if (!hasNumericY) return 'The selected Y column only contains empty or non-numeric values.'
	}

	return null
}

export function buildChartDataset(params: {
	rows: Record<string, unknown>[]
	config: ResultChartConfig
	maxPoints?: number
}): ResultChartDataset {
	const { rows, config, maxPoints = MAX_CHART_POINTS } = params
	const grouped = new Map<string, AggregateBucket>()
	const groupByColumn = config.groupByColumn || null

	rows.forEach(function (row) {
		const rawX = row[config.xColumn]
		if (rawX === null || rawX === undefined || rawX === '') return
		const x = formatAxisValue(rawX)
		const xValue = axisPointValue(rawX)

		const groupLabel = groupByColumn ? formatAxisValue(row[groupByColumn]) : null
		const yColumns = config.type === 'pie' ? [config.yColumns[0]] : config.yColumns

		yColumns.forEach(function (yColumn) {
			if (!yColumn) return
			const rawY = config.aggregation === 'count' ? 1 : toNumber(row[yColumn])
			if (rawY === null) return
			const seriesKey = groupLabel ? `${groupLabel} · ${yColumn}` : yColumn
			const bucketKey = `${x}\u0000${seriesKey}`
			const bucket = grouped.get(bucketKey) ?? {
				x,
				xValue,
				seriesKey,
				sum: 0,
				count: 0
			}
			bucket.sum += rawY
			bucket.count += 1
			grouped.set(bucketKey, bucket)
		})
	})

	const seriesKeys = Array.from(
		new Set(
			Array.from(grouped.values()).map(function (bucket) {
				return bucket.seriesKey
			})
		)
	)
	const series: ResultChartSeries[] = seriesKeys.map(function (key) {
		return { key, label: key }
	})
	const pointMap = new Map<string, ResultChartPoint>()

	grouped.forEach(function (bucket) {
		const point = pointMap.get(bucket.x) ?? { __x: bucket.xValue }
		point[bucket.seriesKey] = aggregateValue(bucket, config.aggregation)
		pointMap.set(bucket.x, point)
	})

	const points = Array.from(pointMap.values())
	const sampled = downsamplePoints(points, maxPoints)

	return {
		points: sampled.points,
		series,
		wasDownsampled: sampled.wasDownsampled,
		originalPointCount: points.length
	}
}

export function chartTypesForConfig(config: ResultChartConfig): ResultChartType[] {
	if (config.yColumns.length > 1 || config.groupByColumn) {
		return ['bar', 'line', 'area', 'scatter']
	}
	return ['bar', 'line', 'area', 'pie', 'scatter']
}

function isConfigUsable(config: ResultChartConfig, columns: ResultChartColumn[]) {
	const names = new Set(
		columns.map(function (column) {
			return column.name
		})
	)
	return (
		names.has(config.xColumn) &&
		config.yColumns.length > 0 &&
		config.yColumns.every(function (column) {
			return names.has(column)
		}) &&
		(!config.groupByColumn || names.has(config.groupByColumn))
	)
}

function isNumericLike(value: unknown) {
	return toNumber(value) !== null
}

function isDateLike(value: unknown) {
	if (value instanceof Date) return !Number.isNaN(value.getTime())
	if (typeof value !== 'string') return false
	const parsed = Date.parse(value)
	return !Number.isNaN(parsed) && /[-:TZ]/i.test(value)
}

function toNumber(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) return value
	if (typeof value === 'bigint') return Number(value)
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value)
		if (Number.isFinite(parsed)) return parsed
	}
	return null
}

function formatAxisValue(value: unknown): string {
	if (value === null || value === undefined || value === '') return '(empty)'
	if (value instanceof Date) return value.toISOString()
	return String(value)
}

function axisPointValue(value: unknown): string | number {
	const numeric = toNumber(value)
	if (numeric !== null) return numeric
	return formatAxisValue(value)
}

function aggregateValue(bucket: AggregateBucket, aggregation: ResultChartAggregation) {
	if (aggregation === 'count') return bucket.count
	if (aggregation === 'avg') return bucket.count === 0 ? 0 : bucket.sum / bucket.count
	return bucket.sum
}

function downsamplePoints(points: ResultChartPoint[], maxPoints: number) {
	if (points.length <= maxPoints) return { points, wasDownsampled: false }
	const bucketSize = Math.ceil(points.length / maxPoints)
	const sampled = points.filter(function (_point, index) {
		return index % bucketSize === 0
	})
	return { points: sampled.slice(0, maxPoints), wasDownsampled: true }
}

type AggregateBucket = {
	x: string
	xValue: string | number
	seriesKey: string
	sum: number
	count: number
}
