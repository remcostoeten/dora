import type { SettingsSectionId } from '@studio/features/sidebar/components/settings-panel'
import type { UiChromeSlice } from '../types'

export type UiChromeAction =
	| { type: 'uiChrome/setActiveNav'; navId: string }
	| { type: 'uiChrome/setDatabasePanelOpen'; open: boolean }
	| { type: 'uiChrome/toggleDatabasePanel' }
	| { type: 'uiChrome/openConnectionDialog'; editingConnectionId?: string | null }
	| { type: 'uiChrome/setConnectionDialogOpen'; open: boolean }
	| { type: 'uiChrome/setConnectionDialogDroppedPaths'; paths: string[] | null }
	| { type: 'uiChrome/setConnectionDialogDragActive'; active: boolean }
	| { type: 'uiChrome/setCommandPaletteOpen'; open: boolean }
	| { type: 'uiChrome/toggleCommandPalette' }
	| {
			type: 'uiChrome/openSettings'
			section?: SettingsSectionId | null
			highlight?: SettingsSectionId | null
	  }

export const initialUiChromeSlice: UiChromeSlice = {
	activeNavId: 'database-studio',
	isDatabasePanelOpen: true,
	connectionDialog: {
		open: false,
		everOpened: false,
		editingConnectionId: null,
		droppedPaths: null,
		dragActive: false
	},
	commandPalette: {
		open: false,
		everOpened: false
	},
	settingsView: {
		initialSection: null,
		highlightSection: null
	}
}

export function reduceUiChrome(state: UiChromeSlice, action: UiChromeAction): UiChromeSlice {
	switch (action.type) {
		case 'uiChrome/setActiveNav': {
			if (state.activeNavId === action.navId) return state
			return { ...state, activeNavId: action.navId }
		}
		case 'uiChrome/setDatabasePanelOpen': {
			if (state.isDatabasePanelOpen === action.open) return state
			return { ...state, isDatabasePanelOpen: action.open }
		}
		case 'uiChrome/toggleDatabasePanel': {
			return { ...state, isDatabasePanelOpen: !state.isDatabasePanelOpen }
		}
		case 'uiChrome/openConnectionDialog': {
			return {
				...state,
				connectionDialog: {
					...state.connectionDialog,
					open: true,
					everOpened: true,
					editingConnectionId: action.editingConnectionId ?? null
				}
			}
		}
		case 'uiChrome/setConnectionDialogOpen': {
			if (state.connectionDialog.open === action.open) return state
			if (action.open) {
				return {
					...state,
					connectionDialog: { ...state.connectionDialog, open: true, everOpened: true }
				}
			}
			// Closing also clears the drop state the dialog was carrying, so the
			// next open starts clean.
			return {
				...state,
				connectionDialog: {
					...state.connectionDialog,
					open: false,
					editingConnectionId: null,
					droppedPaths: null,
					dragActive: false
				}
			}
		}
		case 'uiChrome/setConnectionDialogDroppedPaths': {
			if (state.connectionDialog.droppedPaths === action.paths) return state
			return {
				...state,
				connectionDialog: { ...state.connectionDialog, droppedPaths: action.paths }
			}
		}
		case 'uiChrome/setConnectionDialogDragActive': {
			if (state.connectionDialog.dragActive === action.active) return state
			return {
				...state,
				connectionDialog: { ...state.connectionDialog, dragActive: action.active }
			}
		}
		case 'uiChrome/setCommandPaletteOpen': {
			if (state.commandPalette.open === action.open) return state
			return {
				...state,
				commandPalette: {
					open: action.open,
					everOpened: state.commandPalette.everOpened || action.open
				}
			}
		}
		case 'uiChrome/toggleCommandPalette': {
			const open = !state.commandPalette.open
			return {
				...state,
				commandPalette: { open, everOpened: state.commandPalette.everOpened || open }
			}
		}
		case 'uiChrome/openSettings': {
			return {
				...state,
				activeNavId: 'settings',
				settingsView: {
					initialSection: action.section ?? null,
					highlightSection: action.highlight ?? null
				}
			}
		}
		default:
			return state
	}
}
