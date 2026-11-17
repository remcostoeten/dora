import type { Node } from '@xyflow/react'
import {
	AlertTriangle,
	ArrowRight,
	Check,
	ChevronDown,
	Copy,
	Crosshair,
	Info,
	KeyRound,
	Link2,
	Table2,
	X
} from 'lucide-react'
import { useState, type CSSProperties, type ReactNode } from 'react'
import type { ColumnInfo } from '@studio/lib/bindings'
import { cn } from '@studio/shared/utils/cn'
import type { SchemaGroup, SchemaHue, TableNodeData } from '../hooks/use-schema-graph'
import {
	formatCount,
	getTableChecks,
	isIndexedColumn,
	isPrimaryKeyColumn,
	type TableCheck,
	type TableRelations
} from '../utils/schema-insights'

export type DetailsTab = 'overview' | 'columns' | 'code'

type Props = {
	table: TableNodeData | null
	nodes: Node<TableNodeData>[]
	groups: SchemaGroup[]
	relations: Map<string, TableRelations>
	schemaLabel: string
	relationshipCount: number
	tab: DetailsTab
	onTabChange: (tab: DetailsTab) => void
	focusColumn: string | null
	onFocusColumnChange: (column: string | null) => void
	onSelect: (tableId: string, options?: { tab?: DetailsTab; column?: string }) => void
	onClose: () => void
	onOpenTable: () => void
	onShowColumn: (column: string) => void
	getSql: (table: TableNodeData) => string
	getDrizzle: (table: TableNodeData) => string
	onCopy: (text: string, label: string) => void
}

const SQL_KEYWORDS = new Set([
	'alter',
	'boolean',
	'constraint',
	'create',
	'default',
	'delete',
	'foreign',
	'from',
	'index',
	'insert',
	'integer',
	'into',
	'key',
	'not',
	'null',
	'numeric',
	'primary',
	'references',
	'select',
	'serial',
	'table',
	'text',
	'timestamp',
	'unique',
	'update',
	'values',
	'varchar'
])

const TS_KEYWORDS = new Set([
	'boolean',
	'const',
	'date',
	'default',
	'doublePrecision',
	'export',
	'from',
	'import',
	'integer',
	'json',
	'jsonb',
	'mysqlTable',
	'notNull',
	'numeric',
	'pgTable',
	'primaryKey',
	'real',
	'references',
	'serial',
	'sqliteTable',
	'text',
	'timestamp',
	'uuid',
	'varchar'
])

