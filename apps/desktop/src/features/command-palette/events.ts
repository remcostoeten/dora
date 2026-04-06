import type { ContainerActionType } from '@/features/docker-manager/types'

export const SQL_CONSOLE_PALETTE_EVENT = 'dora-sql-console-palette-command'
export const DOCKER_PALETTE_EVENT = 'dora-docker-palette-command'

export type SqlConsolePaletteCommand =
	| { type: 'set-mode'; mode: 'sql' | 'drizzle' }
	| { type: 'toggle-history'; open?: boolean }
	| {
			type: 'load-query'
			query: string
			mode?: 'sql' | 'drizzle'
			execute?: boolean
	  }

export type DockerPaletteCommand =
	| { type: 'open-create' }
	| { type: 'select-container'; containerId: string }
	| { type: 'container-action'; containerId: string; action: ContainerActionType }
	| { type: 'open-in-data-viewer'; containerId: string }
	| { type: 'open-terminal'; containerId: string }

export function dispatchSqlConsolePaletteCommand(detail: SqlConsolePaletteCommand) {
	window.dispatchEvent(new CustomEvent(SQL_CONSOLE_PALETTE_EVENT, { detail }))
}

export function dispatchDockerPaletteCommand(detail: DockerPaletteCommand) {
	window.dispatchEvent(new CustomEvent(DOCKER_PALETTE_EVENT, { detail }))
}
