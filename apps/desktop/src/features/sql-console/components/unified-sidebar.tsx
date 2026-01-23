import { Search, Table2, Eye, ChevronRight, ChevronDown, Key, Hash, Type, Calendar, ToggleLeft, Copy, Database, FileText, FolderPlus, FilePlus, FileCode, Folder, Edit2, Trash2, Wand2 } from "lucide-react";
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Button } from "@/shared/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator, ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent } from "@/shared/ui/context-menu";
import { Input } from "@/shared/ui/input";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { cn } from "@/shared/utils/cn";
import { TableInfo, SqlSnippet } from "../types";

type Props = {
	tables: TableInfo[]
	snippets: SqlSnippet[]
	activeSnippetId: string | null
	onTableSelect?: (tableName: string) => void
	onInsertQuery?: (query: string) => void
	onSnippetSelect: (id: string) => void
	onNewSnippet: (parentId?: string | null) => void
	onNewFolder: (parentId?: string | null) => void
	onRenameSnippet: (id: string, newName: string) => void
	onDeleteSnippet: (id: string) => void
}

function ColumnIcon({ type, isPrimaryKey }: { type: string; isPrimaryKey?: boolean }) {
	if (isPrimaryKey) return <Key className='h-3 w-3 text-yellow-500/80' />
	if (type.includes('int') || type.includes('serial') || type.includes('decimal'))
		return <Hash className='h-3 w-3 text-blue-400' />
	if (type.includes('char') || type.includes('text'))
		return <Type className='h-3 w-3 text-green-400' />
	if (type.includes('date') || type.includes('time'))
		return <Calendar className='h-3 w-3 text-orange-400' />
	if (type.includes('bool')) return <ToggleLeft className='h-3 w-3 text-purple-400' />
	return <div className='h-3 w-3 rounded-full bg-slate-500/30' />
}

