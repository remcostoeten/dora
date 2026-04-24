import {
	Code2,
	Database,
	Download,
	FileImage,
	FileText,
	PanelRightClose,
	Table2,
} from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/utils/cn'
import type { TableNodeData } from '../hooks/use-schema-graph'

type Props = {
	table: TableNodeData
	onClose: () => void
	onOpenTable: () => void
	onExportSvg: () => void
	onExportPng: () => void
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
	'default',
	'export',
	'from',
	'import',
	'integer',
	'notNull',
	'numeric',
	'primaryKey',
	'references',
	'serial',
	'text',
	'timestamp',
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
	onExportSvg,
	onExportPng,
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
					<div className='truncate text-sm font-medium text-sidebar-foreground'>
						{table.tableName}
					</div>
					<div className='truncate text-[11px] text-muted-foreground'>
						{table.schema || 'default'} schema
					</div>
				</div>
				<Button
					variant='ghost'
					size='icon'
					className='h-7 w-7'
					aria-label='Close details'
					onClick={onClose}
				>
					<PanelRightClose className='h-3.5 w-3.5' />
				</Button>
			</div>

			<div className='sv-details-panel__stats'>
				<div>
					<span>{table.columns.length}</span>
					Columns
				</div>
				<div>
					<span>{primaryKeys.length}</span>
					Primary
				</div>
				<div>
					<span>{foreignKeys.length}</span>
					Foreign
				</div>
			</div>

			<div className='sv-details-panel__section'>
				<Button className='w-full justify-start gap-2' variant='secondary' onClick={onOpenTable}>
					<Table2 className='h-4 w-4' />
					Go to table view
				</Button>
				<Button className='w-full justify-start gap-2' variant='ghost' onClick={onOpenTable}>
					<Database className='h-4 w-4' />
					View data
				</Button>
			</div>

			<div className='sv-details-panel__section'>
				<div className='sv-details-panel__label'>Export</div>
				<div className='sv-details-panel__actions-grid'>
					<Button className='justify-start gap-2' variant='ghost' onClick={onExportSvg}>
						<FileImage className='h-4 w-4' />
						SVG
					</Button>
					<Button className='justify-start gap-2' variant='ghost' onClick={onExportPng}>
						<Download className='h-4 w-4' />
						PNG
					</Button>
					<Button className='justify-start gap-2' variant='ghost' onClick={onExportSql}>
						<FileText className='h-4 w-4' />
						SQL
					</Button>
					<Button className='justify-start gap-2' variant='ghost' onClick={onExportDrizzle}>
						<Code2 className='h-4 w-4' />
						Drizzle
					</Button>
				</div>
			</div>

			<div className='sv-details-panel__section'>
				<div className='sv-details-panel__code-header'>
					<span>SQL</span>
					<Button size='sm' variant='ghost' className='h-6 px-2 text-[11px]' onClick={onCopySql}>
						Copy
					</Button>
				</div>
				<pre className='sv-details-panel__code sv-details-panel__code--sql'>
					<code>{renderHighlightedCode(sqlSource || 'Loading schema...', SQL_KEYWORDS)}</code>
				</pre>
				<div className='sv-details-panel__code-header'>
					<span>Drizzle</span>
					<Button size='sm' variant='ghost' className='h-6 px-2 text-[11px]' onClick={onCopyDrizzle}>
						Copy
					</Button>
				</div>
				<pre className='sv-details-panel__code sv-details-panel__code--ts'>
					<code>{renderHighlightedCode(drizzleSource, TS_KEYWORDS)}</code>
				</pre>
			</div>

			<div className='sv-details-panel__section'>
				<div className='sv-details-panel__label'>Columns</div>
				<div className='sv-details-panel__columns'>
					{table.columns.map((column) => (
						<button
							key={column.name}
							className={cn(
								'sv-details-panel__column',
								selectedColumn?.name === column.name && 'sv-details-panel__column--active',
							)}
							onClick={() => setSelectedColumnName(column.name)}
						>
							<span className='truncate'>{column.name}</span>
							<span>{column.data_type}</span>
						</button>
					))}
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
		</aside>
	)
}