function renderHighlightedCode(source: string, keywords: Set<string>) {
	const lines = source.split('\n')
	return lines.map((line, lineIndex) => {
		const isComment = line.trimStart().startsWith('--') || line.trimStart().startsWith('//')
		const parts: ReactNode[] = isComment
			? [
					<span className='sv-code-token--comment' key='comment'>
						{line}
					</span>
				]
			: line.split(/(\b[\w]+\b|'[^']*'|"[^"]*"|`[^`]*`)/g).map((part, partIndex) => {
					if (!part) return null
					if (/^(['"`]).*\1$/.test(part)) {
						return (
							<span className='sv-code-token--string' key={partIndex}>
								{part}
							</span>
						)
					}
					if (/^-?\d+(?:\.\d+)?$/.test(part)) {
						return (
							<span className='sv-code-token--number' key={partIndex}>
								{part}
							</span>
						)
					}
					if (keywords.has(part.toLowerCase())) {
						return (
							<span className='sv-code-token--keyword' key={partIndex}>
								{part}
							</span>
						)
					}
					return part
				})

		return (
			<span key={`${line}-${lineIndex}`}>
				{parts}
				{lineIndex < lines.length - 1 ? '\n' : null}
			</span>
		)
	})
}

function hueStyle(hue: SchemaHue | null): CSSProperties | undefined {
	return hue ? ({ '--sv-icon-color': `var(--sv-${hue})` } as CSSProperties) : undefined
}

function TableIcon({ hue, size = 'md' }: { hue: SchemaHue | null; size?: 'xs' | 'md' | 'lg' }) {
	return (
		<span
			className={cn('sv-icon-box sv-icon-box--tinted', `sv-icon-box--${size}`)}
			style={hueStyle(hue)}
		>
			<Table2
				className={
					size === 'xs' ? 'h-[9px] w-[9px]' : size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5'
				}
			/>
		</span>
	)
}

function Section({
	title,
	count,
	children
}: {
	title: string
	count?: number
	children: ReactNode
}) {
	return (
		<section className='sv-sec'>
			<div className='sv-sec__head'>
				<span className='sv-eyebrow'>{title}</span>
				{count !== undefined && <span className='sv-sec__count'>{count}</span>}
			</div>
			{children}
		</section>
	)
}

function CheckCard({
	check,
	title,
	onClick
}: {
	check: TableCheck
	title?: ReactNode
	onClick?: () => void
}) {
	const Icon = check.level === 'ok' ? Check : check.level === 'info' ? Info : AlertTriangle
	const content = (
		<>
			<span className='sv-check__icon'>
				<Icon className='h-3.5 w-3.5' strokeWidth={1.8} />
			</span>
			<span className='min-w-0'>
				<span className='sv-check__title'>{title ?? check.title}</span>
				<span className='sv-check__body'>{check.body}</span>
			</span>
		</>
	)
	const className = cn('sv-check', `sv-check--${check.level}`)
	if (!onClick) return <div className={className}>{content}</div>
	return (
		<button type='button' className={className} onClick={onClick}>
			{content}
		</button>
	)
}

function ColumnGlyph({
	table,
	column,
	hue
}: {
	table: TableNodeData
	column: ColumnInfo
	hue: SchemaHue | null
}) {
	if (column.foreign_key) {
		const Icon = isPrimaryKeyColumn(table, column) ? KeyRound : Link2
		return (
			<span className={cn('sv-glyph', hue && `sv-text-${hue}`)}>
				<Icon className='h-3 w-3' strokeWidth={2} />
			</span>
		)
	}
	if (isPrimaryKeyColumn(table, column)) {
		return (
			<span className='sv-glyph sv-glyph--pk'>
				<KeyRound className='h-3 w-3' strokeWidth={2} />
			</span>
		)
	}
	if (isIndexedColumn(table, column)) {
		return (
			<span className='sv-glyph'>
				<span className='sv-glyph__dot' />
			</span>
		)
	}
	return <span className='sv-glyph' />
}

function SchemaOverview({
	nodes,
	groups,
	relations,
	schemaLabel,
	relationshipCount,
	onSelect
}: Pick<
	Props,
	'nodes' | 'groups' | 'relations' | 'schemaLabel' | 'relationshipCount' | 'onSelect'
>) {
	const columnCount = nodes.reduce((sum, node) => sum + node.data.columns.length, 0)
	const hubs = nodes
		.map((node) => ({ node, count: relations.get(node.id)?.incoming.length ?? 0 }))
		.filter((entry) => entry.count > 0)
		.sort((a, b) => b.count - a.count)
		.slice(0, 5)
	const maxHub = hubs[0]?.count ?? 1
	const issues = nodes.flatMap((node) => {
		const tableRelations = relations.get(node.id)
		return getTableChecks(node.data, {
			isOnlyTable: nodes.length === 1,
			hasRelationships: Boolean(
				tableRelations && (tableRelations.incoming.length || tableRelations.outgoing.length)
			)
		})
			.filter((check) => check.level === 'warn' || check.level === 'notice')
			.map((check) => ({ node, check }))
	})

	return (
		<>
			<div className='sv-overview__head'>
				<div className='sv-eyebrow'>Schema</div>
				<div className='sv-overview__title'>{schemaLabel}</div>
				<div className='sv-overview__sub'>
					{formatCount(nodes.length, 'table')} ·{' '}
					{formatCount(relationshipCount, 'relationship')} ·{' '}
					{formatCount(columnCount, 'column')}
				</div>
			</div>

			<Section title='Most referenced'>
				{hubs.length > 0 ? (
					hubs.map(({ node, count }) => (
						<button
							key={node.id}
							type='button'
							className='sv-hub'
							onClick={() => onSelect(node.id)}
						>
							<TableIcon hue={node.data.hue} size='xs' />
							<span className='sv-hub__name'>{node.data.tableName}</span>
							<span className='sv-bar'>
								<span style={{ transform: `scaleX(${count / maxHub})` }} />
							</span>
							<span className='sv-hub__count'>{count}</span>
						</button>
					))
				) : (
					<p className='sv-none'>No foreign keys in this schema yet.</p>
				)}
			</Section>

			<Section title='Needs attention' count={issues.length}>
				{issues.length > 0 ? (
					issues
						.slice(0, 12)
						.map(({ node, check }) => (
							<CheckCard
								key={`${node.id}:${check.title}`}
								check={check}
								title={
									<span className='font-mono'>
										{check.column
											? `${node.data.tableName}.${check.column} has no index`
											: `${node.data.tableName} · ${check.title}`}
									</span>
								}
								onClick={() =>
									onSelect(
										node.id,
										check.column
											? { tab: 'columns', column: check.column }
											: undefined
									)
								}
							/>
						))
				) : (
					<CheckCard
						check={{
							level: 'ok',
							title: 'All clear',
							body: 'Every table has a primary key and every foreign key is indexed.'
						}}
					/>
				)}
			</Section>

			{groups.length > 1 && (
				<Section title='Groups'>
					{groups.map((group) => (
						<div key={group.id} className='sv-group-row'>
							<span className={cn('sv-dot', group.hue && `sv-bg-${group.hue}`)} />
							<span className='truncate'>{group.label}</span>
							<span className='sv-group-row__count'>{group.tableIds.length}</span>
						</div>
					))}
				</Section>
			)}

			<Section title='Reading the map'>
				<div className='sv-legend'>
					<span className='sv-legend__glyph'>
						<KeyRound className='h-3 w-3' strokeWidth={2} />
					</span>
					<span>Primary key</span>
					<span className='sv-legend__glyph sv-text-blue'>
						<Link2 className='h-3 w-3' strokeWidth={2} />
					</span>
					<span>Foreign key, tinted by the table it points to</span>
					<span className='sv-legend__glyph'>
						<span className='sv-glyph__dot' />
					</span>
					<span>Indexed column</span>
					<span className='sv-legend__glyph font-mono'>?</span>
					<span>Nullable type</span>
					<span className='sv-legend__glyph'>
						<span className='sv-legend__line' />
					</span>
					<span>Relationship, from the FK column to the key it references</span>
				</div>
			</Section>

			<div className='sv-tips'>
				<kbd>Click</kbd>
				<span>a table to trace its links</span>
				<kbd>/</kbd>
				<span>search tables, columns and types</span>
				<kbd>F</kbd>
				<span>fit the whole schema</span>
				<kbd>L</kbd>
				<span>switch connector style</span>
				<kbd>Esc</kbd>
				<span>clear the selection</span>
			</div>
		</>
	)
}

function RelationRow({
	from,
	to,
	direction,
	hue,
	onClick
}: {
	from: string
	to: { table: string; column: string }
	direction: 'out' | 'in'
	hue: SchemaHue | null
	onClick: () => void
}) {
	const target = (
		<>
			<TableIcon hue={hue} size='xs' />
			<span className='sv-rel__trunc'>
				<span className='sv-rel__strong'>{to.table}</span>
				<span className='sv-rel__dim'>.{to.column}</span>
			</span>
		</>
	)
	return (
		<button type='button' className='sv-rel' onClick={onClick} title={`Go to ${to.table}`}>
			{direction === 'out' ? (
				<>
					<span className='sv-rel__trunc'>{from}</span>
					<ArrowRight className='sv-rel__arrow h-3 w-3' />
					{target}
				</>
			) : (
				<>
					{target}
					<ArrowRight className='sv-rel__arrow h-3 w-3' />
					<span className='sv-rel__trunc'>{from}</span>
				</>
			)}
		</button>
	)
}

function ColumnDetail({
	table,
	column,
	onShowColumn
}: {
	table: TableNodeData
	column: ColumnInfo
	onShowColumn: (column: string) => void
}) {
	const isPk = isPrimaryKeyColumn(table, column)
	const indexed = isIndexedColumn(table, column)
	const chips = [
		isPk && 'PRIMARY KEY',
		column.foreign_key && 'FOREIGN KEY',
		column.is_auto_increment && 'AUTO INCREMENT',
		indexed && 'INDEXED',
		column.is_nullable ? 'NULLABLE' : 'NOT NULL'
	].filter((chip): chip is string => Boolean(chip))
	const none = <span className='sv-nullable'>none</span>

	return (
		<div className='sv-coldet'>
			<dl>
				<dt>Type</dt>
				<dd className='font-mono'>{column.data_type}</dd>
				<dt>Default</dt>
				<dd className='font-mono'>{column.default_value || none}</dd>
				<dt>References</dt>
				<dd className='font-mono'>
					{column.foreign_key
						? `${column.foreign_key.referenced_table}.${column.foreign_key.referenced_column}`
						: none}
				</dd>
				<dt>Index</dt>
				<dd>
					{indexed
						? 'Yes'
						: column.foreign_key
							? `None. Joins from ${column.foreign_key.referenced_table} scan the table.`
							: 'None'}
				</dd>
			</dl>
			<div className='sv-chips'>
				{chips.map((chip) => (
					<span key={chip} className='sv-chip'>
						{chip}
					</span>
				))}
			</div>
			<button
				type='button'
				className='sv-btn sv-btn--sm'
				onClick={() => onShowColumn(column.name)}
			>
				<Crosshair className='h-3.5 w-3.5' />
				Show in map
			</button>
		</div>
	)
}

function SelectedTable({
	table,
	nodes,
	relations,
	tab,
	onTabChange,
	focusColumn,
	onFocusColumnChange,
	onSelect,
	onClose,
	onOpenTable,
	onShowColumn,
	getSql,
	getDrizzle,
	onCopy
}: Omit<Props, 'table' | 'groups' | 'schemaLabel' | 'relationshipCount'> & {
	table: TableNodeData
}) {
	const [codeLanguage, setCodeLanguage] = useState<'sql' | 'drizzle'>('sql')
	const tableRelations = relations.get(table.tableId) ?? { outgoing: [], incoming: [] }
	const hueById = new Map(nodes.map((node) => [node.id, node.data.hue]))
	const idByName = new Map(nodes.map((node) => [node.data.tableName, node.id]))
	const primaryKeys = table.columns.filter((column) => isPrimaryKeyColumn(table, column))
	const indexedCount = table.columns.filter((column) => isIndexedColumn(table, column)).length
	const checks = getTableChecks(table, {
		isOnlyTable: nodes.length === 1,
		hasRelationships: tableRelations.incoming.length + tableRelations.outgoing.length > 0
	})
	const meta = [
		table.schema || null,
		formatCount(table.columns.length, 'column'),
		table.rowCountEstimate !== null && table.rowCountEstimate >= 0
			? `${table.rowCountEstimate.toLocaleString()} rows`
			: null
	].filter(Boolean)

	function goTo(tableName: string, column?: string) {
		const id = idByName.get(tableName)
		if (id) onSelect(id, column ? { column } : undefined)
	}

	function codeSource() {
		return codeLanguage === 'sql' ? getSql(table) : getDrizzle(table)
	}

	return (
		<>
			<div className='sv-dh'>
				<TableIcon hue={table.hue} size='lg' />
				<div className='min-w-0 flex-1'>
					<div className='sv-dh__name'>{table.tableName}</div>
					<div className='sv-dh__meta'>{meta.join(' · ')}</div>
				</div>
				<button
					type='button'
					className='sv-ibtn'
					onClick={onClose}
					title='Back to schema overview (Esc)'
					aria-label='Close details'
				>
					<X className='h-[15px] w-[15px]' />
				</button>
			</div>
			<div className='sv-dh__actions'>
				<button type='button' className='sv-btn sv-btn--primary' onClick={onOpenTable}>
					<Table2 className='h-3.5 w-3.5' />
					Open table
				</button>
				<button
					type='button'
					className='sv-btn'
					title='Copy CREATE TABLE'
					onClick={() => onCopy(getSql(table), 'SQL')}
				>
					<Copy className='h-[13px] w-[13px]' />
					SQL
				</button>
				<button
					type='button'
					className='sv-btn'
					title='Copy Drizzle schema'
					onClick={() => onCopy(getDrizzle(table), 'Drizzle schema')}
				>
					<Copy className='h-[13px] w-[13px]' />
					Drizzle
				</button>
			</div>

			<div className='sv-facts'>
				<div>
					<span className='sv-facts__label'>Primary key</span>
					<span
						className={cn(
							'sv-facts__value font-mono',
							primaryKeys.length === 0 && 'sv-facts__value--warn'
						)}
						title={primaryKeys.map((column) => column.name).join(', ')}
					>
						{primaryKeys.length > 0
							? primaryKeys.map((column) => column.name).join(', ')
							: 'None'}
					</span>
				</div>
				<div>
					<span className='sv-facts__label'>Indexed</span>
					<span className='sv-facts__value'>
						{indexedCount} of {table.columns.length}
					</span>
				</div>
				<div>
					<span className='sv-facts__label'>References</span>
					<span className='sv-facts__value'>
						{formatCount(tableRelations.outgoing.length, 'link')}
					</span>
				</div>
				<div>
					<span className='sv-facts__label'>Referenced by</span>
					<span className='sv-facts__value'>
						{formatCount(tableRelations.incoming.length, 'link')}
					</span>
				</div>
			</div>

			<div className='sv-tabs' role='tablist'>
				{(['overview', 'columns', 'code'] as const).map((value) => (
					<button
						key={value}
						type='button'
						role='tab'
						aria-selected={tab === value}
						className={cn(tab === value && 'is-active')}
						onClick={() => onTabChange(value)}
					>
						{value[0].toUpperCase() + value.slice(1)}
					</button>
				))}
			</div>

			{tab === 'overview' && (
				<>
					<Section title='References' count={tableRelations.outgoing.length}>
						{tableRelations.outgoing.length > 0 ? (
							tableRelations.outgoing.map((relation) => (
								<RelationRow
									key={`${relation.sourceColumn}->${relation.targetTableName}.${relation.targetColumn}`}
									direction='out'
									from={relation.sourceColumn}
									to={{
										table: relation.targetTableName,
										column: relation.targetColumn
									}}
									hue={
										hueById.get(idByName.get(relation.targetTableName) ?? '') ??
										null
									}
									onClick={() =>
										goTo(relation.targetTableName, relation.targetColumn)
									}
								/>
							))
						) : (
							<p className='sv-none'>Points to no other table.</p>
						)}
					</Section>
					<Section title='Referenced by' count={tableRelations.incoming.length}>
						{tableRelations.incoming.length > 0 ? (
							tableRelations.incoming.map((relation) => (
								<RelationRow
									key={`${relation.sourceTableName}.${relation.sourceColumn}->${relation.targetColumn}`}
									direction='in'
									from={relation.targetColumn}
									to={{
										table: relation.sourceTableName,
										column: relation.sourceColumn
									}}
									hue={
										hueById.get(idByName.get(relation.sourceTableName) ?? '') ??
										null
									}
									onClick={() =>
										goTo(relation.sourceTableName, relation.sourceColumn)
									}
								/>
							))
						) : (
							<p className='sv-none'>No table points here.</p>
						)}
					</Section>
					<Section title='Checks' count={checks.length}>
						{checks.length > 0 ? (
							checks.map((check) => (
								<CheckCard
									key={check.title}
									check={check}
									onClick={
										check.column
											? () => {
													onFocusColumnChange(check.column ?? null)
													onTabChange('columns')
												}
											: undefined
									}
								/>
							))
						) : (
							<CheckCard
								check={{
									level: 'ok',
									title: 'Looks healthy',
									body: 'Primary key set and every foreign key is indexed.'
								}}
							/>
						)}
					</Section>
				</>
			)}

			{tab === 'columns' && (
				<Section title='Columns' count={table.columns.length}>
					{table.columns.map((column) => {
						const isOpen = focusColumn === column.name
						return (
							<div key={column.name}>
								<button
									type='button'
									className={cn('sv-crow', isOpen && 'is-open')}
									aria-expanded={isOpen}
									onClick={() => onFocusColumnChange(isOpen ? null : column.name)}
								>
									<ColumnGlyph
										table={table}
										column={column}
										hue={table.referenceHues[column.name] ?? null}
									/>
									<span className='sv-crow__name'>{column.name}</span>
									<span className='sv-crow__type'>
										{column.data_type}
										{column.is_nullable && (
											<span className='sv-nullable'>?</span>
										)}
									</span>
									<ChevronDown className='sv-crow__chev h-3 w-3' />
								</button>
								{isOpen && (
									<ColumnDetail
										table={table}
										column={column}
										onShowColumn={onShowColumn}
									/>
								)}
							</div>
						)
					})}
				</Section>
			)}

			{tab === 'code' && (
				<section className='sv-sec'>
					<div className='sv-code-head'>
						<div className='sv-seg sv-seg--sm' role='radiogroup' aria-label='Language'>
							{(['sql', 'drizzle'] as const).map((language) => (
								<button
									key={language}
									type='button'
									role='radio'
									aria-checked={codeLanguage === language}
									className={cn(codeLanguage === language && 'is-active')}
									onClick={() => setCodeLanguage(language)}
								>
									{language === 'sql' ? 'SQL' : 'Drizzle'}
								</button>
							))}
						</div>
						<button
							type='button'
							className='sv-btn sv-btn--sm'
							onClick={() =>
								onCopy(
									codeSource(),
									codeLanguage === 'sql' ? 'SQL' : 'Drizzle schema'
								)
							}
						>
							<Copy className='h-[13px] w-[13px]' />
							Copy
						</button>
					</div>
					<pre className='sv-code'>
						<code>
							{renderHighlightedCode(
								codeSource(),
								codeLanguage === 'sql' ? SQL_KEYWORDS : TS_KEYWORDS
							)}
						</code>
					</pre>
				</section>
			)}
		</>
	)
}

export function SchemaDetailsPanel(props: Props) {
	const { table, ...rest } = props
	return (
		<aside className='sv-details' aria-label='Details'>
			{table ? (
				<SelectedTable key={table.tableId} table={table} {...rest} />
			) : (
				<SchemaOverview {...rest} />
			)}
		</aside>
	)
}
