/**
 * Orchestration hook for the ORM cockpit (Wave D, plan 07). Ties the Wave A–C
 * pieces together — link → parse → introspect → diff → generate — and exposes a
 * small phase-driven state machine the panel renders against.
 *
 * Direction matters: the LIVE database is the `from` side and the project's
 * code schema is the `to` side, so "added in code" reads as "needs creating in
 * the DB". The generated migration is preview-only (plan 06) — this hook never
 * applies anything.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAdapter, useConnections } from '@studio/core/data-provider'
import { isDesktopOnlyError } from '@studio/core/platform'
import { commands } from '@studio/lib/bindings'
import type { DatabaseType } from '@studio/features/connections/types'
import type { Dialect, SchemaIR } from '@studio/features/orm-cockpit/ir/types'
import { fromLiveSchema } from '@studio/features/orm-cockpit/ir/from-live-schema'
import {
	linkProject,
	detectProjectOrm,
	resolveProjectDatabaseTarget,
} from '@studio/features/orm-cockpit/link/link-api'
import { isWebDemo, DEMO_PROJECT_FOLDER } from '@studio/features/orm-cockpit/link/demo-project'
import type {
	DetectedOrm,
	DetectOrmResult,
	OrmLink,
} from '@studio/features/orm-cockpit/link/detect-orm'
import {
	targetFromConnection,
	compareTargets,
	describeTarget,
} from '@studio/features/orm-cockpit/link/connection-target'
import type { Connection } from '@studio/features/connections/types'
import { parseDrizzleSchema } from '@studio/features/orm-cockpit/parsers/drizzle/parse-drizzle-schema'
import { parsePrismaSchema } from '@studio/features/orm-cockpit/parsers/prisma/parse-prisma-schema'
import { diffSchema } from '@studio/features/orm-cockpit/diff/diff-schema'
import {
	filterManagedTables,
	countManagedTables,
} from '@studio/features/orm-cockpit/diff/filter-managed-tables'
import type { SchemaDiff } from '@studio/features/orm-cockpit/diff/types'
import {
	generateMigrationSql,
	type MigrationResult,
} from '@studio/features/orm-cockpit/migration/generate-sql'

/** Map the connection's engine onto the small IR dialect set. */
export function deriveDialect(type: DatabaseType | undefined): Dialect {
	if (type === 'mysql' || type === 'mariadb') return 'mysql'
	if (type === 'sqlite' || type === 'libsql' || type === 'duckdb') return 'sqlite'
	return 'postgres'
}

/** A note surfaced in the collapsible "notes" area, tagged by its source phase. */
export type CockpitNote = { source: 'parse' | 'diff' | 'generate'; message: string }

/**
 * Surfaced when the linked project's intended database doesn't resolve to the
 * connection being diffed against — the diff is then comparing two unrelated
 * databases. Informational only (warn-and-proceed); null when they agree or
 * can't be resolved.
 */
export type ConnectionMismatch = {
	projectLabel: string
	connectionLabel: string
}

export type CockpitPhase =
	| 'idle' // no folder linked yet
	| 'linking' // folder picker open / detecting ORM
	| 'choice' // both Drizzle and Prisma detected — user must pick
	| 'analyzing' // parsing + introspecting + diffing
	| 'ready' // diff computed
	| 'error'

type LinkedState = {
	folder: string
	orm: DetectedOrm
	link: OrmLink
}

export type OrmCockpitState = {
	phase: CockpitPhase
	error: string | null
	linked: LinkedState | null
	/** Both options when detection is ambiguous (`choice`). */
	choices: OrmLink[] | null
	choiceFolder: string | null
	codeIr: SchemaIR | null
	liveIr: SchemaIR | null
	diff: SchemaDiff | null
	notes: CockpitNote[]
	dialect: Dialect
	/** A connection must be selected before we can introspect the live DB. */
	hasConnection: boolean
	/** The connection currently being diffed against (defaults to the active one). */
	compareConnectionId: string | undefined
	/** Set when the linked project points at a different database than the comparison. */
	connectionMismatch: ConnectionMismatch | null
}

const SETTING_PREFIX = 'orm-cockpit:last-folder:'

