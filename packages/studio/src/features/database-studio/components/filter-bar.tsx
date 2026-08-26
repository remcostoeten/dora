import { X, Plus, Trash2, ChevronDown, FolderPlus } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { Button } from '@studio/shared/ui/button'
import { Input } from '@studio/shared/ui/input'
import { cn } from '@studio/shared/utils/cn'
import { buildWhereClauseFromGroup } from '@studio/core/data-provider/filter-sql'
import {
	ColumnDefinition,
	FilterCondition,
	FilterConjunction,
	FilterGroup,
	FilterOperator,
	isFilterGroup
} from '../types'

type Props = {
	group: FilterGroup
	onGroupChange: (group: FilterGroup) => void
	columns: ColumnDefinition[]
	isVisible: boolean
}

const OPERATOR_OPTIONS: Array<{ value: FilterOperator; label: string }> = [
	{ value: 'eq', label: 'equals' },
	{ value: 'neq', label: 'not equal' },
	{ value: 'gt', label: 'greater than' },
	{ value: 'lt', label: 'less than' },
	{ value: 'gte', label: 'greater or equal' },
	{ value: 'lte', label: 'less or equal' },
	{ value: 'contains', label: 'contains' },
	{ value: 'ilike', label: 'ilike' }
]

/** Immutably replaces a child at `index` within a group's conditions. */
function withChildReplaced(
	group: FilterGroup,
	index: number,
	child: FilterCondition | FilterGroup
): FilterGroup {
	const conditions = group.conditions.slice()
	conditions[index] = child
	return { ...group, conditions }
}

/** Immutably removes a child at `index` from a group's conditions. */
function withChildRemoved(group: FilterGroup, index: number): FilterGroup {
	const conditions = group.conditions.slice()
	conditions.splice(index, 1)
	return { ...group, conditions }
}

function makeCondition(columns: ColumnDefinition[]): FilterCondition {
	return {
		column: columns.length > 0 ? columns[0].name : '',
		operator: 'eq',
		value: ''
	}
}

function OperatorSelect({
	value,
	onChange
}: {
	value: FilterOperator
	onChange: (op: FilterOperator) => void
}) {
	return (
		<div className='relative'>
			<select
				className='h-6 text-xs bg-background border border-sidebar-border rounded px-2 w-[120px] appearance-none transition-colors duration-150 focus-visible:bg-focus cursor-pointer'
				value={value}
				onChange={(e) => onChange(e.target.value as FilterOperator)}
			>
				{OPERATOR_OPTIONS.map((o) => (
					<option key={o.value} value={o.value}>
						{o.label}
					</option>
				))}
			</select>
			<div className='absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground'>
				<ChevronDown className='h-3 w-3' />
			</div>
		</div>
	)
}

function ColumnSelect({
	value,
	columns,
	onChange
}: {
	value: string
	columns: ColumnDefinition[]
	onChange: (column: string) => void
}) {
	return (
		<div className='relative'>
			<select
				className='h-6 text-xs bg-background border border-sidebar-border rounded px-2 min-w-[120px] appearance-none transition-colors duration-150 focus-visible:bg-focus cursor-pointer'
				value={value}
				onChange={(e) => onChange(e.target.value)}
			>
				{columns.map((col) => (
					<option key={col.name} value={col.name}>
						{col.name}
					</option>
				))}
			</select>
			<div className='absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground'>
				<ChevronDown className='h-3 w-3' />
			</div>
		</div>
	)
}

/** AND/OR toggle for a group. */
function LogicToggle({
	logic,
	onToggle
}: {
	logic: FilterConjunction
	onToggle: () => void
}) {
	return (
		<button
			type='button'
			onClick={onToggle}
			title={`Joining conditions with ${logic}. Click to switch to ${logic === 'AND' ? 'OR' : 'AND'}.`}
			className='text-[10px] uppercase text-primary font-bold w-10 text-center tracking-wider rounded border border-primary/20 bg-primary/5 hover:bg-primary/15 transition-colors'
		>
			{logic}
		</button>
	)
}

function ConditionRow({
	condition,
	columns,
	prefix,
	onChange,
	onRemove
}: {
	condition: FilterCondition
	columns: ColumnDefinition[]
	prefix: React.ReactNode
	onChange: (next: FilterCondition) => void
	onRemove: () => void
}) {
	return (
		<div className='flex items-center gap-2 px-2 h-9 group bg-sidebar-accent/5 hover:bg-sidebar-accent/20 transition-colors rounded'>
			<Button
				variant='ghost'
				size='icon'
				className='h-5 w-5 text-muted-foreground hover:text-destructive opacity-50 group-hover:opacity-100 transition-opacity'
				onClick={onRemove}
			>
				<X className='h-3 w-3' />
			</Button>

			<div className='w-10 flex justify-center'>{prefix}</div>

			<div className='flex items-center gap-2 text-xs flex-1'>
				<ColumnSelect
					value={condition.column}
					columns={columns}
					onChange={(column) => onChange({ ...condition, column })}
				/>
				<OperatorSelect
					value={condition.operator}
					onChange={(operator) => onChange({ ...condition, operator })}
				/>
				<Input
					className='h-6 text-xs w-[200px]'
					placeholder='Value...'
					value={String(condition.value ?? '')}
					onChange={(e) => onChange({ ...condition, value: e.target.value })}
				/>
			</div>
		</div>
	)
}

