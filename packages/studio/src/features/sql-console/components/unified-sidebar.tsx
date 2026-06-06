import {
	Search,
	ChevronRight,
	FolderPlus,
	FilePlus,
	FileCode,
	Folder,
	Edit2,
	Trash2
} from 'lucide-react'
import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Button } from '@studio/shared/ui/button'
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
	ContextMenuSeparator
} from '@studio/shared/ui/context-menu'
import { Input } from '@studio/shared/ui/input'
import { ScrollArea } from '@studio/shared/ui/scroll-area'
import { cn } from '@studio/shared/utils/cn'
import { SqlSnippet } from '../types'

type Props = {
	snippets: SqlSnippet[]
	activeSnippetId: string | null
	onSnippetSelect: (id: string) => void
	onNewSnippet: (parentId?: string | null) => void
	onNewFolder: (parentId?: string | null) => void
	onRenameSnippet: (id: string, newName: string) => void
	onDeleteSnippet: (id: string) => void
	autoExpandFolder?: string | null
	onAutoExpandDone?: () => void
}

export function UnifiedSidebar({
	snippets,
	activeSnippetId,
	onSnippetSelect,
	onNewSnippet,
	onNewFolder,
	onRenameSnippet,
	onDeleteSnippet,
	autoExpandFolder,
	onAutoExpandDone
}: Props) {
	const [snippetSearch, setSnippetSearch] = useState('')
	const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editValue, setEditValue] = useState('')
	const editInputRef = useRef<HTMLInputElement>(null)
	const searchTerm = snippetSearch.trim().toLowerCase()

	const toggleFolder = useCallback(function (id: string) {
		setExpandedFolders(function (prev) {
			return { ...prev, [id]: !prev[id] }
		})
	}, [])

	const startRenaming = function (node: SqlSnippet) {
		setEditingId(node.id)
		setEditValue(node.name)
	}

	const handleRenameSubmit = function () {
		if (editingId && editValue.trim()) {
			onRenameSnippet(editingId, editValue.trim())
		}
		setEditingId(null)
	}

	useEffect(
		function () {
			if (editingId) {
				const t = setTimeout(function () {
					editInputRef.current?.focus()
					editInputRef.current?.select()
				}, 0)
				return function () {
					clearTimeout(t)
				}
			}
		},
		[editingId]
	)

	useEffect(() => {
		if (autoExpandFolder) {
			setExpandedFolders((prev) => ({ ...prev, [autoExpandFolder]: true }))
			onAutoExpandDone?.()
		}
	}, [autoExpandFolder, onAutoExpandDone])

	const visibleSnippets = useMemo(
		function () {
			if (!searchTerm) return snippets

			const byId = new Map(
				snippets.map(function (snippet) {
					return [snippet.id, snippet]
				})
			)
			const visibleIds = new Set<string>()

			for (const snippet of snippets) {
				if (!snippet.name.toLowerCase().includes(searchTerm)) continue

				let current: SqlSnippet | undefined = snippet
				while (current) {
					visibleIds.add(current.id)
					current = current.parentId ? byId.get(current.parentId) : undefined
				}
			}

			return snippets.filter(function (snippet) {
				return visibleIds.has(snippet.id)
			})
		},
		[snippets, searchTerm]
	)

	const snippetTree = useMemo(
		function () {
			function buildTree(parentId: string | null): SqlSnippet[] {
				return visibleSnippets
					.filter(function (s) {
						return s.parentId === parentId
					})
					.sort(function (a, b) {
						if (a.isFolder && !b.isFolder) return -1
						if (!a.isFolder && b.isFolder) return 1
						return a.name.localeCompare(b.name)
					})
			}
			return buildTree(null)
		},
		[visibleSnippets]
	)

	function renderSnippetNode(node: SqlSnippet, depth: number) {
		const isExpanded = expandedFolders[node.id] || Boolean(searchTerm)
		const children = visibleSnippets.filter(function (s) {
			return s.parentId === node.id
		})
		const isActive = activeSnippetId === node.id
		const isEditing = editingId === node.id
		const indent = depth * 12 + (node.isFolder ? 8 : 24)

		return (
			<ContextMenu key={node.id}>
				<ContextMenuTrigger>
					<div>
						{isEditing ? (
							<div
								className='flex items-center gap-1 w-full px-2 py-1'
								style={{ paddingLeft: `${indent}px` }}
							>
								{node.isFolder ? (
									<>
										<ChevronRight
											className={cn(
												'h-3.5 w-3.5 transition-transform shrink-0',
												isExpanded && 'rotate-90'
											)}
										/>
										<Folder className='h-3.5 w-3.5 text-muted-foreground/70 shrink-0' />
									</>
								) : (
									<FileCode className='h-3.5 w-3.5 shrink-0 opacity-70' />
								)}
								<Input
									ref={editInputRef}
									value={editValue}
									onChange={function (e) {
										setEditValue(e.target.value)
									}}
									onBlur={handleRenameSubmit}
									onKeyDown={function (e) {
										if (e.key === 'Enter') handleRenameSubmit()
										if (e.key === 'Escape') setEditingId(null)
									}}
									className='h-6 py-0 px-1 text-xs bg-sidebar-accent border-sidebar-border/60 focus-visible:ring-0 focus-visible:border-muted-foreground/40'
								/>
							</div>
						) : (
							<button
								className={cn(
									'group flex items-center gap-1.5 w-full px-2 py-1 text-sm text-left transition-colors hover:bg-sidebar-accent/50',
									isActive && !node.isFolder
										? 'bg-sidebar-accent text-sidebar-foreground border-r-2 border-primary'
										: 'text-muted-foreground hover:text-sidebar-foreground'
								)}
								style={{ paddingLeft: `${indent}px` }}
								onClick={function () {
									node.isFolder ? toggleFolder(node.id) : onSnippetSelect(node.id)
								}}
							>
								<div className='flex items-center gap-1 flex-1 min-w-0'>
									{node.isFolder ? (
										<>
											<ChevronRight
												className={cn(
													'h-3.5 w-3.5 transition-transform shrink-0',
													isExpanded && 'rotate-90'
												)}
											/>
											<Folder className='h-3.5 w-3.5 text-muted-foreground/70 shrink-0' />
										</>
									) : (
										<FileCode className='h-3.5 w-3.5 shrink-0 opacity-70' />
									)}
									<span className='truncate'>{node.name}</span>
								</div>
							</button>
						)}
						{node.isFolder &&
							isExpanded &&
							children.map(function (child) {
								return renderSnippetNode(child, depth + 1)
							})}
					</div>
				</ContextMenuTrigger>
				<ContextMenuContent>
					<ContextMenuItem onClick={function () { startRenaming(node) }}>
						<Edit2 className='size-3.5' />
						Rename
					</ContextMenuItem>
					{node.isFolder && (
						<>
							<ContextMenuItem onClick={function () { onNewSnippet(node.id) }}>
								<FilePlus className='size-3.5' />
								New Snippet
							</ContextMenuItem>
							<ContextMenuItem onClick={function () { onNewFolder(node.id) }}>
								<FolderPlus className='size-3.5' />
								New Folder
							</ContextMenuItem>
						</>
					)}
					<ContextMenuSeparator />
					<ContextMenuItem
						variant='destructive'
						onClick={function () { onDeleteSnippet(node.id) }}
					>
						<Trash2 className='size-3.5' />
						Delete
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>
		)
	}

	return (
		<div className='flex flex-col h-full w-full border-l border-sidebar-border bg-sidebar overflow-hidden'>
			<div className='flex items-center justify-between gap-1 p-2 border-b border-sidebar-border shrink-0'>
				<span className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 px-1'>
					Snippets
				</span>
				<div className='flex items-center gap-0.5'>
					<Button
						variant='ghost'
						size='icon'
						className='h-6 w-6 text-muted-foreground hover:text-sidebar-foreground'
						onClick={function () {
							onNewFolder(null)
						}}
						title='New folder'
					>
						<FolderPlus className='h-3.5 w-3.5' />
					</Button>
					<Button
						variant='ghost'
						size='icon'
						className='h-6 w-6 text-muted-foreground hover:text-sidebar-foreground'
						onClick={function () {
							onNewSnippet(null)
						}}
						title='New snippet'
					>
						<FilePlus className='h-3.5 w-3.5' />
					</Button>
				</div>
			</div>
			<div className='p-2 border-b border-sidebar-border shrink-0'>
				<div className='relative'>
					<Search className='absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/50' />
					<Input
						placeholder='Search snippets...'
						className='h-7 bg-transparent border-sidebar-border/60 text-xs pl-7'
						value={snippetSearch}
						onChange={function (e) {
							setSnippetSearch(e.target.value)
						}}
					/>
				</div>
			</div>
			<ScrollArea className='flex-1'>
				<div className='py-2'>
					{snippetTree.length === 0 ? (
						<div className='px-3 py-6 text-center text-xs text-muted-foreground/60'>
							{snippetSearch
								? 'No snippets match'
								: 'No snippets yet. Save a query to get started.'}
						</div>
					) : (
						snippetTree.map(function (node) {
							return renderSnippetNode(node, 0)
						})
					)}
				</div>
			</ScrollArea>
		</div>
	)
}
