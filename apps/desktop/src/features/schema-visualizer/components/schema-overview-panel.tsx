import { Database, Move, ScanSearch, SplitSquareVertical } from 'lucide-react'
import { cn } from '@/shared/utils/cn'
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
			<div className='sv-overview-panel__eyebrow'>Schema visualizer</div>
			<div className='sv-overview-panel__heading'>
				<div>
					<h2>Structure first</h2>
					<p>
						Trace tables, follow relationships, then drill into one table when you
						need detail.
					</p>
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
					<div className='sv-overview-panel__card-label'>Focus</div>
					{selectedTable ? (
						<>
							<div className='sv-overview-panel__card-title'>{selectedTable.tableName}</div>
							<div className='sv-overview-panel__card-copy'>
								{selectedTable.columns.length} columns
								{selectedTable.schema ? ` in ${selectedTable.schema}` : ''}
								{selectedTable.matchedColumns.length > 0
									? ` • ${selectedTable.matchedColumns.length} column matches`
									: ''}
							</div>
						</>
					) : (
						<>
							<div className='sv-overview-panel__card-title'>Select a table</div>
							<div className='sv-overview-panel__card-copy'>
								Use the graph for breadth, then open the inspector for depth.
							</div>
						</>
					)}
				</div>

				<div className='sv-overview-panel__card'>
					<div className='sv-overview-panel__card-label'>Working mode</div>
					<div className='sv-overview-panel__modes'>
						<span className={cn(editMode && 'is-active')}>
							<Move className='h-3.5 w-3.5' />
							{editMode ? 'Drag layout on' : 'Drag layout off'}
						</span>
						<span className={cn(showMinimap && 'is-active')}>
							<SplitSquareVertical className='h-3.5 w-3.5' />
							{showMinimap ? 'Minimap visible' : 'Minimap hidden'}
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
					<div className='sv-overview-panel__card-label'>How to read this</div>
					<div className='sv-overview-panel__legend'>
						<span>
							<Database className='h-3.5 w-3.5' />
							Solid cards are tables.
						</span>
						<span>Search matches stay bright, related tables stay nearby, everything else steps back.</span>
						<span>Use edit mode only when you want to curate a layout, not when you are scanning.</span>
					</div>
				</div>
			</div>
		</aside>
	)
}