/**
 * Renders a filter group and its children. `depth` controls nesting; nested
 * groups (depth >= 1) cannot add further groups (one-level nesting only).
 */
function GroupEditor({
	group,
	columns,
	depth,
	onChange,
	onRemove
}: {
	group: FilterGroup
	columns: ColumnDefinition[]
	depth: number
	onChange: (next: FilterGroup) => void
	onRemove?: () => void
}) {
	function setLogic(logic: FilterConjunction) {
		onChange({ ...group, logic })
	}

	function addCondition() {
		onChange({ ...group, conditions: [...group.conditions, makeCondition(columns)] })
	}

	function addGroup() {
		const child: FilterGroup = { logic: 'AND', conditions: [makeCondition(columns)] }
		onChange({ ...group, conditions: [...group.conditions, child] })
	}

	const isRoot = depth === 0

	return (
		<div
			className={cn(
				'flex flex-col gap-1',
				!isRoot && 'rounded border border-primary/20 bg-sidebar-accent/10 p-1.5 ml-10'
			)}
		>
			{!isRoot && (
				<div className='flex items-center gap-2 px-1'>
					<span className='text-[10px] uppercase text-muted-foreground font-bold tracking-wider'>
						Group
					</span>
					<LogicToggle logic={group.logic} onToggle={() => setLogic(group.logic === 'AND' ? 'OR' : 'AND')} />
					{onRemove && (
						<Button
							variant='ghost'
							size='icon'
							className='h-5 w-5 text-muted-foreground hover:text-destructive ml-auto'
							onClick={onRemove}
							title='Remove group'
						>
							<Trash2 className='h-3 w-3' />
						</Button>
					)}
				</div>
			)}

			{group.conditions.map((child, index) => {
				const prefix =
					index === 0 ? (
						isRoot ? (
							<span className='text-[10px] uppercase text-muted-foreground font-bold tracking-wider select-none'>
								WHERE
							</span>
						) : null
					) : (
						<LogicToggle
							logic={group.logic}
							onToggle={() => setLogic(group.logic === 'AND' ? 'OR' : 'AND')}
						/>
					)

				if (isFilterGroup(child)) {
					return (
						<GroupEditor
							key={index}
							group={child}
							columns={columns}
							depth={depth + 1}
							onChange={(next) => onChange(withChildReplaced(group, index, next))}
							onRemove={() => onChange(withChildRemoved(group, index))}
						/>
					)
				}

				return (
					<ConditionRow
						key={index}
						condition={child}
						columns={columns}
						prefix={prefix}
						onChange={(next) => onChange(withChildReplaced(group, index, next))}
						onRemove={() => onChange(withChildRemoved(group, index))}
					/>
				)
			})}

			<div className='flex items-center px-2 h-8 gap-2'>
				<Button
					variant='ghost'
					size='sm'
					className='h-6 px-2 text-xs text-muted-foreground hover:text-sidebar-foreground gap-1.5'
					onClick={addCondition}
				>
					<Plus className='h-3 w-3' />
					Add condition
				</Button>
				{isRoot && (
					<Button
						variant='ghost'
						size='sm'
						className='h-6 px-2 text-xs text-muted-foreground hover:text-sidebar-foreground gap-1.5'
						onClick={addGroup}
					>
						<FolderPlus className='h-3 w-3' />
						Add group
					</Button>
				)}
			</div>
		</div>
	)
}

export function FilterBar({ group, onGroupChange, columns, isVisible }: Props) {
	const [newFilterColumn, setNewFilterColumn] = useState('')
	const valueInputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		if (columns.length > 0 && !newFilterColumn) {
			setNewFilterColumn(columns[0].name)
		}
	}, [columns, newFilterColumn])

	if (!isVisible) return null

	const wherePreview = buildWhereClauseFromGroup(group)
	const hasConditions = group.conditions.length > 0

	return (
		<div className='flex flex-col border-b border-sidebar-border bg-sidebar-accent/10 p-1.5 gap-1.5'>
			<GroupEditor group={group} columns={columns} depth={0} onChange={onGroupChange} />

			<div className='flex items-center gap-2 px-2'>
				<div className='flex-1 min-w-0'>
					{hasConditions && (
						<div className='text-[10px] font-mono text-muted-foreground truncate'>
							<span className='uppercase tracking-wider text-primary/70 mr-1'>WHERE</span>
							<span className='text-foreground/80'>{wherePreview || '—'}</span>
						</div>
					)}
				</div>
				{hasConditions && (
					<Button
						variant='ghost'
						size='sm'
						className='h-6 px-2 text-xs text-muted-foreground hover:text-destructive gap-1.5'
						onClick={() => onGroupChange({ logic: 'AND', conditions: [] })}
					>
						<Trash2 className='h-3 w-3' />
						Clear filters
					</Button>
				)}
			</div>
		</div>
	)
}
