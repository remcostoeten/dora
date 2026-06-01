import { Database, Move, Network, ScanSearch, SplitSquareVertical } from 'lucide-react'
import { cn } from '@studio/shared/utils/cn'
import type { TableNodeData } from '../hooks/use-schema-graph'

type Props = {
	tableCount: number
	edgeCount: number
	schemaCount: number
	relatedTableCount: number
	isSearchResult: boolean
	editMode: boolean
	showMinimap: boolean
	selectedTable: TableNodeData | null
}

export function SchemaOverviewPanel({
	tableCount,
	edgeCount,
	schemaCount,
	relatedTableCount,
	isSearchResult,
	editMode,
	showMinimap,
	selectedTable,
}: Props) {
	return (
		<aside className='sv-overview-panel'>
			<div className='sv-overview-panel__eyebrow'>Schema</div>
			<div className='sv-overview-panel__heading'>
				<div>
					<h2>{isSearchResult ? 'Filtered map' : 'Full map'}</h2>
					<p>{tableCount} tables, {edgeCount} relationships</p>
				</div>
				<span
					className={cn(
						'sv-overview-panel__mode-badge',
						isSearchResult && 'sv-overview-panel__mode-badge--search',
					)}
				>
					{isSearchResult ? 'Filtered map' : 'Full map'}
				</span>
			</div>

			<div className='sv-overview-panel__stats'>
				<div className='sv-overview-panel__stat'>
					<div className='sv-overview-panel__stat-label'>Tables</div>
					<div className='sv-overview-panel__stat-value'>{tableCount}</div>
				</div>
				<div className='sv-overview-panel__stat'>
					<div className='sv-overview-panel__stat-label'>Relationships</div>
					<div className='sv-overview-panel__stat-value'>{edgeCount}</div>
				</div>
				<div className='sv-overview-panel__stat'>
					<div className='sv-overview-panel__stat-label'>Schemas</div>
					<div className='sv-overview-panel__stat-value'>{schemaCount}</div>
				</div>
			</div>

			<div className='sv-overview-panel__stack'>
				<div className='sv-overview-panel__card'>
					<div className='sv-overview-panel__card-label'>Selected table</div>
					{selectedTable ? (
						<>
							<div className='sv-overview-panel__card-title'>{selectedTable.tableName}</div>
							<div className='sv-overview-panel__card-copy'>
								{selectedTable.columns.length} columns
								{selectedTable.schema ? ` in ${selectedTable.schema}` : ''}
							</div>
						</>
					) : (
						<>
							<div className='sv-overview-panel__card-title'>None</div>
							<div className='sv-overview-panel__card-copy'>No table selected</div>
						</>
					)}
				</div>

				<div className='sv-overview-panel__card'>
					<div className='sv-overview-panel__card-label'>State</div>
					<div className='sv-overview-panel__modes'>
						<span className={cn(editMode && 'is-active')}>
							<Move className='h-3.5 w-3.5' />
							{editMode ? 'Edit layout' : 'Read only'}
						</span>
						<span className={cn(showMinimap && 'is-active')}>
							<SplitSquareVertical className='h-3.5 w-3.5' />
							{showMinimap ? 'Minimap' : 'No minimap'}
						</span>
						<span className={cn(isSearchResult && 'is-active')}>
							<ScanSearch className='h-3.5 w-3.5' />
							{isSearchResult
								? `${relatedTableCount} related tables in view`
								: 'Search to narrow the map'}
						</span>
					</div>
				</div>

				<div className='sv-overview-panel__card'>
					<div className='sv-overview-panel__card-label'>Legend</div>
					<div className='sv-overview-panel__legend'>
						<span>
							<Database className='h-3.5 w-3.5' />
							Table
						</span>
						<span>
							<Network className='h-3.5 w-3.5' />
							Relationship
						</span>
					</div>
				</div>
			</div>
		</aside>
	)
}
