import { useCallback, useEffect, useRef, useState } from 'react'
import type { CloudflareD1Database } from '@studio/lib/bindings'
import { formatBackendError } from '@studio/shared/utils/backend-error'
import { listCloudflareDatabases } from './cloudflare-api'

// Loads the D1 databases for one Cloudflare account. `accountId` is null until
// the user picks an account in the first step; the hook stays idle until then.
export function useCloudflareDatabases(accountId: string | null) {
	const [databases, setDatabases] = useState<CloudflareD1Database[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const requestIdRef = useRef(0)

	const refresh = useCallback(
		async function refresh() {
			const requestId = ++requestIdRef.current
			if (!accountId) {
				setIsLoading(false)
				return
			}
			setIsLoading(true)
			setError(null)
			try {
				const resolved = await listCloudflareDatabases(accountId)
				if (requestId === requestIdRef.current) setDatabases(resolved)
			} catch (error) {
				if (requestId === requestIdRef.current) setError(formatBackendError(error))
			} finally {
				if (requestId === requestIdRef.current) setIsLoading(false)
			}
		},
		[accountId]
	)

	useEffect(
		function loadDatabases() {
			setDatabases([])
			setError(null)
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
