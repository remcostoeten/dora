import {
	Background,
	BackgroundVariant,
	type EdgeTypes,
	MiniMap,
	ReactFlow,
	ReactFlowProvider,
	useEdgesState,
	useNodesState,
	useReactFlow,
	type Edge,
	type Node,
	type NodeTypes
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Network, AlertCircle } from 'lucide-react'
import {
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode
} from 'react'
import { useColorScheme } from '@studio/shared/hooks/use-color-scheme'
import { useToast } from '@studio/shared/ui/use-toast'
import { convertSchemaToDrizzle } from '@studio/core/data-generation/sql-to-drizzle'
import { useAdapter } from '@studio/core/data-provider'
import { getAdapterError } from '@studio/core/data-provider/types'
import type { DatabaseSchema } from '@studio/lib/bindings'
import { EmptyState } from '@studio/shared/ui/empty-state'
import { IconStack, ProjectIllustration } from '@studio/shared/ui/empty-state-illustrations'
import { SchemaVisualizerCanvasLoadingState } from '@studio/shared/ui/view-loading-shell'
import { cn } from '@studio/shared/utils/cn'
import { getTableRefId } from '@studio/shared/utils/table-ref'
import { RelationshipEdge } from './components/relationship-edge'
import { SchemaDetailsPanel, type DetailsTab } from './components/schema-details-panel'
import { SchemaExportPreviewDialog } from './components/schema-export-preview-dialog'
import { SchemaTableNav } from './components/schema-table-nav'
import { SchemaToolbar } from './components/schema-toolbar'
import { SchemaZoombar, type EdgeStyle } from './components/schema-zoombar'
import { TableNode } from './components/table-node'
import {
	getNodeHeight,
	NODE_HEADER_HEIGHT,
	NODE_LIST_PADDING_TOP,
	NODE_ROW_HEIGHT,
	useSchemaGraph,
	type RelationshipEdgeData,
	type TableNodeData
} from './hooks/use-schema-graph'
import { useTablePulse } from './hooks/use-table-pulse'
import {
	buildCreateTableSql,
	buildTableDrizzle,
	formatCount,
	getRelationsByTable
} from './utils/schema-insights'

type Props = {
	activeConnectionId: string | undefined
	selectedTableId?: string
	onSelectTable?: (tableId: string, tableName: string) => void
	onOpenTable?: (tableId: string, tableName: string) => void
	windowControls?: ReactNode
}

type ExportPreviewState = {
	open: boolean
	title: string
	description: string
	filename: string
	language: 'json' | 'sql' | 'typescript'
	source: string
	isLoading: boolean
	onDownload: () => void
	onCopy: () => void
}

const NODE_TYPES: NodeTypes = {
	tableNode: TableNode
}

const EDGE_TYPES: EdgeTypes = {
	relationshipEdge: RelationshipEdge
}

function downloadTextFile(filename: string, content: string, type: string) {
	const blob = new Blob([content], { type })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = filename
	a.click()
	URL.revokeObjectURL(url)
}

function escapeXml(value: string) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;')
}

type DiagramPalette = {
	canvas: string
	nodeBody: string
	nodeHeader: string
	nodeBorder: string
	title: string
	columnName: string
	columnType: string
	edge: string
}

// Matches the previous hardcoded dark values; used when no document is
// available (e.g. tests) so buildDiagramSvg stays callable without a DOM.
const FALLBACK_PALETTE: DiagramPalette = {
	canvas: '#0f0f14',
	nodeBody: '#17171d',
	nodeHeader: '#202029',
	nodeBorder: '#33333b',
	title: '#f1f1f3',
	columnName: '#d7d7dd',
	columnType: '#85858f',
	edge: '#7c6ff6'
}

