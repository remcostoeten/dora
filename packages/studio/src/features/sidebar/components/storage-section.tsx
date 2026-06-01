import { invoke } from '@tauri-apps/api/core'
import { Database, FolderOpen, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@studio/shared/ui/button'
import { Input } from '@studio/shared/ui/input'
import { SidebarSection } from './sidebar-panel'

type DatabaseInfo = {
	name: string
	path: string
	active: boolean
}

async function callCmd<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
	return invoke<T>(cmd, args)
}

export function StorageSection() {
	const [dbs, setDbs] = useState<DatabaseInfo[]>([])
	const [activePath, setActivePath] = useState('')
	const [loading, setLoading] = useState(false)
	const [switching, setSwitching] = useState('')
	const [showAdd, setShowAdd] = useState<'register' | 'create' | null>(null)
	const [newName, setNewName] = useState('')
	const [newPath, setNewPath] = useState('')
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [resetting, setResetting] = useState(false)
	const [confirmReset, setConfirmReset] = useState(false)

	const load = useCallback(async function load() {
		setLoading(true)
		setError(null)
		try {
			const [list, path] = await Promise.all([
				callCmd<DatabaseInfo[]>('list_databases'),
				callCmd<string>('get_active_storage_path')
			])
			setDbs(list)
			setActivePath(path)
		} catch (e) {
			setError(String(e))
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(
		function loadOnMount() {
			load()
		},
		[load]
	)

	async function handleSwitch(name: string) {
		if (switching) return
		setSwitching(name)
		setError(null)
		try {
			await callCmd('switch_storage', { name })
			await load()
		} catch (e) {
			setError(String(e))
		} finally {
			setSwitching('')
		}
	}

	async function handleSave() {
		if (!newName.trim() || !newPath.trim()) return
		setSaving(true)
		setError(null)
		try {
			const cmd = showAdd === 'create' ? 'create_database' : 'register_database'
			await callCmd(cmd, { name: newName.trim(), path: newPath.trim() })
			setNewName('')
			setNewPath('')
			setShowAdd(null)
			await load()
		} catch (e) {
			setError(String(e))
		} finally {
			setSaving(false)
		}
	}

	async function handleReset() {
		if (!confirmReset) {
			setConfirmReset(true)
			return
		}
		setResetting(true)
		setError(null)
		try {
			await callCmd('reset_storage')
			await load()
			setConfirmReset(false)
		} catch (e) {
			setError(String(e))
		} finally {
			setResetting(false)
		}
	}

	const active = dbs.find((db) => db.active)

	return (
		<SidebarSection title='Storage'>
			<div className='space-y-3'>
				{activePath && (
					<div className='space-y-1'>
						<div className='text-xs text-muted-foreground'>Active path</div>
						<div className='rounded-sm bg-sidebar-accent/30 px-2 py-1 font-mono text-xs text-sidebar-foreground break-all'>
							{activePath}
						</div>
					</div>
				)}

				{dbs.length > 0 && (
					<div className='space-y-1'>
						<div className='text-xs text-muted-foreground'>Databases</div>
						{dbs.map(function (db) {
							return (
								<div
									key={db.name}
									className='flex items-center gap-2 rounded-sm px-1 py-1 hover:bg-sidebar-accent/30'
								>
									<Database className='h-3 w-3 shrink-0 text-muted-foreground' />
									<div className='flex-1 min-w-0'>
										<div className='text-sm text-sidebar-foreground truncate'>
											{db.name}
										</div>
										<div className='text-xs text-muted-foreground truncate'>
											{db.path}
										</div>
									</div>
									{db.active ? (
										<span className='text-xs text-green-500 shrink-0'>
											active
										</span>
									) : (
										<Button
											variant='ghost'
											size='sm'
											className='h-6 px-2 text-xs shrink-0'
											disabled={!!switching}
											onClick={function () {
												handleSwitch(db.name)
											}}
										>
											{switching === db.name ? (
												<RefreshCw className='h-3 w-3 animate-spin' />
											) : (
												'Switch'
											)}
										</Button>
									)}
								</div>
							)
						})}
					</div>
				)}

				{loading && <div className='text-xs text-muted-foreground'>Loading…</div>}

				{error && <div className='text-xs text-destructive break-all'>{error}</div>}

				{showAdd && (
					<div className='space-y-2 pt-1'>
						<div className='text-xs font-medium text-sidebar-foreground'>
							{showAdd === 'create'
								? 'Create new database'
								: 'Register existing database'}
						</div>
						<Input
							className='h-7 text-xs'
							placeholder='Name (e.g. work)'
							value={newName}
							onChange={function (e) {
								setNewName(e.target.value)
							}}
						/>
						<Input
							className='h-7 text-xs font-mono'
							placeholder='Path (e.g. ~/dbs/work.db)'
							value={newPath}
							onChange={function (e) {
								setNewPath(e.target.value)
							}}
						/>
						<div className='flex gap-2'>
							<Button
								size='sm'
								className='h-7 text-xs flex-1'
								disabled={saving || !newName.trim() || !newPath.trim()}
								onClick={handleSave}
							>
								{saving ? <RefreshCw className='h-3 w-3 animate-spin' /> : 'Save'}
							</Button>
							<Button
								variant='ghost'
								size='sm'
								className='h-7 text-xs'
								onClick={function () {
									setShowAdd(null)
									setNewName('')
									setNewPath('')
									setError(null)
								}}
							>
								Cancel
							</Button>
						</div>
					</div>
				)}

				{!showAdd && (
					<div className='flex gap-2 pt-1'>
						<Button
							variant='outline'
							size='sm'
							className='h-7 text-xs flex-1'
							onClick={function () {
								setShowAdd('create')
								setError(null)
							}}
						>
							<Plus className='h-3 w-3 mr-1' />
							New
						</Button>
						<Button
							variant='outline'
							size='sm'
							className='h-7 text-xs flex-1'
							onClick={function () {
								setShowAdd('register')
								setError(null)
							}}
						>
							<FolderOpen className='h-3 w-3 mr-1' />
							Register
						</Button>
					</div>
				)}

				<div className='pt-1 border-t border-sidebar-border'>
					<Button
						variant='ghost'
						size='sm'
						className='h-7 text-xs w-full text-destructive hover:text-destructive hover:bg-destructive/10'
						disabled={resetting}
						onClick={handleReset}
					>
						{resetting ? (
							<RefreshCw className='h-3 w-3 animate-spin mr-1' />
						) : (
							<Trash2 className='h-3 w-3 mr-1' />
						)}
						{confirmReset
							? 'Confirm reset — all data will be deleted'
							: 'Reset database'}
					</Button>
					{confirmReset && !resetting && (
						<Button
							variant='ghost'
							size='sm'
							className='h-7 text-xs w-full mt-1'
							onClick={function () {
								setConfirmReset(false)
							}}
						>
							Cancel
						</Button>
					)}
				</div>
			</div>
		</SidebarSection>
	)
}
