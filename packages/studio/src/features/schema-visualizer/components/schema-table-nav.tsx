import type { Node } from '@xyflow/react'
import { Table2 } from 'lucide-react'
import { memo, type CSSProperties } from 'react'
import { cn } from '@studio/shared/utils/cn'
import type { SchemaGroup, TableNodeData } from '../hooks/use-schema-graph'

type Props = {
	groups: SchemaGroup[]
	nodes: Node<TableNodeData>[]
	activeTableId: string | null
	isSearching: boolean
	search: string
	onSelect: (tableId: string) => void
}

function SchemaTableNavInner({
	groups,
	nodes,
	activeTableId,
	isSearching,
	search,
	onSelect
}: Props) {
	const byId = new Map(nodes.map((node) => [node.id, node.data]))
	const visibleGroups = groups
		.map((group) => ({
			group,
			tables: group.tableIds
				.map((id) => byId.get(id))
				.filter((table): table is TableNodeData =>
					Boolean(table && (!isSearching || table.searchState === 'match'))
				)
		}))
		.filter((entry) => entry.tables.length > 0)
	const visibleCount = visibleGroups.reduce((sum, entry) => sum + entry.tables.length, 0)

	return (
		<aside className='sv-nav' aria-label='Tables'>
			<div className='sv-nav__head'>
				<span className='sv-eyebrow'>Tables</span>
				<span className='sv-nav__count'>
					{isSearching ? `${visibleCount} of ${nodes.length}` : nodes.length}
				</span>
			</div>
			<div className='sv-nav__list'>
				{visibleGroups.map(({ group, tables }) => (
					<div key={group.id}>
						{groups.length > 1 && (
							<div className='sv-nav__group'>
								<span className={cn('sv-dot', group.hue && `sv-bg-${group.hue}`)} />
								<span className='truncate'>{group.label}</span>
								<span className='sv-nav__group-count'>{tables.length}</span>
							</div>
						)}
						{tables.map((table) => {
							const isActive = table.tableId === activeTableId
							const matched = isSearching ? table.matchedColumns : []
							return (
								<button
									key={table.tableId}
									type='button'
									className={cn(
										'sv-nav__item',
										isActive && 'sv-nav__item--active'
									)}
									style={
										table.hue
											? ({
													'--sv-icon-color': `var(--sv-${table.hue})`
												} as CSSProperties)
											: undefined
									}
									title={table.tableName}
									onClick={() => onSelect(table.tableId)}
								>
									<span className='sv-icon-box sv-icon-box--sm sv-nav__icon'>
										<Table2 className='h-[11px] w-[11px]' />
									</span>
									<span className='sv-nav__body'>
										<span className='sv-nav__name'>{table.tableName}</span>
										{matched.length > 0 && (
											<span className='sv-nav__sub'>
												{matched.slice(0, 3).join(', ')}
												{matched.length > 3
													? ` +${matched.length - 3}`
													: ''}
											</span>
										)}
									</span>
									<span
										className='sv-nav__cols'
										title={`${table.columns.length} columns`}
									>
										{table.columns.length}
									</span>
								</button>
							)
						})}
					</div>
				))}
				{isSearching && visibleCount === 0 && (
					<div className='sv-nav__empty'>Nothing matches “{search.trim()}”.</div>
				)}
			</div>
		</aside>
	)
}

export const SchemaTableNav = memo(SchemaTableNavInner)