// CSS custom properties read via getComputedStyle come back as unresolved
// `var(...)` chains, and the exported SVG is rendered in a fresh document with
// no access to the app's tokens. So we resolve each expression to a concrete
// rgb/rgba string by letting the browser compute `color` on a probe element.
function resolveDiagramPalette(): DiagramPalette {
	if (typeof document === 'undefined') return FALLBACK_PALETTE

	const probe = document.createElement('span')
	probe.style.position = 'absolute'
	probe.style.visibility = 'hidden'
	probe.style.pointerEvents = 'none'
	document.body.appendChild(probe)

	function resolve(expr: string, fallback: string): string {
		probe.style.color = ''
		probe.style.color = expr
		const value = getComputedStyle(probe).color
		return value || fallback
	}

	try {
		return {
			canvas: resolve('hsl(var(--background))', FALLBACK_PALETTE.canvas),
			nodeBody: resolve('hsl(var(--card))', FALLBACK_PALETTE.nodeBody),
			nodeHeader: resolve('hsl(var(--accent))', FALLBACK_PALETTE.nodeHeader),
			nodeBorder: resolve('hsl(var(--border))', FALLBACK_PALETTE.nodeBorder),
			title: resolve('hsl(var(--foreground))', FALLBACK_PALETTE.title),
			columnName: resolve('hsl(var(--secondary-foreground))', FALLBACK_PALETTE.columnName),
			columnType: resolve('hsl(var(--muted-foreground))', FALLBACK_PALETTE.columnType),
			edge: resolve('hsl(var(--foreground) / 0.4)', FALLBACK_PALETTE.edge)
		}
	} finally {
		probe.remove()
	}
}

function buildDiagramSvg(
	nodes: Node<TableNodeData>[],
	edges: Edge<RelationshipEdgeData>[],
	palette: DiagramPalette = FALLBACK_PALETTE
) {
	const nodeWidth = 260
	const headerHeight = 34
	const rowHeight = 24
	const padding = 80
	const nodeHeights = new Map(
		nodes.map((node) => [node.id, headerHeight + node.data.columns.length * rowHeight])
	)
	const minX = Math.min(...nodes.map((node) => node.position.x), 0)
	const minY = Math.min(...nodes.map((node) => node.position.y), 0)
	const maxX = Math.max(...nodes.map((node) => node.position.x + nodeWidth), nodeWidth)
	const maxY = Math.max(
		...nodes.map((node) => node.position.y + (nodeHeights.get(node.id) ?? 120)),
		120
	)
	const width = maxX - minX + padding * 2
	const height = maxY - minY + padding * 2
	const offsetX = padding - minX
	const offsetY = padding - minY
	const nodeLookup = new Map(nodes.map((node) => [node.id, node]))

	const edgeMarkup = edges
		.map((edge) => {
			const source = nodeLookup.get(edge.source)
			const target = nodeLookup.get(edge.target)
			if (!source || !target) return ''
			const sourceHeight = nodeHeights.get(source.id) ?? 120
			const targetHeight = nodeHeights.get(target.id) ?? 120
			const x1 = source.position.x + offsetX + nodeWidth
			const y1 = source.position.y + offsetY + sourceHeight / 2
			const x2 = target.position.x + offsetX
			const y2 = target.position.y + offsetY + targetHeight / 2
			const midX = x1 + (x2 - x1) / 2
			return `<path d="M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}" fill="none" stroke="${palette.edge}" stroke-width="1.8" />`
		})
		.join('')

	const nodeMarkup = nodes
		.map((node) => {
			const x = node.position.x + offsetX
			const y = node.position.y + offsetY
			const height = nodeHeights.get(node.id) ?? 120
			const rows = node.data.columns
				.map((column, index) => {
					const rowY = y + headerHeight + index * rowHeight
					return `<text x="${x + 14}" y="${rowY + 16}" fill="${palette.columnName}" font-family="monospace" font-size="11">${escapeXml(column.name)}</text><text x="${x + nodeWidth - 14}" y="${rowY + 16}" fill="${palette.columnType}" text-anchor="end" font-family="monospace" font-size="10">${escapeXml(column.data_type)}</text>`
				})
				.join('')
			return `<g><rect x="${x}" y="${y}" width="${nodeWidth}" height="${height}" rx="6" fill="${palette.nodeBody}" stroke="${palette.nodeBorder}"/><rect x="${x}" y="${y}" width="${nodeWidth}" height="${headerHeight}" rx="6" fill="${palette.nodeHeader}"/><text x="${x + 14}" y="${y + 22}" fill="${palette.title}" font-family="system-ui, sans-serif" font-size="12" font-weight="600">${escapeXml(node.data.tableName)}</text>${rows}</g>`
		})
		.join('')

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${palette.canvas}"/>${edgeMarkup}${nodeMarkup}</svg>`
}

