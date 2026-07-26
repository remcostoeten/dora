/**
 * Drives the Drizzle ↔ SQL converter surface: owns the reducer state, debounces
 * input, and dispatches into the converter pair. All decision logic lives in
 * `converter-state`; this hook only adds React and the 300ms debounce.
 */

import { useEffect, useMemo, useReducer } from 'react'
import { convertDrizzleToSql } from '@studio/features/orm-cockpit/converters/drizzle-to-sql'
import { convertSqlToDrizzle } from '@studio/features/orm-cockpit/converters/sql-to-drizzle'
import type { Dialect } from '@studio/features/orm-cockpit/converters/contract'
import {
	converterReducer,
	createConverterState,
	outputText,
	paneLanguages,
	runConversion,
	visibleWarnings,
	type ConverterDirection,
	type ConverterPair,
	type ConverterState
} from '@studio/features/orm-cockpit/components/converter-state'

const CONVERTERS: ConverterPair = {
	drizzleToSql: convertDrizzleToSql,
	sqlToDrizzle: convertSqlToDrizzle
}

const DEBOUNCE_MS = 300

export type UseConverter = {
	state: ConverterState
	output: string
	warnings: string[]
	languages: { input: string; output: string }
	setInput: (input: string) => void
	setDialect: (dialect: Dialect) => void
	setDirection: (direction: ConverterDirection) => void
	swap: () => void
	dismissWarnings: () => void
}

export function useConverter(): UseConverter {
	const [state, dispatch] = useReducer(converterReducer, undefined, () => createConverterState())

	const { input, dialect, direction } = state

	useEffect(() => {
		if (input.trim().length === 0) {
			dispatch({ type: 'clear-result' })
			return
		}
		const timer = window.setTimeout(() => {
			dispatch({
				type: 'converted',
				result: runConversion({ input, dialect, direction }, CONVERTERS)
			})
		}, DEBOUNCE_MS)
		return () => {
			window.clearTimeout(timer)
		}
	}, [input, dialect, direction])

	return useMemo(() => {
		return {
			state,
			output: outputText(state.result),
			warnings: visibleWarnings(state),
			languages: paneLanguages(state.direction),
			setInput: (input: string) => dispatch({ type: 'set-input', input }),
			setDialect: (dialect: Dialect) => dispatch({ type: 'set-dialect', dialect }),
			setDirection: (direction: ConverterDirection) =>
				dispatch({ type: 'set-direction', direction }),
			swap: () => dispatch({ type: 'swap' }),
			dismissWarnings: () => dispatch({ type: 'dismiss-warnings' })
		}
	}, [state])
}
