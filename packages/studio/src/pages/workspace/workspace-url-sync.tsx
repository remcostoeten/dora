import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSettings } from '@studio/core/settings'
import { useActiveConnectionId, useActiveNavId, useActiveTab } from '@studio/core/workspace-store'

type Props = {
	isLoading: boolean
}

/**
 * Keeps the URL, the persisted "last table", and the capture-ready marker in
 * step with navigation. Renders nothing and subscribes to the active tab, the
 * nav id and the router on its own, so that a table switch or a location change
 * re-renders this leaf instead of the whole shell.
 */
export function WorkspaceUrlSync({ isLoading }: Props) {
	const [searchParams, setSearchParams] = useSearchParams()
	const { persistSetting, isLoading: isSettingsLoading } = useSettings()
	const activeConnectionId = useActiveConnectionId()
	const activeNavId = useActiveNavId()
	const activeTab = useActiveTab()
	const selectedTableId = activeTab?.tableId ?? ''

	const isUpdatingUrlRef = useRef(false)
	useEffect(
		function syncUrlParams() {
			if (isUpdatingUrlRef.current) return

			const viewChanged = activeNavId && searchParams.get('view') !== activeNavId
			const tableChanged = selectedTableId && searchParams.get('table') !== selectedTableId
			const connectionChanged =
				activeConnectionId && searchParams.get('connection') !== activeConnectionId

			if (!viewChanged && !tableChanged && !connectionChanged) return

			const params = new URLSearchParams()
			if (activeNavId) params.set('view', activeNavId)
			if (selectedTableId) params.set('table', selectedTableId)
			if (activeConnectionId) params.set('connection', activeConnectionId)

			isUpdatingUrlRef.current = true
			setSearchParams(params, { replace: true })
			requestAnimationFrame(function () {
				isUpdatingUrlRef.current = false
			})
		},
		[activeNavId, selectedTableId, activeConnectionId, searchParams, setSearchParams]
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
