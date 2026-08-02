import { useEffect, useMemo, useState } from 'react'
import { Braces, ChevronDown, ChevronUp, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@studio/shared/ui/button'
import { Input } from '@studio/shared/ui/input'
import { cn } from '@studio/shared/utils/cn'
import { prettyString } from './kv-utils'
import type { KvValue } from './types'

type Props = {
	value: KvValue
	isSaving?: boolean
	onSave: (value: KvValue) => void
	onLoadMore?: () => void
}

const textAreaClass =
	'min-h-44 w-full resize-none rounded-md border border-input bg-background/40 p-3 font-mono text-xs leading-5 outline-none focus-visible:ring-1 focus-visible:ring-ring'

export function ValueEditor({ value, isSaving, onSave, onLoadMore }: Props) {
	const [draft, setDraft] = useState(value)
	const [showPretty, setShowPretty] = useState(false)

	useEffect(
		function resetDraft() {
			setDraft(value)
			setShowPretty(false)
		},
		[value]
	)

	const formatted = useMemo(
		function () {
			return draft.type === 'string' ? prettyString(draft.value) : null
		},
		[draft]
	)

	function updateCollection(index: number, field: string, nextValue: string) {
		if (draft.type === 'hash') {
			const entries = draft.entries.map(function (entry, entryIndex) {
				return entryIndex === index ? { ...entry, [field]: nextValue } : entry
			})
			setDraft({ ...draft, entries })
		} else if (draft.type === 'zset') {
			const members = draft.members.map(function (member, memberIndex) {
				if (memberIndex !== index) return member
				return field === 'score'
					? { ...member, score: Number(nextValue) || 0 }
					: { ...member, member: nextValue }
			})
			setDraft({ ...draft, members })
		} else {
			const fieldName = draft.type === 'list' ? 'items' : 'members'
			const items = [...draft[fieldName]]
			items[index] = nextValue
			setDraft({ ...draft, [fieldName]: items })
		}
	}

	function removeRow(index: number) {
		if (draft.type === 'hash') {
			setDraft({
				...draft,
				entries: draft.entries.filter((_, itemIndex) => itemIndex !== index)
			})
		} else if (draft.type === 'zset') {
			setDraft({
				...draft,
				members: draft.members.filter((_, itemIndex) => itemIndex !== index)
			})
		} else {
			const fieldName = draft.type === 'list' ? 'items' : 'members'
			setDraft({
				...draft,
				[fieldName]: draft[fieldName].filter((_, itemIndex) => itemIndex !== index)
			})
		}
	}

	function moveListItem(index: number, direction: -1 | 1) {
		if (draft.type !== 'list') return
		const nextIndex = index + direction
		if (nextIndex < 0 || nextIndex >= draft.items.length) return
		const items = [...draft.items]
		const item = items[index]
		items[index] = items[nextIndex]
		items[nextIndex] = item
		setDraft({ ...draft, items })
	}

	function addRow() {
		if (draft.type === 'hash')
			setDraft({ ...draft, entries: [...draft.entries, { field: '', value: '' }] })
		else if (draft.type === 'zset')
			setDraft({ ...draft, members: [...draft.members, { member: '', score: 0 }] })
		else if (draft.type === 'list') setDraft({ ...draft, items: [...draft.items, ''] })
		else if (draft.type === 'set') setDraft({ ...draft, members: [...draft.members, ''] })
	}

	const collection =
		draft.type === 'hash'
			? draft.entries
			: draft.type === 'list'
				? draft.items
				: draft.type === 'set' || draft.type === 'zset'
					? draft.members
					: null

	return (
		<div className='flex min-h-0 flex-1 flex-col gap-3'>
			{draft.type === 'string' ? (
				<>
					<div className='flex justify-end'>
						<Button
							variant='ghost'
							size='sm'
							disabled={!formatted}
							onClick={() => setShowPretty(!showPretty)}
						>
							<Braces /> {showPretty ? 'Edit raw' : 'Pretty JSON'}
						</Button>
					</div>
					<textarea
						aria-label='String value'
						className={textAreaClass}
						readOnly={showPretty}
						value={showPretty ? (formatted ?? draft.value) : draft.value}
						onChange={(event) => setDraft({ ...draft, value: event.target.value })}
					/>
				</>
			) : (
				<div className='min-h-0 overflow-auto rounded-md border border-border/70'>
					<div className='sticky top-0 z-10 grid grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)_2.5rem] border-b bg-muted/90 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground backdrop-blur'>
						<span>#</span>
						<span>
							{draft.type === 'hash'
								? 'Field'
								: draft.type === 'zset'
									? 'Member'
									: 'Value'}
						</span>
						<span>
							{draft.type === 'hash' ? 'Value' : draft.type === 'zset' ? 'Score' : ''}
						</span>
						<span />
					</div>
					{collection?.map(function (item, index) {
						const primary =
							typeof item === 'string'
								? item
								: 'field' in item
									? item.field
									: item.member
						const secondary =
							typeof item === 'string'
								? null
								: 'field' in item
									? item.value
									: String(item.score)
						return (
							<div
								key={`${index}-${primary}`}
								className='group grid grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)_2.5rem] items-center border-b border-border/50 px-2 py-1 last:border-0'
							>
								<div className='flex items-center gap-0.5 font-mono text-[10px] text-muted-foreground'>
									{draft.type === 'list' && (
										<span className='flex flex-col'>
											<button
												aria-label='Move up'
												disabled={index === 0}
												onClick={() => moveListItem(index, -1)}
											>
												<ChevronUp className='size-3' />
											</button>
											<button
												aria-label='Move down'
												disabled={index === collection.length - 1}
												onClick={() => moveListItem(index, 1)}
											>
												<ChevronDown className='size-3' />
											</button>
										</span>
									)}
									{index}
								</div>
								<Input
									className='h-7 border-transparent bg-transparent font-mono text-xs hover:border-input'
									value={primary}
									onChange={(event) =>
										updateCollection(
											index,
											draft.type === 'hash' ? 'field' : 'member',
											event.target.value
										)
									}
								/>
								{secondary === null ? (
									<span />
								) : (
									<Input
										className='h-7 border-transparent bg-transparent font-mono text-xs hover:border-input'
										value={secondary}
										onChange={(event) =>
											updateCollection(
												index,
												draft.type === 'zset' ? 'score' : 'value',
												event.target.value
											)
										}
									/>
								)}
								<Button
									aria-label='Remove row'
									variant='ghost'
									size='icon-sm'
									className='opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
									onClick={() => removeRow(index)}
								>
									<Trash2 />
								</Button>
							</div>
						)
					})}
					<Button variant='ghost' size='sm' className='m-1' onClick={addRow}>
						<Plus /> Add {draft.type === 'hash' ? 'field' : 'member'}
					</Button>
				</div>
			)}

			{value.truncated && (
				<div className='flex items-center justify-between rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground'>
					<span>Large value preview. More data is available.</span>
					<Button variant='outline' size='sm' onClick={onLoadMore}>
						Load more
					</Button>
				</div>
			)}

			<div className='flex justify-end border-t pt-3'>
				<Button
					size='sm'
					disabled={isSaving}
					onClick={() => onSave(draft)}
					className={cn(isSaving && 'animate-pulse')}
				>
					<Save /> {isSaving ? 'Saving…' : 'Save value'}
				</Button>
			</div>
		</div>
	)
}