export function UnifiedSidebar({
	tables,
	snippets,
	activeSnippetId,
	onTableSelect,
	onInsertQuery,
	onSnippetSelect,
	onNewSnippet,
	onNewFolder,
	onRenameSnippet,
	onDeleteSnippet
}: Props) {
	const [activeTab, setActiveTab] = useState<'schema' | 'snippets'>('schema')
	const [schemaSearch, setSchemaSearch] = useState('')
	const [snippetSearch, setSnippetSearch] = useState('')
	const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())
	const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editValue, setEditValue] = useState('')
	const editInputRef = useRef<HTMLInputElement>(null)

	const copyToClipboard = useCallback(function (text: string) {
		navigator.clipboard.writeText(text)
	}, [])

	const toggleTable = function (tableName: string) {
		const next = new Set(expandedTables)
		if (next.has(tableName)) {
			next.delete(tableName)
		} else {
			next.add(tableName)
		}
		setExpandedTables(next)
	}

	const toggleFolder = function (id: string) {
		setExpandedFolders(function (prev) {
			return { ...prev, [id]: !prev[id] }
		})
	}

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
			if (editingId && editInputRef.current) {
				editInputRef.current.focus()
				editInputRef.current.select()
			}
		},
		[editingId]
	)

	const filteredTables = tables.filter(function (t) {
		return t.name.toLowerCase().includes(schemaSearch.toLowerCase())
	})

	const snippetTree = useMemo(
		function () {
			function buildTree(parentId: string | null): SqlSnippet[] {
				return snippets
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
		[snippets]
	)

	function renderSnippetNode(node: SqlSnippet, depth: number) {
		const isExpanded = expandedFolders[node.id]
		const children = snippets.filter(function (s) {
			return s.parentId === node.id
		})
		const isActive = activeSnippetId === node.id
		const isEditing = editingId === node.id

		return (
			<ContextMenu key={node.id}>
				<ContextMenuTrigger>
					<div>
						<button
							className={cn(
								'group flex items-center gap-1.5 w-full px-2 py-1 text-sm text-left transition-colors hover:bg-sidebar-accent/50',
								isActive && !node.isFolder
									? 'bg-sidebar-accent text-sidebar-foreground border-r-2 border-primary'
									: 'text-muted-foreground hover:text-sidebar-foreground'
							)}
							style={{ paddingLeft: `${depth * 12 + (node.isFolder ? 8 : 24)}px` }}
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
										<Folder className='h-3.5 w-3.5 text-blue-400/70 shrink-0' />
									</>
								) : (
									<FileCode className='h-3.5 w-3.5 shrink-0 opacity-70' />
								)}
								{isEditing ? (
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
										className='h-6 py-0 px-1 text-xs bg-sidebar-accent border-primary'
										onClick={function (e) {
											e.stopPropagation()
										}}
									/>
								) : (
									<span className='truncate'>{node.name}</span>
								)}
							</div>
						</button>
						{node.isFolder &&
							isExpanded &&
							children.map(function (child) {
								return renderSnippetNode(child, depth + 1)
							})}
					</div>
				</ContextMenuTrigger>
				<ContextMenuContent>
					<ContextMenuItem
						onClick={function () {
							startRenaming(node)
						}}
					>
						<Edit2 className='h-3.5 w-3.5' />
						Rename
					</ContextMenuItem>
					{node.isFolder && (
						<>
							<ContextMenuItem
								onClick={function () {
									onNewSnippet(node.id)
								}}
							>
								<FilePlus className='h-3.5 w-3.5' />
								New Snippet
							</ContextMenuItem>
							<ContextMenuItem
								onClick={function () {
									onNewFolder(node.id)
								}}
							>
								<FolderPlus className='h-3.5 w-3.5' />
								New Folder
							</ContextMenuItem>
						</>
					)}
					<ContextMenuSeparator />
					<ContextMenuItem
						className='text-destructive focus:text-destructive'
						onClick={function () {
							onDeleteSnippet(node.id)
						}}
					>
						<Trash2 className='h-3.5 w-3.5' />
						Delete
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>
		)
	}

	return (
		<div className='flex flex-col h-full w-full border-r border-sidebar-border bg-sidebar overflow-hidden'>
			<div className='flex border-b border-sidebar-border shrink-0'>
				<button
					onClick={function () {
						setActiveTab('schema')
					}}
					className={cn(
						'flex-1 px-3 py-2 text-xs font-medium transition-all border-b-2',
						activeTab === 'schema'
							? 'border-primary text-foreground'
							: 'border-transparent text-muted-foreground hover:text-foreground'
					)}
				>
					Schema
				</button>
				<button
					onClick={function () {
						setActiveTab('snippets')
					}}
					className={cn(
						'flex-1 px-3 py-2 text-xs font-medium transition-all border-b-2',
						activeTab === 'snippets'
							? 'border-primary text-foreground'
							: 'border-transparent text-muted-foreground hover:text-foreground'
					)}
				>
					Snippets
				</button>
			</div>

			{activeTab === 'schema' && (
				<>
					<div className='p-2 border-b border-sidebar-border shrink-0'>
						<div className='relative'>
							<Search className='absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/70' />
							<Input
								placeholder='Search tables...'
								value={schemaSearch}
								onChange={function (e) {
									setSchemaSearch(e.target.value)
								}}
								className='h-7 bg-transparent border-sidebar-border/60 text-xs pl-7'
							/>
						</div>
					</div>
					<ScrollArea className='flex-1'>
						<div className='py-1'>
							{filteredTables.map(function (table) {
								const isExpanded = expandedTables.has(table.name)
								const hasColumns = table.columns && table.columns.length > 0

								return (
									<div key={table.name} className='flex flex-col'>
										<ContextMenu>
											<ContextMenuTrigger>
												<div className='flex items-center group w-full px-2 py-1 hover:bg-sidebar-accent/50 transition-colors'>
													<button
														onClick={function () {
															toggleTable(table.name)
														}}
														className={cn(
															'p-0.5 rounded-sm hover:bg-sidebar-accent mr-1 transition-transform',
															!hasColumns &&
																'opacity-0 pointer-events-none'
														)}
													>
														{isExpanded ? (
															<ChevronDown className='h-3 w-3 text-muted-foreground' />
														) : (
															<ChevronRight className='h-3 w-3 text-muted-foreground' />
														)}
													</button>
													<button
														className='flex-1 flex items-center gap-2 text-sm text-left overflow-hidden'
														onClick={function () {
															onTableSelect?.(table.name)
														}}
													>
														{table.type === 'view' ? (
															<Eye className='h-4 w-4 text-muted-foreground shrink-0' />
														) : (
															<Table2 className='h-4 w-4 text-muted-foreground shrink-0' />
														)}
														<span className='truncate text-sidebar-foreground'>
															{table.name}
														</span>
													</button>
													<span className='text-[10px] text-muted-foreground tabular-nums ml-2'>
														{table.rowCount}
													</span>
												</div>
											</ContextMenuTrigger>
											<ContextMenuContent>
												<ContextMenuSub>
													<ContextMenuSubTrigger>
														<Wand2 className='h-3.5 w-3.5' />
														Operations
													</ContextMenuSubTrigger>
													<ContextMenuSubContent>
														<ContextMenuItem
															onClick={function () {
																onInsertQuery?.(
																	`SELECT * FROM ${table.name} LIMIT 100;`
																)
															}}
														>
															<Database className='h-3.5 w-3.5' />
															SELECT * FROM {table.name}
														</ContextMenuItem>
														<ContextMenuItem
															onClick={function () {
																onInsertQuery?.(
																	`SELECT COUNT(*) FROM ${table.name};`
																)
															}}
														>
															<FileText className='h-3.5 w-3.5' />
															COUNT rows
														</ContextMenuItem>
														<ContextMenuItem
															onClick={function () {
																onInsertQuery?.(
																	`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${table.name}';`
																)
															}}
														>
															<FileText className='h-3.5 w-3.5' />
															DESCRIBE table
														</ContextMenuItem>
													</ContextMenuSubContent>
												</ContextMenuSub>
												<ContextMenuSeparator />
												<ContextMenuItem
													onClick={function () {
														copyToClipboard(table.name)
													}}
												>
													<Copy className='h-3.5 w-3.5' />
													Copy table name
												</ContextMenuItem>
											</ContextMenuContent>
										</ContextMenu>

										{isExpanded && hasColumns && (
											<div className='pl-9 pb-1 space-y-0.5 relative'>
												<div className='absolute left-[19px] top-0 bottom-2 w-px bg-border/40' />
												{table.columns?.map(function (col) {
													return (
														<ContextMenu
															key={`${table.name}-${col.name}`}
														>
															<ContextMenuTrigger>
																<div
																	className='flex items-center gap-2 px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/30 rounded-sm cursor-pointer'
																	title={`${col.name} (${col.type})`}
																>
																	<ColumnIcon
																		type={col.type}
																		isPrimaryKey={
																			col.primaryKey
																		}
																	/>
																	<span
																		className={cn(
																			'truncate',
																			col.primaryKey &&
																				'font-medium text-foreground'
																		)}
																	>
																		{col.name}
																	</span>
																	<span className='text-[10px] text-muted-foreground/50 ml-auto font-mono'>
																		{col.type}
																	</span>
																</div>
															</ContextMenuTrigger>
															<ContextMenuContent>
																<ContextMenuItem
																	onClick={function () {
																		onInsertQuery?.(col.name)
																	}}
																>
																	<FileText className='h-3.5 w-3.5' />
																	Insert column name
																</ContextMenuItem>
																<ContextMenuItem
																	onClick={function () {
																		onInsertQuery?.(
																			`SELECT ${col.name} FROM ${table.name} LIMIT 100;`
																		)
																	}}
																>
																	<Database className='h-3.5 w-3.5' />
																	SELECT {col.name}
																</ContextMenuItem>
																<ContextMenuSeparator />
																<ContextMenuItem
																	onClick={function () {
																		copyToClipboard(col.name)
																	}}
																>
																	<Copy className='h-3.5 w-3.5' />
																	Copy column name
																</ContextMenuItem>
															</ContextMenuContent>
														</ContextMenu>
													)
												})}
											</div>
										)}
									</div>
								)
							})}
						</div>
					</ScrollArea>
				</>
			)}

			{activeTab === 'snippets' && (
				<>
					<div className='flex items-center justify-between gap-1 p-2 border-b border-sidebar-border shrink-0'>
						<span className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 px-1'>
							Library
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
							{snippetTree.map(function (node) {
								return renderSnippetNode(node, 0)
							})}
						</div>
					</ScrollArea>
				</>
			)}
		</div>
	)
}