const FIT_OPTIONS = { padding: 0.12, duration: 220 }
const EDGE_STYLES: EdgeStyle[] = ['flow', 'dashed', 'solid']
const PREFS_KEY = 'dora:schema-visualizer:prefs'

type Prefs = {
	showNav: boolean
	showDetails: boolean
	showMinimap: boolean
	edgeStyle: EdgeStyle
}

const DEFAULT_PREFS: Prefs = {
	showNav: true,
	showDetails: true,
	showMinimap: true,
	edgeStyle: 'flow'
}

function readPrefs(): Prefs {
	try {
		const raw = localStorage.getItem(PREFS_KEY)
		if (!raw) return DEFAULT_PREFS
		const parsed = JSON.parse(raw) as Partial<Prefs>
		return {
			...DEFAULT_PREFS,
			...parsed,
			edgeStyle: EDGE_STYLES.includes(parsed.edgeStyle as EdgeStyle)
				? (parsed.edgeStyle as EdgeStyle)
				: DEFAULT_PREFS.edgeStyle
		}
	} catch {
		return DEFAULT_PREFS
	}
}

function writePrefs(prefs: Prefs) {
	try {
		localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
	} catch {}
}

function getRelatedIds(edges: Edge<RelationshipEdgeData>[], tableId: string | null) {
	const related = new Set<string>()
	if (!tableId) return related
	edges.forEach((edge) => {
		if (edge.source === tableId) related.add(edge.target)
		if (edge.target === tableId) related.add(edge.source)
	})
	related.delete(tableId)
	return related
}

function decorateNodesForSelection(
	nodes: Node<TableNodeData>[],
	selectedTableId: string | null,
	relatedIds: Set<string>
) {
	return nodes.map((node) => {
		const focusState: TableNodeData['focusState'] = !selectedTableId
			? 'none'
			: node.id === selectedTableId
				? 'selected'
				: relatedIds.has(node.id)
					? 'related'
					: 'dim'
		const selected = node.id === selectedTableId
		if (node.data.focusState === focusState && Boolean(node.selected) === selected) return node
		return { ...node, selected, data: { ...node.data, focusState } }
	})
}

function decorateEdgesForSelection(
	edges: Edge<RelationshipEdgeData>[],
	selectedTableId: string | null
) {
	return edges.map((edge) => {
		const isActive =
			selectedTableId !== null &&
			(edge.source === selectedTableId || edge.target === selectedTableId)
		return {
			...edge,
			selected: false,
			animated: false,
			zIndex: isActive ? 1 : 0,
			data: edge.data
				? { ...edge.data, isActive, isDimmed: selectedTableId !== null && !isActive }
				: edge.data
		}
	})
}

function isTypingTarget(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false
	return (
		target.isContentEditable ||
		target.tagName === 'INPUT' ||
		target.tagName === 'TEXTAREA' ||
		target.tagName === 'SELECT'
	)
}

