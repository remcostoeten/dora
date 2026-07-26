/**
 * Pure state + dispatch logic for the Drizzle ↔ SQL converter surface (#162).
 * Kept free of React and of any timer so it can be unit tested directly; the
 * hook (`use-converter`) owns the debounce and the converter wiring.
 */

import type {
	ConvertResult,
	Dialect,
	DrizzleToSql,
	SqlToDrizzle
} from '@studio/features/orm-cockpit/converters/contract'

export type ConverterDirection = 'drizzle-to-sql' | 'sql-to-drizzle'

export type ConverterPair = {
	drizzleToSql: DrizzleToSql
	sqlToDrizzle: SqlToDrizzle
}

export type ConverterState = {
	direction: ConverterDirection
	dialect: Dialect
	input: string
	result: ConvertResult | null
	warningsDismissed: boolean
}

export type ConverterAction =
	| { type: 'set-input'; input: string }
	| { type: 'set-dialect'; dialect: Dialect }
	| { type: 'set-direction'; direction: ConverterDirection }
	| { type: 'swap' }
	| { type: 'converted'; result: ConvertResult }
	| { type: 'clear-result' }
	| { type: 'dismiss-warnings' }

/** The slice of state a conversion actually depends on. */
export type ConversionRequest = Pick<ConverterState, 'input' | 'dialect' | 'direction'>

export const CONVERTER_DIALECTS: Dialect[] = ['postgres', 'mysql', 'sqlite']

export function createConverterState(dialect: Dialect = 'postgres'): ConverterState {
	return {
		direction: 'drizzle-to-sql',
		dialect,
		input: '',
		result: null,
		warningsDismissed: false
	}
}

export function flipDirection(direction: ConverterDirection): ConverterDirection {
	return direction === 'drizzle-to-sql' ? 'sql-to-drizzle' : 'drizzle-to-sql'
}

/** The Monaco language id for each pane, given the current direction. */
export function paneLanguages(direction: ConverterDirection): { input: string; output: string } {
	return direction === 'drizzle-to-sql'
		? { input: 'typescript', output: 'sql' }
		: { input: 'sql', output: 'typescript' }
}

export function outputText(result: ConvertResult | null): string {
	return result && result.ok ? result.output : ''
}

export function visibleWarnings(state: ConverterState): string[] {
	if (state.warningsDismissed || !state.result || !state.result.ok) {
		return []
	}
	return state.result.warnings
}

export function converterReducer(state: ConverterState, action: ConverterAction): ConverterState {
	switch (action.type) {
		case 'set-input':
			if (action.input === state.input) {
				return state
			}
			return { ...state, input: action.input, warningsDismissed: false }
		case 'set-dialect':
			if (action.dialect === state.dialect) {
				return state
			}
			return { ...state, dialect: action.dialect, warningsDismissed: false }
		case 'set-direction':
			if (action.direction === state.direction) {
				return state
			}
			return {
				...state,
				direction: action.direction,
				result: null,
				warningsDismissed: false
			}
		case 'swap': {
			const carried = outputText(state.result)
			return {
				...state,
				direction: flipDirection(state.direction),
				input: carried === '' ? state.input : carried,
				result: null,
				warningsDismissed: false
			}
		}
		case 'converted':
			return { ...state, result: action.result, warningsDismissed: false }
		case 'clear-result':
			if (state.result === null) {
				return state
			}
			return { ...state, result: null, warningsDismissed: false }
		case 'dismiss-warnings':
			return { ...state, warningsDismissed: true }
	}
}

/** Runs the conversion for a request. No timers, no side effects. */
export function runConversion(
	request: ConversionRequest,
	converters: ConverterPair
): ConvertResult {
	const options = { dialect: request.dialect }
	return request.direction === 'drizzle-to-sql'
		? converters.drizzleToSql(request.input, options)
		: converters.sqlToDrizzle(request.input, options)
}
