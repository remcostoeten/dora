import { useEffect } from 'react'
import { useSettings } from '@studio/core/settings'
import { writeUrlParams } from '@studio/core/url-state/url-params'
import {
	useActiveConnectionId,
	useActiveNavId,
	useActiveTableId
} from '@studio/core/workspace-store'

type Props = {
	isLoading: boolean
}

/**
 * Keeps the URL, the persisted "last table", and the capture-ready marker in
 * step with navigation. Renders nothing and subscribes to the active table, the
 * nav id and the connection on its own. The URL is written through
 * `writeUrlParams`, not React Router, so a table or view switch re-renders this
 * leaf and nothing below the router.
 */
export function WorkspaceUrlSync({ isLoading }: Props) {
	const { persistSetting, isLoading: isSettingsLoading } = useSettings()
	const activeConnectionId = useActiveConnectionId()
	const activeNavId = useActiveNavId()
	const selectedTableId = useActiveTableId() ?? ''

	useEffect(
		function syncUrlParams() {
			const patch: Record<string, string | null> = { table: selectedTableId || null }
			if (activeNavId) patch.view = activeNavId
			if (activeConnectionId) patch.connection = activeConnectionId
			writeUrlParams(patch)
		},
		[activeNavId, selectedTableId, activeConnectionId]
	)

	useEffect(
		function saveLastConnection() {
			if (!activeConnectionId || isSettingsLoading) return
			persistSetting('lastConnectionId', activeConnectionId)
			if (selectedTableId) persistSetting('lastTableId', selectedTableId)
		},
		[activeConnectionId, selectedTableId, isSettingsLoading, persistSetting]
	)

	useEffect(
		function syncCaptureReady() {
			const params = new URLSearchParams(window.location.search)
			if (params.get('capture') !== '1') return

			window.__DORA_CAPTURE_MODE = true

			if (isLoading) {
				document.documentElement.removeAttribute('data-dora-capture-ready')
				return
			}

			const timer = window.setTimeout(function () {
				document.documentElement.dataset.doraCaptureReady = 'true'
				window.__DORA_CAPTURE_READY_AT = performance.now()
			}, 500)

			return function () {
				window.clearTimeout(timer)
				document.documentElement.removeAttribute('data-dora-capture-ready')
			}
		},
		[isLoading, activeNavId]
	)

	return null
}