function SchemaVisualizerInner({
	activeConnectionId,
	selectedTableId,
	onSelectTable,
	onOpenTable,
	windowControls
}: Props) {
	const adapter = useAdapter()
	const reactFlow = useReactFlow<Node<TableNodeData>, Edge<RelationshipEdgeData>>()
	const { toast } = useToast()
	const rootRef = useRef<HTMLDivElement>(null)
	const colorScheme = useColorScheme()
	const searchInputRef = useRef<HTMLInputElement>(null)
	const [schema, setSchema] = useState<DatabaseSchema | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [search, setSearch] = useState('')
	const deferredSearch = useDeferredValue(search)
	const [prefs, setPrefs] = useState(readPrefs)
	const [editMode, setEditMode] = useState(false)
	const [activeTableId, setActiveTableId] = useState<string | null>(selectedTableId || null)
	const [detailsTab, setDetailsTab] = useState<DetailsTab>('overview')
	const [focusColumn, setFocusColumn] = useState<string | null>(null)
	const [exportPreview, setExportPreview] = useState<ExportPreviewState | null>(null)
	const [layoutVersion, setLayoutVersion] = useState(0)

	function updatePrefs(patch: Partial<Prefs>) {
		setPrefs((current) => {
			const next = { ...current, ...patch }
			writePrefs(next)
			return next
		})
	}

	const fetchSchema = useCallback(
		async (signal: AbortSignal) => {
			if (signal.aborted) {
				return
			}

			if (!activeConnectionId) {
				if (!signal.aborted) {
					setSchema(null)
					setError(null)
					setIsLoading(false)
				}
				return
			}

			setIsLoading(true)
			setError(null)

			try {
				await adapter.connectToDatabase(activeConnectionId)
				if (signal.aborted) {
					return
				}

				const res = await adapter.getSchema(activeConnectionId)
				if (signal.aborted) {
					return
				}

				if (res.ok) {
					setSchema(res.data)
				} else {
					setError(getAdapterError(res))
				}
			} catch (e) {
				if (!signal.aborted) {
					setError(e instanceof Error ? e.message : String(e))
				}
			} finally {
				if (!signal.aborted) {
					setIsLoading(false)
				}
			}
		},
		[activeConnectionId, adapter]
	)

	useEffect(() => {
		const controller = new AbortController()

		void fetchSchema(controller.signal)

		return () => {
			controller.abort()
		}
	}, [fetchSchema])

	const {
		nodes: graphNodes,
		edges: graphEdges,
		groups,
		searchSummary
	} = useSchemaGraph(schema, deferredSearch)

	const positionStorageKey = activeConnectionId
		? `dora:schema-visualizer:layout:v2:${activeConnectionId}`
		: null
	const positionedGraphNodes = useMemo(() => {
		if (!positionStorageKey || layoutVersion < 0) return graphNodes
		try {
			const raw = localStorage.getItem(positionStorageKey)
			if (!raw) return graphNodes
			const positions = JSON.parse(raw) as Record<string, { x: number; y: number }>
			return graphNodes.map((node) => ({
				...node,
				position: positions[node.id] ?? node.position
			}))
		} catch {
			return graphNodes
		}
	}, [graphNodes, positionStorageKey, layoutVersion])

	const [nodes, setNodes, onNodesChange] =
		useNodesState<Node<TableNodeData>>(positionedGraphNodes)
	const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<RelationshipEdgeData>>(graphEdges)

	const pulseMap = useTablePulse()

	const relatedIds = useMemo(
		() => getRelatedIds(graphEdges, activeTableId),
		[graphEdges, activeTableId]
	)
	const selectionRef = useRef({ activeTableId, relatedIds })
	selectionRef.current = { activeTableId, relatedIds }

	useEffect(() => {
		const { activeTableId: currentId, relatedIds: currentRelated } = selectionRef.current
		setNodes(decorateNodesForSelection(positionedGraphNodes, currentId, currentRelated))
	}, [positionedGraphNodes, setNodes])

	useEffect(() => {
		setNodes((currentNodes) =>
			decorateNodesForSelection(currentNodes, activeTableId, relatedIds)
		)
	}, [activeTableId, relatedIds, setNodes])

	useEffect(
		function applyPulseToNodes() {
			setNodes(function (currentNodes) {
				let changed = false
				const nextNodes = currentNodes.map(function (node) {
					const pulse = pulseMap.get(node.data.tableName) || 'idle'
					if (pulse === node.data.pulseState) return node
					changed = true
					return {
						...node,
						data: { ...node.data, pulseState: pulse }
					}
				})
				return changed ? nextNodes : currentNodes
			})
		},
		[pulseMap, setNodes]
	)

	useEffect(() => {
		setEdges(decorateEdgesForSelection(graphEdges, activeTableId))
	}, [activeTableId, graphEdges, setEdges])

	useEffect(() => {
		if (selectedTableId) setActiveTableId(selectedTableId)
	}, [selectedTableId])

	const centerOnTable = useCallback(
		function centerOnTable(tableId: string, columnName?: string) {
			const node = reactFlow.getNode(tableId)
			if (!node) return
			const columnIndex = columnName
				? node.data.columns.findIndex((column) => column.name === columnName)
				: -1
			const x = node.position.x + node.data.width / 2
			const y =
				columnIndex >= 0
					? node.position.y +
						NODE_HEADER_HEIGHT +
						NODE_LIST_PADDING_TOP +
						columnIndex * NODE_ROW_HEIGHT
					: node.position.y + getNodeHeight(node.data.columns.length) / 2
			reactFlow.setCenter(x, y, {
				zoom: Math.max(reactFlow.getZoom(), columnIndex >= 0 ? 1 : 0.72),
				duration: 260
			})
		},
		[reactFlow]
	)

	useEffect(() => {
		if (!selectedTableId) return
		if (!positionedGraphNodes.some((node) => node.id === selectedTableId)) return
		centerOnTable(selectedTableId)
	}, [selectedTableId, positionedGraphNodes, centerOnTable])

	const relations = useMemo(() => getRelationsByTable(graphEdges), [graphEdges])
	const selectedTable = useMemo(
		() => graphNodes.find((node) => node.id === activeTableId)?.data ?? null,
		[graphNodes, activeTableId]
	)

	const schemaLabel = useMemo(() => {
		const names = Array.from(
			new Set(graphNodes.map((node) => node.data.schema).filter(Boolean))
		)
		if (names.length === 0) return 'Schema'
		if (names.length === 1) return names[0]
		return `${names.length} schemas`
	}, [graphNodes])

	const summary = `${formatCount(graphNodes.length, 'table')} · ${formatCount(graphEdges.length, 'relationship')}`
	const searchMeta = searchSummary
		? `${searchSummary.matchedTables} of ${graphNodes.length}`
		: null
	const isSearching = searchSummary !== null

	const fitView = useCallback(
		function fitView() {
			void reactFlow.fitView(FIT_OPTIONS)
		},
		[reactFlow]
	)

	function selectTable(tableId: string, options?: { tab?: DetailsTab; column?: string }) {
		const node = graphNodes.find((item) => item.id === tableId)
		if (!node) return
		if (tableId !== activeTableId) setFocusColumn(null)
		setActiveTableId(tableId)
		if (options?.tab) setDetailsTab(options.tab)
		if (options?.column) {
			setFocusColumn(options.column)
			if (!options.tab) setDetailsTab('columns')
		}
		if (!prefs.showDetails) updatePrefs({ showDetails: true })
		centerOnTable(tableId, options?.column)
		onSelectTable?.(node.data.tableId, node.data.tableName)
	}

	function clearSelection() {
		setActiveTableId(null)
		setFocusColumn(null)
	}

	function cycleEdgeStyle() {
		const index = EDGE_STYLES.indexOf(prefs.edgeStyle)
		updatePrefs({ edgeStyle: EDGE_STYLES[(index + 1) % EDGE_STYLES.length] })
	}

	function handleResetLayout() {
		if (positionStorageKey) {
			try {
				localStorage.removeItem(positionStorageKey)
			} catch {}
		}
		setLayoutVersion((value) => value + 1)
		window.setTimeout(fitView, 30)
	}

	function copyText(text: string, label: string) {
		if (!text) return
		void navigator.clipboard.writeText(text)
		toast({ title: `${label} copied` })
	}

	const getTableSql = useCallback((table: TableNodeData) => buildCreateTableSql(table), [])
	const getTableDrizzle = useCallback(
		(table: TableNodeData) => (schema ? buildTableDrizzle(schema, table) : ''),
		[schema]
	)

	const keyHandlerRef = useRef<(event: KeyboardEvent) => void>(() => {})
	keyHandlerRef.current = function handleKey(event: KeyboardEvent) {
		const root = rootRef.current
		if (!root || root.getClientRects().length === 0) return
		if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
		if (document.querySelector('[role="dialog"], [role="menu"]')) return
		if (isTypingTarget(event.target)) return
		const key = event.key
		if (key === '/') {
			event.preventDefault()
			searchInputRef.current?.focus()
			searchInputRef.current?.select()
		} else if (key === 'Escape') {
			if (activeTableId) clearSelection()
			else if (search) setSearch('')
		} else if (key === 'f' || key === 'F') {
			fitView()
		} else if (key === 'e' || key === 'E') {
			setEditMode((value) => !value)
		} else if (key === 'm' || key === 'M') {
			updatePrefs({ showMinimap: !prefs.showMinimap })
		} else if (key === 'l' || key === 'L') {
			cycleEdgeStyle()
		} else if (key === '+' || key === '=') {
			void reactFlow.zoomIn({ duration: 200 })
		} else if (key === '-') {
			void reactFlow.zoomOut({ duration: 200 })
		} else if (key === '0') {
			void reactFlow.zoomTo(1, { duration: 200 })
		}
	}

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			keyHandlerRef.current(event)
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [])

	function handleExportSvg() {
		downloadTextFile(
			'schema-diagram.svg',
			buildDiagramSvg(nodes, edges, resolveDiagramPalette()),
			'image/svg+xml'
		)
	}

	async function handleExportPng() {
		const svg = buildDiagramSvg(nodes, edges, resolveDiagramPalette())
		const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
		const image = new Image()
		image.onload = function () {
			const canvas = document.createElement('canvas')
			canvas.width = image.width
			canvas.height = image.height
			const context = canvas.getContext('2d')
			context?.drawImage(image, 0, 0)
			URL.revokeObjectURL(url)
			canvas.toBlob(function (blob) {
				if (!blob) return
				const pngUrl = URL.createObjectURL(blob)
				const a = document.createElement('a')
				a.href = pngUrl
				a.download = 'schema-diagram.png'
				a.click()
				URL.revokeObjectURL(pngUrl)
			}, 'image/png')
		}
		image.src = url
	}

	async function getSqlExportSource() {
		if (!activeConnectionId) return null
		const result = await adapter.getDatabaseDDL(activeConnectionId)
		if (!result.ok) {
			toast({
				title: 'Export failed',
				description: getAdapterError(result),
				variant: 'destructive'
			})
			return null
		}
		return result.data
	}

	function closeExportPreview() {
		setExportPreview(null)
	}

	function openJsonPreview() {
		if (!schema) return
		const source = JSON.stringify(schema, null, 2)
		setExportPreview({
			open: true,
			title: 'Export JSON',
			description: 'Review the serialized schema before copying or downloading it.',
			filename: 'schema.json',
			language: 'json',
			source,
			isLoading: false,
			onCopy: function () {
				navigator.clipboard.writeText(source)
				toast({ title: 'JSON copied' })
			},
			onDownload: function () {
				downloadTextFile('schema.json', source, 'application/json')
			}
		})
	}

	async function openSqlPreview() {
		if (!activeConnectionId) return
		setExportPreview({
			open: true,
			title: 'Export SQL',
			description: 'Review the generated SQL schema before copying or downloading it.',
			filename: 'schema.sql',
			language: 'sql',
			source: '',
			isLoading: true,
			onCopy: function () {},
			onDownload: function () {}
		})

		const source = await getSqlExportSource()
		if (!source) {
			setExportPreview(null)
			return
		}

		setExportPreview({
			open: true,
			title: 'Export SQL',
			description: 'Review the generated SQL schema before copying or downloading it.',
			filename: 'schema.sql',
			language: 'sql',
			source,
			isLoading: false,
			onCopy: function () {
				navigator.clipboard.writeText(source)
				toast({ title: 'SQL copied' })
			},
			onDownload: function () {
				downloadTextFile('schema.sql', source, 'text/sql')
			}
		})
	}

	function openDrizzlePreview() {
		if (!schema) return
		const source = convertSchemaToDrizzle(schema)
		setExportPreview({
			open: true,
			title: 'Export Drizzle',
			description: 'Review the generated Drizzle schema before copying or downloading it.',
			filename: 'schema.ts',
			language: 'typescript',
			source,
			isLoading: false,
			onCopy: function () {
				navigator.clipboard.writeText(source)
				toast({ title: 'Drizzle schema copied' })
			},
			onDownload: function () {
				downloadTextFile('schema.ts', source, 'text/typescript')
			}
		})
	}

	function handleOpenSelectedTable() {
		if (!selectedTable) return
		const tableId = getTableRefId({
			name: selectedTable.tableName,
			schema: selectedTable.schema || null
		})
		onOpenTable?.(tableId, selectedTable.tableName)
	}

	function handlePersistNodePositions(nextNodes: Node<TableNodeData>[]) {
		if (!positionStorageKey) return
		const positions = nodes.reduce<Record<string, { x: number; y: number }>>((acc, node) => {
			acc[node.id] = node.position
			return acc
		}, {})
		nextNodes.forEach((node) => {
			positions[node.id] = node.position
		})
		try {
			localStorage.setItem(positionStorageKey, JSON.stringify(positions))
		} catch {}
	}

	if (!activeConnectionId) {
		return (
			<EmptyState
				loop
				pointer
				illustration={<IconStack icon={<Network />} />}
				title='No connection'
				description='Select a database connection to visualize its schema.'
			/>
		)
	}

	const hasTables = Boolean(schema && schema.tables.length > 0)

	return (
		<div
			ref={rootRef}
			className='schema-visualizer flex h-full flex-col bg-background'
			data-scheme={colorScheme}
		>
			<SchemaToolbar
				searchInputRef={searchInputRef}
				search={search}
				onSearchChange={setSearch}
				searchMeta={searchMeta}
				schemaLabel={schemaLabel}
				summary={summary}
				showNav={prefs.showNav}
				onToggleNav={() => updatePrefs({ showNav: !prefs.showNav })}
				showDetails={prefs.showDetails}
				onToggleDetails={() => updatePrefs({ showDetails: !prefs.showDetails })}
				showMinimap={prefs.showMinimap}
				onToggleMinimap={() => updatePrefs({ showMinimap: !prefs.showMinimap })}
				editMode={editMode}
				onEditModeChange={setEditMode}
				onFit={fitView}
				onRefresh={() => {
					const controller = new AbortController()
					void fetchSchema(controller.signal)
				}}
				onPreviewJson={openJsonPreview}
				onExportSvg={handleExportSvg}
				onExportPng={handleExportPng}
				onPreviewSql={openSqlPreview}
				onPreviewDrizzle={openDrizzlePreview}
				canExport={hasTables}
				isLoading={isLoading}
				rightSlot={windowControls}
			/>

			<div
				className={cn(
					'sv-body',
					(!prefs.showNav || !hasTables) && 'sv-body--no-nav',
					(!prefs.showDetails || !hasTables) && 'sv-body--no-details'
				)}
			>
				{hasTables && prefs.showNav && (
					<SchemaTableNav
						groups={groups}
						nodes={graphNodes}
						activeTableId={activeTableId}
						isSearching={isSearching}
						search={deferredSearch}
						onSelect={(tableId) => selectTable(tableId)}
					/>
				)}

				<div
					className={cn('sv-canvas', editMode && 'sv-canvas--editing')}
					data-edges={prefs.edgeStyle}
				>
					{error ? (
						<div className='flex h-full items-center justify-center p-4'>
							<div className='inline-flex items-center gap-2 text-destructive text-sm font-mono bg-destructive/10 px-4 py-3 rounded-md border border-destructive/20 max-w-lg'>
								<AlertCircle className='h-4 w-4 shrink-0' />
								<span>{error}</span>
							</div>
						</div>
					) : !hasTables ? (
						isLoading ? (
							<SchemaVisualizerCanvasLoadingState />
						) : (
							<EmptyState
								loop
								pointer
								illustration={<ProjectIllustration />}
								title='No tables'
								description='This database has no tables to visualize.'
							/>
						)
					) : (
						<ReactFlow
							nodes={nodes}
							edges={edges}
							onNodesChange={onNodesChange}
							onEdgesChange={onEdgesChange}
							onNodeClick={(_, node) => {
								if (node.id === activeTableId) return
								setFocusColumn(null)
								setActiveTableId(node.id)
								onSelectTable?.(node.data.tableId, node.data.tableName)
							}}
							onNodeDragStop={(_, __, nextNodes) =>
								handlePersistNodePositions(nextNodes ?? [])
							}
							onPaneClick={clearSelection}
							nodeTypes={NODE_TYPES}
							edgeTypes={EDGE_TYPES}
							nodesDraggable={editMode}
							nodesConnectable={false}
							elementsSelectable={false}
							onlyRenderVisibleElements
							fitView
							fitViewOptions={{ padding: 0.12 }}
							minZoom={0.1}
							maxZoom={2}
							proOptions={{ hideAttribution: true }}
							colorMode={colorScheme}
						>
							<Background variant={BackgroundVariant.Dots} gap={20} size={1} />
							<SchemaZoombar
								edgeStyle={prefs.edgeStyle}
								onCycleEdgeStyle={cycleEdgeStyle}
								editMode={editMode}
								onResetLayout={handleResetLayout}
								onFit={fitView}
							/>
							{prefs.showMinimap && (
								<MiniMap
									pannable
									zoomable
									nodeColor={(node) => {
										const hue = (node.data as TableNodeData).hue
										return hue
											? `var(--sv-${hue})`
											: 'hsl(var(--foreground) / 0.45)'
									}}
									nodeStrokeWidth={0}
									nodeClassName={(node) => {
										const data = node.data as TableNodeData
										return cn(
											'sv-minimap-node',
											data.focusState === 'selected' && 'is-selected',
											(data.focusState === 'dim' ||
												data.searchState === 'dim') &&
												'is-dim'
										)
									}}
									nodeBorderRadius={3}
									bgColor='hsl(var(--card))'
									maskColor='hsl(var(--background) / 0.55)'
									maskStrokeColor='hsl(var(--foreground) / 0.5)'
									maskStrokeWidth={1}
								/>
							)}
						</ReactFlow>
					)}
				</div>

				{hasTables && prefs.showDetails && (
					<SchemaDetailsPanel
						table={selectedTable}
						nodes={graphNodes}
						groups={groups}
						relations={relations}
						schemaLabel={schemaLabel}
						relationshipCount={graphEdges.length}
						tab={detailsTab}
						onTabChange={setDetailsTab}
						focusColumn={focusColumn}
						onFocusColumnChange={setFocusColumn}
						onSelect={selectTable}
						onClose={clearSelection}
						onOpenTable={handleOpenSelectedTable}
						onShowColumn={(column) => {
							if (activeTableId) centerOnTable(activeTableId, column)
						}}
						getSql={getTableSql}
						getDrizzle={getTableDrizzle}
						onCopy={copyText}
					/>
				)}
			</div>
			{exportPreview && (
				<SchemaExportPreviewDialog
					open={exportPreview.open}
					onOpenChange={(open) => {
						if (!open) {
							closeExportPreview()
						}
					}}
					title={exportPreview.title}
					description={exportPreview.description}
					filename={exportPreview.filename}
					language={exportPreview.language}
					source={exportPreview.source}
					isLoading={exportPreview.isLoading}
					onCopy={exportPreview.onCopy}
					onDownload={exportPreview.onDownload}
				/>
			)}
		</div>
	)
}

export function SchemaVisualizer(props: Props) {
	return (
		<ReactFlowProvider>
			<SchemaVisualizerInner {...props} />
		</ReactFlowProvider>
	)
}
