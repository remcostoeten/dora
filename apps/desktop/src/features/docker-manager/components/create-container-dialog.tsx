import { RefreshCw, Loader2, Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import {
	POSTGRES_VERSIONS,
	DEFAULT_POSTGRES_VERSION,
	DEFAULT_POSTGRES_USER,
	DEFAULT_POSTGRES_PASSWORD,
	DEFAULT_POSTGRES_DATABASE
} from '../constants'
import type { PostgresContainerConfig, DockerContainer } from '../types'
import {
	suggestContainerName,
	validateContainerName,
	generateVolumeName
} from '../utilities/container-naming'
import { findFreePort } from '../utilities/port-utils'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible'

type Props = {
	open: boolean
	onOpenChange: (open: boolean) => void
	onSubmit: (config: PostgresContainerConfig) => void
	existingContainers: DockerContainer[]
	isSubmitting?: boolean
}

export function CreateContainerDialog({
	open,
	onOpenChange,
	onSubmit,
	existingContainers,
	isSubmitting = false
}: Props) {
	const [name, setName] = useState('')
	const [postgresVersion, setPostgresVersion] = useState(DEFAULT_POSTGRES_VERSION)
	const [hostPort, setHostPort] = useState(5433)
	const [user, setUser] = useState(DEFAULT_POSTGRES_USER)
	const [password, setPassword] = useState(DEFAULT_POSTGRES_PASSWORD)
	const [database, setDatabase] = useState(DEFAULT_POSTGRES_DATABASE)
	const [ephemeral, setEphemeral] = useState(true)
	const [showPassword, setShowPassword] = useState(false)
	const [isFindingPort, setIsFindingPort] = useState(false)
	const [nameError, setNameError] = useState<string | null>(null)

	const [cpuLimit, setCpuLimit] = useState<number | undefined>(undefined)
	const [memoryLimit, setMemoryLimit] = useState<number | undefined>(undefined)
	const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)

	useEffect(
		function initializeDefaults() {
			if (open) {
				const existingNames = existingContainers.map(function (c) {
					return c.name
				})
				setName(suggestContainerName(existingNames))
				initFreePort()
			}
		},
		[open, existingContainers]
	)

	async function initFreePort() {
		setIsFindingPort(true)
		try {
			const port = await findFreePort()
			setHostPort(port)
		} catch {
			setHostPort(5433)
		} finally {
			setIsFindingPort(false)
		}
	}

	async function handleFindFreePort() {
		setIsFindingPort(true)
		try {
			const port = await findFreePort()
			setHostPort(port)
		} catch (error) {
			console.error('Failed to find free port:', error)
		} finally {
			setIsFindingPort(false)
		}
	}

	function handleNameChange(value: string) {
		setName(value)
		const validation = validateContainerName(value)
		setNameError(validation.valid ? null : validation.error || null)
	}

	function handleSubmit(event: React.FormEvent) {
		event.preventDefault()

		const validation = validateContainerName(name)
		if (!validation.valid) {
			setNameError(validation.error || 'Invalid container name')
			return
		}

		const config: PostgresContainerConfig = {
			name,
			postgresVersion,
			hostPort,
			user,
			password,
			database,
			ephemeral,
			volumeName: ephemeral ? undefined : generateVolumeName(name),
			cpuLimit,
			memoryLimitMb: memoryLimit
		}

		onOpenChange(false)
		resetForm()
		onSubmit(config)
	}

	function handleClose() {
		onOpenChange(false)
		resetForm()
	}

	function resetForm() {
		setName('')
		setPostgresVersion(DEFAULT_POSTGRES_VERSION)
		setHostPort(5433)
		setUser(DEFAULT_POSTGRES_USER)
		setPassword(DEFAULT_POSTGRES_PASSWORD)
		setDatabase(DEFAULT_POSTGRES_DATABASE)
		setEphemeral(true)
		setShowPassword(false)
		setNameError(null)
		setCpuLimit(undefined)
		setMemoryLimit(undefined)
		setIsAdvancedOpen(false)
	}

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className='sm:max-w-md'>
				<DialogHeader>
					<DialogTitle>Create PostgreSQL Container</DialogTitle>
					<DialogDescription>
						Configure a new PostgreSQL container for local development.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className='space-y-4'>
					<div className='space-y-2'>
						<Label htmlFor='name'>Container Name</Label>
						<Input
							id='name'
							value={name}
							onChange={function (e) {
								handleNameChange(e.target.value)
							}}
							placeholder='my_database'
						/>
						{nameError && <p className='text-xs text-destructive'>{nameError}</p>}
						<p className='text-xs text-muted-foreground'>Use lowercase letters, numbers, `_` or `-`.</p>
					</div>

					<div className='space-y-2'>
						<Label htmlFor='version'>PostgreSQL Version</Label>
						<Select value={postgresVersion} onValueChange={setPostgresVersion}>
							<SelectTrigger id='version'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{POSTGRES_VERSIONS.map(function (version) {
									return (
										<SelectItem key={version.value} value={version.value}>
											{version.label}
										</SelectItem>
									)
								})}
							</SelectContent>
						</Select>
					</div>

					<div className='space-y-2'>
						<Label htmlFor='port'>Host Port</Label>
						<div className='flex gap-2'>
							<Input
								id='port'
								type='number'
								min={1024}
								max={65535}
								value={hostPort}
								onChange={function (e) {
									setHostPort(parseInt(e.target.value, 10) || 5433)
								}}
								className='flex-1'
							/>
							<Button
								type='button'
								variant='outline'
								size='icon'
								aria-label='Find free port'
								onClick={handleFindFreePort}
								disabled={isFindingPort}
							>
								<RefreshCw
									className={`h-4 w-4 ${isFindingPort ? 'animate-spin' : ''}`}
								/>
							</Button>
						</div>
						<p className='text-xs text-muted-foreground'>Auto-detected free port</p>
					</div>

					<div className='grid grid-cols-2 gap-4'>
						<div className='space-y-2'>
							<Label htmlFor='user'>Username</Label>
							<Input
								id='user'
								value={user}
								onChange={function (e) {
									setUser(e.target.value)
								}}
							/>
						</div>

						<div className='space-y-2'>
							<Label htmlFor='password'>Password</Label>
							<div className='relative'>
								<Input
									id='password'
									type={showPassword ? 'text' : 'password'}
									value={password}
									onChange={function (e) {
										setPassword(e.target.value)
									}}
									className='pr-9'
								/>
								<button
									type='button'
									aria-label={showPassword ? 'Hide password' : 'Show password'}
									onClick={function () {
										setShowPassword(function (p) {
											return !p
										})
									}}
									className='absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
								>
									{showPassword ? (
										<EyeOff className='h-4 w-4' />
									) : (
										<Eye className='h-4 w-4' />
									)}
								</button>
							</div>
						</div>
					</div>

					<div className='space-y-2'>
						<Label htmlFor='database'>Database Name</Label>
						<Input
							id='database'
							value={database}
							onChange={function (e) {
								setDatabase(e.target.value)
							}}
						/>
					</div>

					<div className='flex items-center justify-between py-2'>
						<div>
							<Label htmlFor='ephemeral' className='text-sm font-medium'>
								Ephemeral Storage
							</Label>
							<p className='text-xs text-muted-foreground'>
								Data will be lost when container is removed
							</p>
						</div>
						<Switch id='ephemeral' checked={ephemeral} onCheckedChange={setEphemeral} />
					</div>

					{!ephemeral && (
						<p className='text-xs text-muted-foreground px-2 py-1.5 bg-muted/50 rounded'>
							Volume: {generateVolumeName(name || 'container')}
						</p>
					)}

					<Collapsible
						open={isAdvancedOpen}
						onOpenChange={setIsAdvancedOpen}
						className='space-y-2'
					>
						<CollapsibleTrigger asChild>
							<Button
								variant='ghost'
								size='sm'
								className='p-0 h-auto hover:bg-transparent text-muted-foreground hover:text-foreground flex items-center gap-1'
							>
								{isAdvancedOpen ? (
									<ChevronDown className='h-4 w-4' />
								) : (
									<ChevronRight className='h-4 w-4' />
								)}
								Advanced Options
							</Button>
						</CollapsibleTrigger>
						<CollapsibleContent className='space-y-4 pt-2'>
							<div className='grid grid-cols-2 gap-4'>
								<div className='space-y-2'>
									<Label htmlFor='cpu'>CPU Limit (cores)</Label>
									<Input
										id='cpu'
										type='number'
										step='0.1'
										min='0.1'
										placeholder='e.g. 1.0'
										value={cpuLimit ?? ''}
										onChange={(e) =>
											setCpuLimit(
												e.target.value
													? parseFloat(e.target.value)
													: undefined
											)
										}
									/>
								</div>
								<div className='space-y-2'>
									<Label htmlFor='memory'>Memory Limit (MB)</Label>
									<Input
										id='memory'
										type='number'
										min='64'
										placeholder='e.g. 512'
										value={memoryLimit ?? ''}
										onChange={(e) =>
											setMemoryLimit(
												e.target.value
													? parseInt(e.target.value)
													: undefined
											)
										}
									/>
								</div>
							</div>
						</CollapsibleContent>
					</Collapsible>

					<DialogFooter>
						<Button
							type='button'
							variant='outline'
							onClick={handleClose}
						>
							Cancel
						</Button>
						<Button type='submit' disabled={isSubmitting || Boolean(nameError)}>
							{isSubmitting ? (
								<>
									<Loader2 className='mr-2 h-4 w-4 animate-spin' />
									Creating...
								</>
							) : (
								'Create Container'
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