export type UseOrmCockpit = OrmCockpitState & {
	/** Open the folder picker and analyze whatever ORM is found. */
	link: () => Promise<void>
	/** Re-run analysis against the already-linked folder (Refresh). */
	rescan: () => Promise<void>
	/** Resolve a `choice` by committing to one detected ORM. */
	chooseOrm: (link: OrmLink) => Promise<void>
	/** Generate migration SQL from the current diff on demand. */
	generate: () => MigrationResult | null
	reset: () => void
	/** Whether managed/system tables are included in the diff. */
	showExternal: boolean
	/** Toggle managed/system tables in the diff (re-diffs from cached IRs). */
	setShowExternal: (show: boolean) => void
	/** How many managed/system tables are currently hidden (0 when shown). */
	hiddenCount: number
	/** Choose which connection the linked project is diffed against. */
	setCompareConnection: (connectionId: string) => void
}

/**
 * @param connectionId the active DB connection — drives both introspection and
 *   the per-connection persistence of the last-linked folder.
 */
export function useOrmCockpit(connectionId: string | undefined): UseOrmCockpit {
	const adapter = useAdapter()
	const { data: connections } = useConnections()

	// The connection the project is diffed against. Defaults to the active one
	// but can be pointed at any connection so the cockpit isn't locked to
	// whatever happens to be selected in the rest of the app.
	const [compareConnectionId, setCompareConnectionId] = useState(connectionId)
	useEffect(
		function () {
			setCompareConnectionId(connectionId)
		},
		[connectionId],
	)

	const compareConnection = useMemo(
		function (): Connection | undefined {
			return connections?.find(function (c) {
				return c.id === compareConnectionId
			})
		},
		[connections, compareConnectionId],
	)

	const dialect = useMemo(
		function () {
			return deriveDialect(compareConnection?.type)
		},
		[compareConnection],
	)

	const [state, setState] = useState<OrmCockpitState>(function () {
		return {
			phase: 'idle',
			error: null,
			linked: null,
			choices: null,
			choiceFolder: null,
			codeIr: null,
			liveIr: null,
			diff: null,
			notes: [],
			dialect,
			hasConnection: Boolean(connectionId),
			compareConnectionId: connectionId,
			connectionMismatch: null,
		}
	})

	// Whether to include managed/system tables (migration bookkeeping, Supabase
	// `auth`/`storage`, …) in the diff. Hidden by default — they're never in the
	// code schema and would otherwise read as destructive drops.
	const [showExternal, setShowExternal] = useState(false)

	// Guards against a stale async chain (e.g. user re-links mid-analysis)
	// committing its result over a newer one.
	const runIdRef = useRef(0)

	useEffect(
		function () {
			setState(function (prev) {
				return {
					...prev,
					dialect,
					hasConnection: Boolean(compareConnectionId),
					compareConnectionId,
				}
			})
		},
		[dialect, compareConnectionId],
	)

	/** Introspect the live DB → IR. Returns null and reports via notes on failure. */
	const introspectLive = useCallback(
		async function (): Promise<SchemaIR | null> {
			if (!compareConnectionId) return null
			const result = await adapter.getSchema(compareConnectionId)
			if (!result.ok || !result.data) return null
			return fromLiveSchema(result.data, dialect)
		},
		[adapter, compareConnectionId, dialect],
	)

	/** Parse a linked project's schema files into a code-side IR. */
	const parseLink = useCallback(
		function (link: OrmLink): { ir: SchemaIR; warnings: string[] } {
			if (link.orm === 'drizzle') {
				return parseDrizzleSchema(link.schemaFiles, dialect)
			}
			// Prisma is single-text; concatenate multi-file schemas. It derives its
			// own dialect from the datasource block.
			const text = link.schemaFiles.map((f) => f.text).join('\n\n')
			return parsePrismaSchema(text)
		},
		[dialect],
	)

	/**
	 * Resolve whether the linked project actually points at the connection we're
	 * diffing against. Best-effort — returns null (no warning) unless there's a
	 * strong mismatch signal (different database name / file).
	 */
	const computeMismatch = useCallback(
		async function (link: OrmLink): Promise<ConnectionMismatch | null> {
			if (!compareConnection) return null
			const connectionTarget = targetFromConnection(compareConnection)
			const projectTarget = await resolveProjectDatabaseTarget(
				link.rootDir,
				link.configPath,
				link.orm,
				link.schemaFiles.map((f) => f.text),
			)
			if (compareTargets(projectTarget, connectionTarget) !== 'mismatch') {
				return null
			}
			return {
				projectLabel: projectTarget ? describeTarget(projectTarget) : 'a different database',
				connectionLabel: connectionTarget
					? describeTarget(connectionTarget)
					: (compareConnection.name ?? 'the connected database'),
			}
		},
		[compareConnection],
	)

	/** The full analyze chain: parse code → introspect live → diff. */
	const analyze = useCallback(
		async function (folder: string, link: OrmLink, runId: number) {
			const parsed = parseLink(link)
			const [liveIr, mismatch] = await Promise.all([introspectLive(), computeMismatch(link)])

			if (runId !== runIdRef.current) return

			if (!liveIr) {
				setState(function (prev) {
					return {
						...prev,
						phase: 'error',
						error: compareConnectionId
							? 'Could not read the live database schema. Make sure the connection is reachable, then Refresh.'
							: 'Select a database connection to compare against.',
						linked: { folder, orm: link.orm, link },
						choices: null,
						choiceFolder: null,
						connectionMismatch: mismatch,
					}
				})
				return
			}

			const diff = diffSchema(liveIr, parsed.ir)
			const notes: CockpitNote[] = [
				...parsed.warnings.map(function (m): CockpitNote {
					return { source: 'parse', message: m }
				}),
			]

			setState(function (prev) {
				return {
					...prev,
					phase: 'ready',
					error: null,
					linked: { folder, orm: link.orm, link },
					choices: null,
					choiceFolder: null,
					codeIr: parsed.ir,
					liveIr,
					diff,
					notes,
					connectionMismatch: mismatch,
				}
			})

			// Persist the linked folder for this connection (best-effort).
			if (connectionId) {
				void commands.setSetting(SETTING_PREFIX + connectionId, folder).catch(function () {})
			}
		},
		[parseLink, introspectLive, computeMismatch, connectionId, compareConnectionId],
	)

	const startFromDetect = useCallback(
		async function (folder: string, result: DetectOrmResult, runId: number) {
			if (result.kind === 'none') {
				setState(function (prev) {
					return { ...prev, phase: 'error', error: result.message }
				})
				return
			}
			if (result.kind === 'choice') {
				setState(function (prev) {
					return {
						...prev,
						phase: 'choice',
						error: null,
						choices: result.options,
						choiceFolder: folder,
					}
				})
				return
			}
			setState(function (prev) {
				return { ...prev, phase: 'analyzing', error: null }
			})
			await analyze(folder, result.link, runId)
		},
		[analyze],
	)

	const link = useCallback(
		async function () {
			const runId = ++runIdRef.current
			setState(function (prev) {
				return { ...prev, phase: 'linking', error: null }
			})
			let picked: { folder: string; result: DetectOrmResult } | null
			try {
				picked = await linkProject()
			} catch (error) {
				if (runId !== runIdRef.current) return
				setState(function (prev) {
					return {
						...prev,
						phase: 'error',
						error: error instanceof Error ? error.message : 'Failed to open the folder picker.',
					}
				})
				return
			}
			if (runId !== runIdRef.current) return
			if (!picked) {
				// User cancelled the picker — return to wherever we were.
				setState(function (prev) {
					return { ...prev, phase: prev.linked ? 'ready' : 'idle' }
				})
				return
			}
			await startFromDetect(picked.folder, picked.result, runId)
		},
		[startFromDetect],
	)

	const rescan = useCallback(
		async function () {
			const folder = state.linked?.folder ?? state.choiceFolder
			if (!folder) return
			const runId = ++runIdRef.current
			setState(function (prev) {
				return { ...prev, phase: 'linking', error: null }
			})
			let result: DetectOrmResult
			try {
				result = await detectProjectOrm(folder)
			} catch (error) {
				if (runId !== runIdRef.current) return
				setState(function (prev) {
					return {
						...prev,
						phase: 'error',
						error: error instanceof Error ? error.message : 'Failed to re-scan the project.',
					}
				})
				return
			}
			if (runId !== runIdRef.current) return
			await startFromDetect(folder, result, runId)
		},
		[state.linked, state.choiceFolder, startFromDetect],
	)

	const chooseOrm = useCallback(
		async function (chosen: OrmLink) {
			const folder = state.choiceFolder
			if (!folder) return
			const runId = ++runIdRef.current
			setState(function (prev) {
				return { ...prev, phase: 'analyzing', error: null }
			})
			await analyze(folder, chosen, runId)
		},
		[state.choiceFolder, analyze],
	)

	// The live IR with managed/system tables filtered out (unless revealed), and
	// the diff derived from it. Toggling `showExternal` re-diffs from the cached
	// IRs — no re-introspection — and the generator works off the SAME filtered
	// view, so it can never emit a DROP for a hidden bookkeeping/system table.
	const liveForDiff = useMemo(
		function () {
			return state.liveIr
				? filterManagedTables(state.liveIr, state.dialect, showExternal)
				: null
		},
		[state.liveIr, state.dialect, showExternal],
	)

	const visibleDiff = useMemo(
		function () {
			if (!liveForDiff || !state.codeIr) return state.diff
			return diffSchema(liveForDiff, state.codeIr)
		},
		[liveForDiff, state.codeIr, state.diff],
	)

	const hiddenCount = useMemo(
		function () {
			return state.liveIr ? countManagedTables(state.liveIr, state.dialect) : 0
		},
		[state.liveIr, state.dialect],
	)

	const generate = useCallback(
		function (): MigrationResult | null {
			if (!visibleDiff) return null
			const result = generateMigrationSql(visibleDiff, state.dialect, {
				from: liveForDiff ?? undefined,
				to: state.codeIr ?? undefined,
			})
			// Fold generator warnings into the notes area, deduped against existing.
			if (result.warnings.length > 0) {
				setState(function (prev) {
					const existing = new Set(
						prev.notes.filter((n) => n.source === 'generate').map((n) => n.message),
					)
					const fresh = result.warnings
						.filter((m) => !existing.has(m))
						.map(function (m): CockpitNote {
							return { source: 'generate', message: m }
						})
					return fresh.length > 0 ? { ...prev, notes: [...prev.notes, ...fresh] } : prev
				})
			}
			return result
		},
		[visibleDiff, state.dialect, liveForDiff, state.codeIr],
	)

	const setCompareConnection = useCallback(function (id: string) {
		setCompareConnectionId(id)
	}, [])

	const reset = useCallback(function () {
		runIdRef.current++
		setState(function (prev) {
			return {
				...prev,
				phase: 'idle',
				error: null,
				linked: null,
				choices: null,
				choiceFolder: null,
				codeIr: null,
				liveIr: null,
				diff: null,
				notes: [],
				connectionMismatch: null,
			}
		})
	}, [])

	// Restore the last-linked folder for this connection on mount / connection
	// switch, and auto-analyze it. Best-effort — a missing/moved folder just
	// degrades to the empty state.
	useEffect(
		function () {
			if (!connectionId) return
			let cancelled = false
			async function restore() {
				let folder: string | null
				if (isWebDemo()) {
					folder = DEMO_PROJECT_FOLDER
				} else {
					let result: Awaited<ReturnType<typeof commands.getSetting>>
					try {
						result = await commands.getSetting(SETTING_PREFIX + connectionId)
					} catch (caught) {
						if (isDesktopOnlyError(caught)) return
						throw caught
					}
					if (cancelled) return
					folder = result.status === 'ok' ? result.data : null
				}
				if (!folder) return
				const runId = ++runIdRef.current
				setState(function (prev) {
					// Don't clobber an in-flight or already-linked session.
					if (prev.linked || prev.phase !== 'idle') return prev
					return { ...prev, phase: 'linking' }
				})
				let detect: DetectOrmResult
				try {
					detect = await detectProjectOrm(folder)
				} catch {
					if (!cancelled && runId === runIdRef.current) {
						setState(function (prev) {
							return { ...prev, phase: 'idle' }
						})
					}
					return
				}
				if (cancelled || runId !== runIdRef.current) return
				await startFromDetect(folder, detect, runId)
			}
			void restore()
			return function () {
				cancelled = true
			}
		},
		// startFromDetect is stable enough; intentionally keyed on connection only.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[connectionId],
	)

	// Re-diff the already-linked project when the comparison connection changes
	// (the picker, or following the active connection). Keyed solely on the id so
	// it never fires from `analyze`/link identity churn.
	const prevCompareRef = useRef(compareConnectionId)
	useEffect(
		function () {
			if (prevCompareRef.current === compareConnectionId) return
			prevCompareRef.current = compareConnectionId
			const linked = state.linked
			if (!linked) return
			const runId = ++runIdRef.current
			setState(function (prev) {
				return { ...prev, phase: 'analyzing', error: null }
			})
			void analyze(linked.folder, linked.link, runId)
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[compareConnectionId],
	)

	return {
		...state,
		diff: visibleDiff,
		link,
		rescan,
		chooseOrm,
		generate,
		reset,
		showExternal,
		setShowExternal,
		hiddenCount,
		setCompareConnection,
	}
}
