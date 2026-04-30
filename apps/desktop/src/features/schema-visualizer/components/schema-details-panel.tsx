import {
	Code2,
	Database,
	FileText,
	KeyRound,
	Link2,
	ListTree,
	PanelRightClose,
	Table2,
} from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { cn } from '@/shared/utils/cn'
import type { TableNodeData } from '../hooks/use-schema-graph'

type Props = {
	table: TableNodeData
	onClose: () => void
	onOpenTable: () => void
	onExportSql: () => void
	onExportDrizzle: () => void
	sqlSource: string
	drizzleSource: string
	onCopySql: () => void
	onCopyDrizzle: () => void
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
	'varchar',
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
	'varchar',
])

function renderHighlightedCode(source: string, keywords: Set<string>) {
	const lines = source.split('\n')
	return lines.map((line, lineIndex) => {
		const isComment = line.trimStart().startsWith('--') || line.trimStart().startsWith('//')
		const parts: ReactNode[] = isComment
			? [<span className='sv-code-token--comment' key='comment'>{line}</span>]
			: line
				.split(/(\b[\w]+\b|'[^']*'|"[^"]*"|`[^`]*`)/g)
				.map((part, partIndex) => {
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

export function SchemaDetailsPanel({
	table,
	onClose,
	onOpenTable,
	onExportSql,
	onExportDrizzle,
	sqlSource,
	drizzleSource,
	onCopySql,
	onCopyDrizzle,
}: Props) {
	const [selectedColumnName, setSelectedColumnName] = useState<string | null>(null)
	const primaryKeys = table.columns.filter((column) =>
		table.primaryKeyColumns.includes(column.name) || column.is_primary_key
	)
	const foreignKeys = table.columns.filter((column) => column.foreign_key)
	const indexedColumnsCount = table.columns.filter((column) =>
		table.primaryKeyColumns.includes(column.name) ||
		table.indexes?.some((index) => index.column_names.includes(column.name)),
	).length
	const nullableColumnsCount = table.columns.filter((column) => column.is_nullable).length
	const selectedColumn = useMemo(
		() =>
			table.columns.find((column) => column.name === selectedColumnName) ??
			table.columns[0] ??
			null,
		[table.columns, selectedColumnName],
	)
	const selectedColumnTips = useMemo(() => {
		if (!selectedColumn) return []
		const indexed = table.primaryKeyColumns.includes(selectedColumn.name) ||
			table.indexes?.some((index) => index.column_names.includes(selectedColumn.name))
		const tips: string[] = []
		if (selectedColumn.foreign_key && !indexed) {
			tips.push('Foreign key not indexed. Joins and deletes may be slower.')
		}
		if (selectedColumn.foreign_key && selectedColumn.is_nullable) {
			tips.push('Nullable relationship. Treat joins as optional.')
		}
		if (primaryKeys.length === 0) {
			tips.push('Table has no primary key.')
		}
		if (tips.length === 0) {
			tips.push('No obvious index or relationship warning.')
		}
		return tips
	}, [primaryKeys.length, selectedColumn, table.indexes, table.primaryKeyColumns])

	return (
		<aside className='sv-details-panel'>
			<div className='sv-details-panel__header'>
				<div className='min-w-0'>
					<div className='sv-details-panel__eyebrow'>
						<span>{table.schema || 'default'} schema</span>
						<span>{table.columns.length} columns</span>
					</div>
					<div className='truncate text-base font-semibold text-sidebar-foreground'>
						{table.tableName}
					</div>
					<div className='truncate text-[12px] text-muted-foreground'>
						Inspect structure, relationships, and generated schema output.
					</div>
				</div>
				<Button
					variant='ghost'
					size='icon'
					className='h-7 w-7 shrink-0'
					aria-label='Close details'
					onClick={onClose}
				>
					<PanelRightClose className='h-3.5 w-3.5' />
				</Button>
			</div>

			<div className='sv-details-panel__hero'>
				<div className='sv-details-panel__stats'>
					<div>
						<span>{primaryKeys.length}</span>
						Primary keys
					</div>
					<div>
						<span>{foreignKeys.length}</span>
						Relationships
					</div>
					<div>
						<span>{indexedColumnsCount}</span>
						Indexed
					</div>
				</div>
				<div className='sv-details-panel__hero-actions'>
					<Button
						className='sv-details-panel__hero-action sv-details-panel__hero-action--primary justify-start gap-2'
						variant='secondary'
						onClick={onOpenTable}
					>
						<Table2 className='h-4 w-4' />
						Open table
					</Button>
					<Button
						className='sv-details-panel__hero-action justify-start gap-2'
						variant='ghost'
						onClick={onExportSql}
					>
						<FileText className='h-4 w-4' />
						SQL
					</Button>
					<Button
						className='sv-details-panel__hero-action justify-start gap-2'
						variant='ghost'
						onClick={onExportDrizzle}
					>
						<Code2 className='h-4 w-4' />
						Drizzle
					</Button>
				</div>
			</div>

			<Tabs defaultValue='overview' className='sv-details-panel__tabs'>
				<TabsList className='sv-details-panel__tabs-list'>
					<TabsTrigger value='overview' className='sv-details-panel__tabs-trigger'>
						Overview
					</TabsTrigger>
					<TabsTrigger value='columns' className='sv-details-panel__tabs-trigger'>
						Columns
					</TabsTrigger>
					<TabsTrigger value='code' className='sv-details-panel__tabs-trigger'>
						Code
					</TabsTrigger>
				</TabsList>

				<TabsContent value='overview' className='sv-details-panel__tab-content'>
					<div className='sv-details-panel__section'>
						<div className='sv-details-panel__label'>Quick read</div>
						<div className='sv-details-panel__facts'>
							<div>
								<KeyRound className='h-3.5 w-3.5' />
								<span>{primaryKeys.length} primary key columns</span>
							</div>
							<div>
								<Link2 className='h-3.5 w-3.5' />
								<span>{foreignKeys.length} foreign key links</span>
							</div>
							<div>
								<ListTree className='h-3.5 w-3.5' />
								<span>{nullableColumnsCount} nullable columns</span>
							</div>
							<div>
								<Database className='h-3.5 w-3.5' />
								<span>{table.indexes?.length ?? 0} indexes defined</span>
							</div>
						</div>
					</div>
					<div className='sv-details-panel__section'>
						<div className='sv-details-panel__label'>Column focus</div>
						<div className='sv-details-panel__columns'>
							{table.columns.map((column) => {
								const isPrimaryKey =
									table.primaryKeyColumns.includes(column.name) || column.is_primary_key
								const isForeignKey = Boolean(column.foreign_key)
								return (
									<button
										key={column.name}
										className={cn(
											'sv-details-panel__column',
											selectedColumn?.name === column.name &&
												'sv-details-panel__column--active',
										)}
										onClick={() => setSelectedColumnName(column.name)}
									>
										<div className='sv-details-panel__column-main'>
											<span
												className={cn(
													'sv-details-panel__column-badge',
													isPrimaryKey && 'sv-details-panel__column-badge--pk',
													!isPrimaryKey &&
														isForeignKey &&
														'sv-details-panel__column-badge--fk',
												)}
											>
												{isPrimaryKey ? 'PK' : isForeignKey ? 'FK' : 'COL'}
											</span>
											<span className='truncate'>{column.name}</span>
										</div>
										<span>{column.data_type}</span>
									</button>
								)
							})}
						</div>
						{selectedColumn && (
							<div className='sv-details-panel__tips'>
								<div className='font-mono text-[11px] text-sidebar-foreground'>
									{selectedColumn.name}
								</div>
								{selectedColumnTips.map((tip) => (
									<div key={tip}>{tip}</div>
								))}
							</div>
						)}
					</div>
				</TabsContent>

				<TabsContent value='columns' className='sv-details-panel__tab-content'>
					<div className='sv-details-panel__section'>
						<div className='sv-details-panel__label'>Column inventory</div>
						<div className='sv-details-panel__columns'>
							{table.columns.map((column) => {
								const isPrimaryKey =
									table.primaryKeyColumns.includes(column.name) || column.is_primary_key
								const isForeignKey = Boolean(column.foreign_key)
								return (
									<button
										key={column.name}
										className={cn(
											'sv-details-panel__column',
											selectedColumn?.name === column.name &&
												'sv-details-panel__column--active',
										)}
										onClick={() => setSelectedColumnName(column.name)}
									>
										<div className='sv-details-panel__column-main'>
											<span
												className={cn(
													'sv-details-panel__column-badge',
													isPrimaryKey && 'sv-details-panel__column-badge--pk',
													!isPrimaryKey &&
														isForeignKey &&
														'sv-details-panel__column-badge--fk',
												)}
											>
												{isPrimaryKey ? 'PK' : isForeignKey ? 'FK' : 'COL'}
											</span>
											<div className='min-w-0'>
												<div className='truncate text-sidebar-foreground'>{column.name}</div>
												<div className='truncate text-[10px] text-muted-foreground'>
													{column.is_nullable ? 'Nullable' : 'Required'}
													{column.foreign_key
														? ` • references ${column.foreign_key.referenced_table}.${column.foreign_key.referenced_column}`
														: ''}
												</div>
											</div>
										</div>
										<span>{column.data_type}</span>
									</button>
								)
							})}
						</div>
					</div>
				</TabsContent>

				<TabsContent value='code' className='sv-details-panel__tab-content'>
					<div className='sv-details-panel__section'>
						<div className='sv-details-panel__code-header'>
							<span>SQL</span>
							<div className='flex items-center gap-1'>
								<Button
									size='sm'
									variant='ghost'
									className='h-6 px-2 text-[11px]'
									onClick={onExportSql}
								>
									Export
								</Button>
								<Button
									size='sm'
									variant='ghost'
									className='h-6 px-2 text-[11px]'
									onClick={onCopySql}
								>
									Copy
								</Button>
							</div>
						</div>
						<pre className='sv-details-panel__code sv-details-panel__code--sql'>
							<code>{renderHighlightedCode(sqlSource || 'Loading schema...', SQL_KEYWORDS)}</code>
						</pre>
					</div>
					<div className='sv-details-panel__section'>
						<div className='sv-details-panel__code-header'>
							<span>Drizzle</span>
							<div className='flex items-center gap-1'>
								<Button
									size='sm'
									variant='ghost'
									className='h-6 px-2 text-[11px]'
									onClick={onExportDrizzle}
								>
									Export
								</Button>
								<Button
									size='sm'
									variant='ghost'
									className='h-6 px-2 text-[11px]'
									onClick={onCopyDrizzle}
								>
									Copy
								</Button>
							</div>
						</div>
						<pre className='sv-details-panel__code sv-details-panel__code--ts'>
							<code>{renderHighlightedCode(drizzleSource, TS_KEYWORDS)}</code>
						</pre>
					</div>
				</TabsContent>
			</Tabs>
		</aside>
	)
}
