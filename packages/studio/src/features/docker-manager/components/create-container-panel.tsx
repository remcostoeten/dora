import { Eye, EyeOff, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Spinner } from '@studio/shared/ui/spinner'
import { Switch } from '@studio/shared/ui/switch'
import { toast } from '@studio/shared/ui/notifier'
import {
	CONTAINER_TEMPLATES,
	DATABASE_PROVIDERS,
	POSTGRES_VERSIONS,
	MARIADB_VERSIONS,
	MYSQL_VERSIONS,
	COCKROACH_VERSIONS,
	REDIS_VERSIONS,
	VALKEY_VERSIONS,
	DEFAULT_POSTGRES_VERSION,
	DEFAULT_POSTGRES_USER,
	DEFAULT_POSTGRES_PASSWORD,
	DEFAULT_POSTGRES_DATABASE,
	DEFAULT_MARIADB_VERSION,
	DEFAULT_MARIADB_USER,
	DEFAULT_MARIADB_PASSWORD,
	DEFAULT_MARIADB_DATABASE,
	DEFAULT_MYSQL_VERSION,
	DEFAULT_MYSQL_USER,
	DEFAULT_MYSQL_PASSWORD,
	DEFAULT_MYSQL_DATABASE,
	DEFAULT_COCKROACH_VERSION,
	DEFAULT_COCKROACH_USER,
	DEFAULT_COCKROACH_DATABASE,
	DEFAULT_REDIS_VERSION,
	DEFAULT_VALKEY_VERSION,
	POSTGRES_IMAGE,
	MARIADB_IMAGE,
	MYSQL_IMAGE,
	COCKROACH_IMAGE,
	REDIS_IMAGE,
	VALKEY_IMAGE,
	POSTGRES_CONTAINER_PORT,
	MARIADB_CONTAINER_PORT,
	MYSQL_CONTAINER_PORT,
	COCKROACH_CONTAINER_PORT,
	REDIS_CONTAINER_PORT,
	VALKEY_CONTAINER_PORT
} from '../constants'
import type {
	DatabaseContainerBaseConfig,
	DatabaseContainerConfig,
	DatabaseProvider,
	DockerContainer
} from '../types'
import {
	suggestContainerName,
	validateContainerName,
	generateVolumeName
} from '../utilities/container-naming'
import { findFreePort } from '../utilities/port-utils'

const PROVIDER_SHORT_LABELS: Record<DatabaseProvider, string> = {
	postgres: 'Postgres',
	mariadb: 'MariaDB',
	mysql: 'MySQL',
	cockroach: 'Cockroach',
	redis: 'Redis',
	valkey: 'Valkey'
}

const PROVIDER_HINTS: Record<DatabaseProvider, string> = {
	postgres: 'PostgreSQL uses the selected credentials for the main database role.',
	mariadb: 'MariaDB uses the selected credentials for both the root and app user.',
	mysql: 'MySQL uses the selected credentials for the root and app user.',
	cockroach: 'CockroachDB is started as a local single-node cluster for quick testing.',
	redis: 'Redis uses append-only persistence for local development.',
	valkey: 'Valkey uses append-only persistence and supports Redis clients.'
}

const PROVIDER_IMAGES: Record<DatabaseProvider, string> = {
	postgres: POSTGRES_IMAGE,
	mariadb: MARIADB_IMAGE,
	mysql: MYSQL_IMAGE,
	cockroach: COCKROACH_IMAGE,
	redis: REDIS_IMAGE,
	valkey: VALKEY_IMAGE
}

const CONTAINER_PORTS: Record<DatabaseProvider, number> = {
	postgres: POSTGRES_CONTAINER_PORT,
	mariadb: MARIADB_CONTAINER_PORT,
	mysql: MYSQL_CONTAINER_PORT,
	cockroach: COCKROACH_CONTAINER_PORT,
	redis: REDIS_CONTAINER_PORT,
	valkey: VALKEY_CONTAINER_PORT
}

const CPU_OPTIONS = [0.5, 1, 2, 4]
const MEMORY_OPTIONS = [256, 512, 1024, 2048]

function isKeyValueProvider(provider: DatabaseProvider) {
	return provider === 'redis' || provider === 'valkey'
}

