import { ENV_DEV } from '@studio/core/env'
import type { ConnectionSourceInput } from './resolve-source'
import { describeConnectionSource, resolvePresetToEngine } from './resolve-source'
import { getSourceCaps, type SourceCaps } from './source-caps'
import type { DbEngine, DbPreset, SourceKind, SourceMeta } from './source-kinds'
import { getVisibleUiActions, type StudioUiAction } from './ui-actions'

export type SourceDebugInfo = {
	kind: SourceKind
	engine: DbEngine
	preset: DbPreset
	wireFamily: DbEngine
	isReadonly: boolean
	visibleUiActions: StudioUiAction[]
	meta: SourceMeta
	caps: SourceCaps
}

export function resolveSourceDebugInfo(connection: ConnectionSourceInput): SourceDebugInfo {
	const meta = describeConnectionSource(connection)
	const caps = getSourceCaps(connection, meta)

	return {
		kind: meta.kind,
		engine: meta.engine,
		preset: meta.preset,
		wireFamily: resolvePresetToEngine(meta.preset),
		isReadonly: caps.isReadonly,
		visibleUiActions: getVisibleUiActions(caps),
		meta,
		caps
	}
}

/** Logs resolved source metadata in development builds. Returns the same payload either way. */
export function logSourceDebugInfo(
	connection: ConnectionSourceInput,
	label?: string
): SourceDebugInfo {
	const info = resolveSourceDebugInfo(connection)

	if (ENV_DEV) {
		console.group(label ?? `Source debug · ${info.engine}`)
		console.table({
			kind: info.kind,
			engine: info.engine,
			preset: info.preset,
			wireFamily: info.wireFamily,
			isReadonly: info.isReadonly
		})
		console.log('visible UI actions:', info.visibleUiActions)
		console.log('caps:', info.caps)
		console.groupEnd()
	}

	return info
}
