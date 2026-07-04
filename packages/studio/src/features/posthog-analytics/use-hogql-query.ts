import { useCallback, useEffect, useRef, useState } from 'react'
import { useAdapter } from '@studio/core/data-provider/context'
import { getAdapterError } from '@studio/core/data-provider/types'

type HogqlQueryState = {
	rows: Record<string, unknown>[]
	columns: string[]
	isLoading: boolean
	error: string | null
}

/**
 * Runs a single HogQL statement against the active connection and tracks its
 * loading/error state. Re-runs when `connectionId`, `query`, or `refreshKey`
 * change, and ignores results from a superseded run so fast dashboard switches
 * never render stale rows.
 */
export function useHogqlQuery(
	connectionId: string | undefined,
	query: string,
	refreshKey: number
): HogqlQueryState {
	const adapter = useAdapter()
	const [state, setState] = useState<HogqlQueryState>({
		rows: [],
		columns: [],
		isLoading: Boolean(connectionId),
		error: null
	})
	const runIdRef = useRef(0)

	const run = useCallback(
		function run() {
			if (!connectionId) {
				setState({ rows: [], columns: [], isLoading: false, error: null })
				return
			}

			const runId = ++runIdRef.current
			setState(function (prev) {
				return { ...prev, isLoading: true, error: null }
			})

			adapter
				.executeQuery(connectionId, query)
				.then(function (result) {
					if (runId !== runIdRef.current) return
					if (result.ok) {
						setState({
							rows: result.data.rows,
							columns: result.data.columns,
							isLoading: false,
							error: null
						})
					} else {
						setState({
							rows: [],
							columns: [],
							isLoading: false,
							error: getAdapterError(result)
						})
					}
				})
				.catch(function (error) {
					if (runId !== runIdRef.current) return
					setState({
						rows: [],
						columns: [],
						isLoading: false,
						error: error instanceof Error ? error.message : 'Query failed'
					})
				})
		},
		[adapter, connectionId, query]
	)

	useEffect(
		function () {
			run()
		},
		[run, refreshKey]
	)

	return state
}