function getProviderDefaults(provider: DatabaseProvider) {
	switch (provider) {
		case 'redis':
			return {
				version: DEFAULT_REDIS_VERSION,
				user: '',
				password: '',
				database: '',
				port: 6379
			}
		case 'valkey':
			return {
				version: DEFAULT_VALKEY_VERSION,
				user: '',
				password: '',
				database: '',
				port: 6379
			}
		case 'mariadb':
			return {
				version: DEFAULT_MARIADB_VERSION,
				user: DEFAULT_MARIADB_USER,
				password: DEFAULT_MARIADB_PASSWORD,
				database: DEFAULT_MARIADB_DATABASE,
				port: 3306
			}
		case 'mysql':
			return {
				version: DEFAULT_MYSQL_VERSION,
				user: DEFAULT_MYSQL_USER,
				password: DEFAULT_MYSQL_PASSWORD,
				database: DEFAULT_MYSQL_DATABASE,
				port: 3306
			}
		case 'cockroach':
			return {
				version: DEFAULT_COCKROACH_VERSION,
				user: DEFAULT_COCKROACH_USER,
				password: '',
				database: DEFAULT_COCKROACH_DATABASE,
				port: 26257
			}
		case 'postgres':
		default:
			return {
				version: DEFAULT_POSTGRES_VERSION,
				user: DEFAULT_POSTGRES_USER,
				password: DEFAULT_POSTGRES_PASSWORD,
				database: DEFAULT_POSTGRES_DATABASE,
				port: 5433
			}
	}
}

function getVersionOptions(provider: DatabaseProvider) {
	switch (provider) {
		case 'redis':
			return REDIS_VERSIONS
		case 'valkey':
			return VALKEY_VERSIONS
		case 'mariadb':
			return MARIADB_VERSIONS
		case 'mysql':
			return MYSQL_VERSIONS
		case 'cockroach':
			return COCKROACH_VERSIONS
		case 'postgres':
		default:
			return POSTGRES_VERSIONS
	}
}

function formatMemory(megabytes: number) {
	return megabytes >= 1024 ? `${megabytes / 1024} GB` : `${megabytes} MB`
}

type Props = {
	onClose: () => void
	onSubmit: (config: DatabaseContainerConfig) => void
	existingContainers: DockerContainer[]
	isSubmitting?: boolean
	initialProvider?: DatabaseProvider
	initialVersion?: string
}

