import { useEffect, useRef } from 'react'
import { useIsTauri } from '@studio/core/data-provider'
import { useConnections } from '@studio/core/data-provider/hooks'
import { ENV_MODE, getEnv } from '@studio/core/env'
import { useSettings } from '@studio/core/settings'
import {
	hydrateTabSession,
	openTab,
	readWorkspace,
	setActiveConnection,
	setConnectionDialogDragActive,
	setConnectionDialogDroppedPaths,
	useActiveConnectionId,
	useConnectionList
} from '@studio/core/workspace-store'
import { attachWheelZoom, initZoom } from '@studio/shared/lib/ui-zoom'
import { getTableRefParts } from '@studio/shared/utils/table-ref'
import { requestAutoSelectFirstTable } from './auto-select'

type Args = {
	onFileDrop: (paths: string[]) => void
}

/**
 * Everything the shell does once rather than on every render: restoring the
 * session, picking a startup connection, and the window-level subscriptions.
 * Deliberately subscribes to nothing that changes on a table switch or a view
 * switch; `WorkspaceUrlSync` owns those.
 */
export function useWorkspaceStartup({ onFileDrop }: Args) {
	const isTauri = useIsTauri()
	const { settings, isLoading: isSettingsLoading } = useSettings()
	const { isLoading: isConnectionsLoading, refetch: refetchConnections } = useConnections()
	const connections = useConnectionList()
	const activeConnectionId = useActiveConnectionId()

	const isLoading = isSettingsLoading || isConnectionsLoading

	useEffect(
		function listenForServerSideDisconnects() {
			if (!isTauri) return
			let disposed = false
			let unlisten: (() => void) | undefined

			void import('@tauri-apps/api/event')
				.then(function ({ listen }) {
					return listen<string>('end-of-connection', function () {
						void refetchConnections()
					})
				})
				.then(function (cleanup) {
					if (disposed) cleanup()
					else unlisten = cleanup
				})
				.catch(function (error) {
					console.warn('Failed to listen for connection status changes:', error)
				})

			return function cleanup() {
				disposed = true
				unlisten?.()
			}
		},
		[isTauri, refetchConnections]
	)

	// Restore tabs persisted from the last session (issue #98). Tabs render
	// synchronously from storage on first paint; this one-shot effect prunes them
	// once we know the user's preference and which connections still exist:
	// unpinned tabs are dropped when "restore on launch" is off, and any tab whose
	// connection no longer exists is dropped. Pinned tabs always restore.
	const sessionHydratedRef = useRef(false)
	useEffect(
		function hydrateTabSessionOnce() {
			if (sessionHydratedRef.current) return
			if (isSettingsLoading || isConnectionsLoading) return
			sessionHydratedRef.current = true
			hydrateTabSession({
				restoreUnpinned: settings.restoreTabsOnLaunch,
				knownConnectionIds: new Set(
					connections.map(function (connection) {
						return connection.id
					})
				)
			})
		},
		[isSettingsLoading, isConnectionsLoading, settings.restoreTabsOnLaunch, connections]
	)

	const connectionInitializedRef = useRef(false)
	const urlConnection = useRef(
		new URLSearchParams(window.location.search).get('connection')
	).current
	const startupConnectionMode =
		settings.startupConnectionMode ?? (settings.restoreLastConnection ? 'auto' : 'empty')

	useEffect(
		function initializeConnection() {
			if (isSettingsLoading || isConnectionsLoading) return
			if (connections.length === 0) return
			if (connectionInitializedRef.current) return

			function selectStartupConnection(connectionId: string) {
				setActiveConnection(connectionId)
				requestAutoSelectFirstTable()
				connectionInitializedRef.current = true
			}

			if (urlConnection) {
				selectStartupConnection(urlConnection)
				return
			}

			if (activeConnectionId || startupConnectionMode === 'empty') {
				connectionInitializedRef.current = true
				return
			}

			if (settings.lastConnectionId) {
				const lastConnection = connections.find(function (connection) {
					return connection.id === settings.lastConnectionId
				})
				if (lastConnection) {
					setActiveConnection(lastConnection.id)
					if (settings.lastTableId) {
						const { tableName } = getTableRefParts(settings.lastTableId)
						openTab({
							connectionId: lastConnection.id,
							tableId: settings.lastTableId,
							tableName,
							label: tableName
						})
					}
					requestAutoSelectFirstTable()
					connectionInitializedRef.current = true
					return
				}
			}

			const isTauriRuntime =
				window.location.protocol === 'tauri:' ||
				'__TAURI__' in window ||
				'__TAURI_INTERNALS__' in window
			const isWebDemo =
				!isTauriRuntime &&
				(ENV_MODE === 'demo' ||
					window.location.hostname.includes('demo') ||
					getEnv('VITE_IS_WEB') === 'true')

			if (isWebDemo) {
				const demoConnection =
					connections.find(function (connection) {
						return connection.id === 'demo-ecommerce-001'
					}) || connections[0]
				if (demoConnection) {
					selectStartupConnection(demoConnection.id)
					return
				}
			}

			const firstConnection = connections[0]
			if (firstConnection) selectStartupConnection(firstConnection.id)
		},
		[
			isSettingsLoading,
			isConnectionsLoading,
			connections,
			urlConnection,
			activeConnectionId,
			startupConnectionMode,
			settings.lastConnectionId,
			settings.lastTableId
		]
	)

	useEffect(function applyPersistedZoom() {
		initZoom()
		return attachWheelZoom()
	}, [])

	// Keep the latest handler reachable from the drag-drop listener, which is
	// subscribed once (per Tauri availability) and would otherwise close over a
	// stale mutation reference.
	const dropHandlerRef = useRef(onFileDrop)
	dropHandlerRef.current = onFileDrop

	useEffect(
		function subscribeToFileDrop() {
			if (!isTauri) return
			let unlisten: (() => void) | undefined
			let cancelled = false

			import('@tauri-apps/api/webview')
				.then(function ({ getCurrentWebview }) {
					return getCurrentWebview().onDragDropEvent(function (event) {
						const dialogOpen = readWorkspace().uiChrome.connectionDialog.open
						if (event.payload.type === 'over') {
							if (dialogOpen) setConnectionDialogDragActive(true)
							return
						}
						if (event.payload.type === 'leave') {
							setConnectionDialogDragActive(false)
							return
						}
						if (event.payload.type === 'drop') {
							setConnectionDialogDragActive(false)
							const paths = event.payload.paths ?? []
							if (dialogOpen) {
								setConnectionDialogDroppedPaths(paths)
								return
							}
							dropHandlerRef.current(paths)
						}
					})
				})
				.then(function (fn) {
					if (cancelled) fn()
					else unlisten = fn
				})
				.catch(function () {
					/* drag-drop is a desktop-only nicety; ignore when unavailable */
				})

			return function () {
				cancelled = true
				unlisten?.()
			}
		},
		[isTauri]
	)

	return { isLoading, isTauri }
}
