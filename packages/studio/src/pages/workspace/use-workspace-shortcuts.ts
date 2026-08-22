import { useCallback } from 'react'
import { useIsTauri } from '@studio/core/data-provider'
import { useSettings } from '@studio/core/settings'
import { useEffectiveShortcuts, useShortcut } from '@studio/core/shortcuts'
import {
	openSettingsView,
	readWorkspace,
	setActiveConnection,
	setActiveNav,
	setConnectionDialogOpen,
	toggleCommandPalette,
	toggleDatabasePanel,
	openConnectionDialog,
	useActiveConnectionId,
	useConnectionList,
	useOpenConnectionIds
} from '@studio/core/workspace-store'
import { useAiAssistantStore } from '@studio/features/ai-assistant/store'
import { resetZoom, toggleFullscreen, zoomIn, zoomOut } from '@studio/shared/lib/ui-zoom'
import { commands } from '@studio/lib/bindings'
import type { ConnectionActions } from './use-connection-actions'

type Args = {
	actions: ConnectionActions
}

export function useWorkspaceShortcuts({ actions }: Args) {
	const shortcuts = useEffectiveShortcuts()
	const isTauri = useIsTauri()
	const { settings } = useSettings()
	const connections = useConnectionList()
	const activeConnectionId = useActiveConnectionId()
	const openConnectionIds = useOpenConnectionIds()
	const toggleAiAssistant = useAiAssistantStore(function (s) {
		return s.toggleOpen
	})

	const inputShortcut = useShortcut({ ignoreInputs: false })
	const $ = useShortcut()

	// Cycle through open connection tabs (Ctrl+Shift+[ / Ctrl+Shift+]).
	const cycleConnection = useCallback(
		function (direction: 1 | -1) {
			if (openConnectionIds.length < 2) return
			const currentIndex = openConnectionIds.indexOf(activeConnectionId)
			const baseIndex = currentIndex === -1 ? 0 : currentIndex
			const nextIndex =
				(baseIndex + direction + openConnectionIds.length) % openConnectionIds.length
			setActiveConnection(openConnectionIds[nextIndex])
		},
		[activeConnectionId, openConnectionIds]
	)

	inputShortcut.bind(shortcuts.openCommandPalette.combo).on(toggleCommandPalette, {
		description: shortcuts.openCommandPalette.description
	})

	inputShortcut.bind(shortcuts.newConnection.combo).on(
		function () {
			if (readWorkspace().uiChrome.connectionDialog.open) {
				setConnectionDialogOpen(false)
			} else {
				openConnectionDialog(null)
			}
		},
		{ description: shortcuts.newConnection.description }
	)

	$.bind(shortcuts.toggleSidebar.combo).on(toggleDatabasePanel, {
		description: shortcuts.toggleSidebar.description
	})

	$.bind(shortcuts.toggleAiAssistant.combo).on(
		function () {
			if (settings.hideAi) return
			toggleAiAssistant()
		},
		{ description: shortcuts.toggleAiAssistant.description }
	)

	$.bind(shortcuts.reconnect.combo).on(
		function () {
			if (activeConnectionId) actions.handleConnectionSelect(activeConnectionId)
		},
		{ description: shortcuts.reconnect.description }
	)

	// Go-to chord sequences — except 'typing' so Monaco doesn't intercept
	$.bind(shortcuts.gotoDashboard.combo)
		.except('typing')
		.on(
			function () {
				setActiveNav('database-studio')
			},
			{ description: shortcuts.gotoDashboard.description }
		)

	$.bind(shortcuts.gotoSettings.combo)
		.except('typing')
		.on(
			function () {
				openSettingsView()
			},
			{ description: shortcuts.gotoSettings.description }
		)

	$.bind(shortcuts.openSettings.combo)
		.except('typing')
		.on(
			function () {
				openSettingsView()
			},
			{ description: shortcuts.openSettings.description }
		)

	$.bind(shortcuts.gotoConnections.combo)
		.except('typing')
		.on(
			function () {
				setActiveNav('connections')
			},
			{ description: shortcuts.gotoConnections.description }
		)

	$.bind(shortcuts.gotoEditor.combo)
		.except('typing')
		.on(
			function () {
				setActiveNav('sql-console')
			},
			{ description: shortcuts.gotoEditor.description }
		)

	$.bind(shortcuts.gotoDocker.combo)
		.except('typing')
		.on(
			function () {
				setActiveNav('docker')
			},
			{ description: shortcuts.gotoDocker.description }
		)

	// Cycle through open connection tab groups (issue #96).
	$.bind(shortcuts.prevConnection.combo)
		.except('typing')
		.on(
			function () {
				cycleConnection(-1)
			},
			{ description: shortcuts.prevConnection.description }
		)
	$.bind(shortcuts.nextConnection.combo)
		.except('typing')
		.on(
			function () {
				cycleConnection(1)
			},
			{ description: shortcuts.nextConnection.description }
		)

	// View: zoom + fullscreen. `except('typing')` lets the SQL editor keep
	// mod+enter for "run query" and stops zoom keys firing inside inputs.
	$.bind(shortcuts.zoomIn.combo).on(
		function () {
			zoomIn()
		},
		{ description: shortcuts.zoomIn.description }
	)
	$.bind(shortcuts.zoomOut.combo).on(
		function () {
			zoomOut()
		},
		{ description: shortcuts.zoomOut.description }
	)
	$.bind(shortcuts.zoomReset.combo).on(
		function () {
			resetZoom()
		},
		{ description: shortcuts.zoomReset.description }
	)
	$.bind(shortcuts.toggleFullscreen.combo).on(
		function () {
			toggleFullscreen()
		},
		{ description: shortcuts.toggleFullscreen.description, preventDefault: true }
	)

	$.bind(shortcuts.quitApp.combo).on(
		function () {
			if (isTauri) commands.closeWindow()
		},
		{ description: shortcuts.quitApp.description }
	)

	$.bind(shortcuts.closeTab.combo)
		.except('typing')
		.on(
			function () {
				if (activeConnectionId) actions.handleCloseConnection(activeConnectionId)
			},
			{ description: shortcuts.closeTab.description }
		)

	// Connection switching by index (1-9)
	connections.slice(0, 9).forEach(function (connection, index) {
		const key = `switchConnection${index + 1}` as keyof typeof shortcuts
		const definition = shortcuts[key]
		if (!definition) return
		$.bind(definition.combo).on(
			function () {
				actions.handleConnectionSelect(connection.id)
			},
			{ description: definition.description }
		)
	})
}