export function CreateContainerPanel({
	onClose,
	onSubmit,
	existingContainers,
	isSubmitting = false,
	initialProvider = 'postgres',
	initialVersion
}: Props) {
	const initialDefaults = getProviderDefaults(initialProvider)
	const [name, setName] = useState(() =>
		suggestContainerName(existingContainers.map((container) => container.name))
	)
	const [provider, setProvider] = useState<DatabaseProvider>(initialProvider)
	const [version, setVersion] = useState(initialVersion ?? initialDefaults.version)
	const [hostPort, setHostPort] = useState(initialDefaults.port)
	const [user, setUser] = useState(initialDefaults.user)
	const [password, setPassword] = useState(initialDefaults.password)
	const [database, setDatabase] = useState(initialDefaults.database)
	const [ephemeral, setEphemeral] = useState(!isKeyValueProvider(initialProvider))
	const [showPassword, setShowPassword] = useState(false)
	const [isFindingPort, setIsFindingPort] = useState(false)
	const [nameError, setNameError] = useState<string | null>(null)
	const [cpuLimit, setCpuLimit] = useState<number | undefined>(undefined)
	const [memoryLimit, setMemoryLimit] = useState<number | undefined>(undefined)

	useEffect(function findInitialPort() {
		void initFreePort(getProviderDefaults(initialProvider).port)
	}, [])

	useEffect(
		function closeOnEscape() {
			function onKeyDown(event: KeyboardEvent) {
				if (event.key === 'Escape') onClose()
			}
			document.addEventListener('keydown', onKeyDown)
			return () => document.removeEventListener('keydown', onKeyDown)
		},
		[onClose]
	)

	async function initFreePort(preferredPort: number) {
		setIsFindingPort(true)
		try {
			setHostPort(await findFreePort(preferredPort, preferredPort, preferredPort + 100))
		} catch {
			setHostPort(preferredPort)
		} finally {
			setIsFindingPort(false)
		}
	}

	function applyProvider(nextProvider: DatabaseProvider, nextVersion?: string) {
		const defaults = getProviderDefaults(nextProvider)
		setProvider(nextProvider)
		setVersion(nextVersion ?? defaults.version)
		setUser(defaults.user)
		setPassword(defaults.password)
		setDatabase(defaults.database)
		setEphemeral(!isKeyValueProvider(nextProvider))
		if (nextProvider !== provider) void initFreePort(defaults.port)
	}

	async function handleFindFreePort() {
		setIsFindingPort(true)
		try {
			const defaults = getProviderDefaults(provider)
			setHostPort(await findFreePort(defaults.port, defaults.port, defaults.port + 100))
		} catch (error) {
			toast.error('Failed to find free port', {
				description: error instanceof Error ? error.message : String(error)
			})
		} finally {
			setIsFindingPort(false)
		}
	}

	function handleNameChange(value: string) {
		setName(value)
		const validation = validateContainerName(value)
		setNameError(validation.valid ? null : validation.error || null)
	}

	function buildConfig(
		baseConfig: Omit<DatabaseContainerBaseConfig, 'provider'>
	): DatabaseContainerConfig {
		switch (provider) {
			case 'redis':
				return { ...baseConfig, provider, redisVersion: version }
			case 'valkey':
				return { ...baseConfig, provider, valkeyVersion: version }
			case 'mariadb':
				return {
					...baseConfig,
					provider,
					mariadbVersion: version,
					user,
					password,
					database
				}
			case 'mysql':
				return { ...baseConfig, provider, mysqlVersion: version, user, password, database }
			case 'cockroach':
				return {
					...baseConfig,
					provider,
					cockroachVersion: version,
					user,
					password: '',
					database
				}
			case 'postgres':
				return {
					...baseConfig,
					provider,
					postgresVersion: version,
					user,
					password,
					database
				}
		}
	}

	function handleSubmit(event: FormEvent) {
		event.preventDefault()

		const validation = validateContainerName(name)
		if (!validation.valid) {
			setNameError(validation.error || 'Invalid container name')
			return
		}

		onSubmit(
			buildConfig({
				name,
				hostPort,
				ephemeral,
				volumeName: ephemeral ? undefined : generateVolumeName(name),
				cpuLimit,
				memoryLimitMb: memoryLimit
			})
		)
	}

	const portOwner = existingContainers.find((container) =>
		container.ports.some((port) => port.hostPort === hostPort)
	)
	const image = `${PROVIDER_IMAGES[provider]}:${version}`

	return (
		<>
			<header className='dk-dr-h'>
				<div>
					<div className='dk-eyebrow'>New container</div>
					<h2 id='dk-create-title'>Local database</h2>
				</div>
				<button
					type='button'
					className='dk-ibtn'
					onClick={onClose}
					aria-label='Close create panel'
				>
					<X className='h-4 w-4' aria-hidden='true' />
				</button>
			</header>

			<form
				id='dk-create-form'
				className='dk-dr-b'
				onSubmit={handleSubmit}
				noValidate
				autoComplete='off'
			>
				<section>
					<span className='dk-sec-h dk-eyebrow'>Quick start</span>
					<div className='dk-tpls'>
						{CONTAINER_TEMPLATES.map((template) => (
							<button
								key={template.id}
								type='button'
								className='dk-tpl'
								aria-pressed={
									provider === template.provider && version === template.version
								}
								onClick={() => applyProvider(template.provider, template.version)}
							>
								<span className='dk-tpl-t'>{template.title}</span>
								<span className='dk-tpl-s dk-mono'>{template.image}</span>
							</button>
						))}
					</div>
				</section>

				<section>
					<span className='dk-sec-h dk-eyebrow'>Engine</span>
					<div className='dk-seg dk-prov' role='radiogroup' aria-label='Database engine'>
						{DATABASE_PROVIDERS.map((item) => (
							<button
								key={item.value}
								type='button'
								role='radio'
								aria-checked={provider === item.value}
								aria-pressed={provider === item.value}
								title={item.description}
								onClick={() => applyProvider(item.value)}
							>
								{PROVIDER_SHORT_LABELS[item.value]}
							</button>
						))}
					</div>
					<div className='dk-fld'>
						<label className='dk-fld-l' htmlFor='dk-create-image'>
							Image
						</label>
						<select
							id='dk-create-image'
							className='dk-inp dk-mono'
							value={version}
							onChange={(event) => setVersion(event.target.value)}
						>
							{getVersionOptions(provider).map((option) => (
								<option key={option.value} value={option.value}>
									{PROVIDER_IMAGES[provider]}:{option.value}
								</option>
							))}
						</select>
						<small className='dk-hint'>{PROVIDER_HINTS[provider]}</small>
					</div>
				</section>

				<section>
					<span className='dk-sec-h dk-eyebrow'>Container</span>
					<div className='dk-fld'>
						<label className='dk-fld-l' htmlFor='dk-create-name'>
							Name
						</label>
						<input
							id='dk-create-name'
							className='dk-inp dk-mono'
							value={name}
							autoFocus
							spellCheck={false}
							aria-invalid={Boolean(nameError)}
							onChange={(event) => handleNameChange(event.target.value)}
							placeholder='my_database'
						/>
						{nameError ? (
							<small className='dk-err'>{nameError}</small>
						) : (
							<small className='dk-hint'>Lowercase letters, numbers, _ or -.</small>
						)}
					</div>
					<div className='dk-fld'>
						<label className='dk-fld-l' htmlFor='dk-create-port'>
							Host port
						</label>
						<div className='dk-inline'>
							<input
								id='dk-create-port'
								className='dk-inp dk-mono'
								inputMode='numeric'
								value={hostPort}
								aria-invalid={Boolean(portOwner)}
								onChange={(event) =>
									setHostPort(
										parseInt(event.target.value, 10) ||
											getProviderDefaults(provider).port
									)
								}
							/>
							<span className='dk-to dk-mono'>→ {CONTAINER_PORTS[provider]}</span>
							<button
								type='button'
								className='dk-btn'
								data-variant='secondary'
								onClick={handleFindFreePort}
								disabled={isFindingPort}
							>
								{isFindingPort && <Spinner className='h-3.5 w-3.5' />}
								Find free port
							</button>
						</div>
						{portOwner && (
							<small className='dk-err'>
								Port {hostPort} is published by {portOwner.name}.
							</small>
						)}
					</div>
				</section>

				{!isKeyValueProvider(provider) && (
					<section>
						<span className='dk-sec-h dk-eyebrow'>Credentials</span>
						<div className='dk-fgrid'>
							<label className='dk-fld'>
								<span className='dk-fld-l'>User</span>
								<input
									className='dk-inp dk-mono'
									value={user}
									spellCheck={false}
									onChange={(event) => setUser(event.target.value)}
								/>
							</label>
							<label className='dk-fld'>
								<span className='dk-fld-l'>Database</span>
								<input
									className='dk-inp dk-mono'
									value={database}
									spellCheck={false}
									onChange={(event) => setDatabase(event.target.value)}
								/>
							</label>
						</div>
						{provider === 'cockroach' ? (
							<p className='dk-hint' style={{ marginTop: 12 }}>
								CockroachDB runs in insecure mode for local development, so no
								password is needed.
							</p>
						) : (
							<div className='dk-fld'>
								<label className='dk-fld-l' htmlFor='dk-create-password'>
									Password
								</label>
								<div className='dk-pwrap'>
									<input
										id='dk-create-password'
										className='dk-inp dk-mono'
										type={showPassword ? 'text' : 'password'}
										value={password}
										spellCheck={false}
										onChange={(event) => setPassword(event.target.value)}
									/>
									<button
										type='button'
										className='dk-ibtn'
										data-size='sm'
										aria-label={
											showPassword ? 'Hide password' : 'Show password'
										}
										onClick={() => setShowPassword((value) => !value)}
									>
										{showPassword ? (
											<EyeOff className='h-3.5 w-3.5' aria-hidden='true' />
										) : (
											<Eye className='h-3.5 w-3.5' aria-hidden='true' />
										)}
									</button>
								</div>
							</div>
						)}
					</section>
				)}

				<section>
					<span className='dk-sec-h dk-eyebrow'>Storage</span>
					<div className='dk-trow'>
						<label className='dk-trow-b' htmlFor='dk-create-ephemeral'>
							<span className='dk-trow-t'>Ephemeral storage</span>
							<span className='dk-trow-s'>
								{ephemeral
									? 'Data is lost when the container is removed'
									: `Persists in volume ${generateVolumeName(name || 'container')}`}
							</span>
						</label>
						<Switch
							id='dk-create-ephemeral'
							checked={ephemeral}
							onCheckedChange={setEphemeral}
						/>
					</div>
				</section>

				<section>
					<span className='dk-sec-h dk-eyebrow'>Limits</span>
					<div className='dk-fgrid'>
						<label className='dk-fld'>
							<span className='dk-fld-l'>CPU</span>
							<select
								className='dk-inp dk-mono'
								value={cpuLimit ?? ''}
								onChange={(event) =>
									setCpuLimit(
										event.target.value ? Number(event.target.value) : undefined
									)
								}
							>
								<option value=''>No limit</option>
								{CPU_OPTIONS.map((option) => (
									<option key={option} value={option}>
										{option} {option === 1 ? 'core' : 'cores'}
									</option>
								))}
							</select>
						</label>
						<label className='dk-fld'>
							<span className='dk-fld-l'>Memory</span>
							<select
								className='dk-inp dk-mono'
								value={memoryLimit ?? ''}
								onChange={(event) =>
									setMemoryLimit(
										event.target.value ? Number(event.target.value) : undefined
									)
								}
							>
								<option value=''>No limit</option>
								{MEMORY_OPTIONS.map((option) => (
									<option key={option} value={option}>
										{formatMemory(option)}
									</option>
								))}
							</select>
						</label>
					</div>
				</section>
			</form>

			<footer className='dk-dr-f'>
				<span className='dk-preview dk-mono' title={image}>
					{image} → localhost:{hostPort}
				</span>
				<button type='button' className='dk-btn' data-variant='ghost' onClick={onClose}>
					Cancel
				</button>
				<button
					type='submit'
					form='dk-create-form'
					className='dk-btn'
					data-variant='primary'
					disabled={isSubmitting || Boolean(nameError)}
				>
					{isSubmitting && <Spinner className='h-3.5 w-3.5' />}
					{isSubmitting ? 'Creating…' : 'Create container'}
				</button>
			</footer>
		</>
	)
}
