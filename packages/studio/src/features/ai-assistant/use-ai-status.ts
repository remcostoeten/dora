import { useCallback, useEffect, useState } from 'react'
import { useIsTauri } from '@studio/core/data-provider'
import { commands, type AiStatus } from '@studio/lib/bindings'
import { buildMockAiStatus } from './mock-ai'

type UseAiStatusResult = {
	status: AiStatus | null
	loading: boolean
	refresh: () => Promise<void>
	isMock: boolean
}

export function useAiStatus(enabled = true): UseAiStatusResult {
	const isTauri = useIsTauri()
	const isMock = !isTauri
	const [status, setStatus] = useState<AiStatus | null>(null)
	const [loading, setLoading] = useState(false)

	const refresh = useCallback(async function refresh() {
		if (!enabled) return

		if (isMock) {
			setStatus(buildMockAiStatus())
			return
		}

		setLoading(true)
		try {
			const result = await commands.aiGetStatus()
			if (result.status === 'ok') {
				setStatus(result.data)
			}
		} finally {
			setLoading(false)
		}
	}, [enabled, isMock])

	useEffect(
		function loadStatus() {
			void refresh()
		},
		[refresh]
	)

	return { status, loading, refresh, isMock }
}

export function getActiveProviderReadiness(status: AiStatus | null) {
	if (!status) return null
	return (
		status.providers.find(function (entry) {
			return entry.provider === status.active_provider
		}) ?? null
	)
}

export function formatAiStatusBadge(status: AiStatus | null, isMock: boolean): string {
	if (!status) return '…'
	if (isMock) return 'mock'

	const active = getActiveProviderReadiness(status)
	if (status.ready) {
		if (active?.key_count != null && active.key_count > 0) {
			return `${active.key_count} key${active.key_count === 1 ? '' : 's'}`
		}
		return status.active_provider
	}

	return 'not ready'
}
