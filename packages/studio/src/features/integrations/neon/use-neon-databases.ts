import { useCallback, useEffect, useState } from 'react'
import type { NeonDatabase } from '@studio/lib/bindings'
import { formatBackendError } from '@studio/shared/utils/backend-error'
import { listNeonDatabases } from './neon-api'

export function useNeonDatabases(enabled: boolean) {
	const [databases, setDatabases] = useState<NeonDatabase[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const refresh = useCallback(
		async function refresh() {
			if (!enabled) return
			setIsLoading(true)
			setError(null)
			try {
				setDatabases(await listNeonDatabases())
			} catch (error) {
				setError(formatBackendError(error))
			} finally {
				setIsLoading(false)
			}
		},
		[enabled]
	)

	useEffect(
		function loadDatabases() {
			void refresh()
		},
		[refresh]
	)

	const reset = useCallback(function reset() {
		setDatabases([])
		setError(null)
	}, [])

	return { databases, isLoading, error, refresh, reset }
}
