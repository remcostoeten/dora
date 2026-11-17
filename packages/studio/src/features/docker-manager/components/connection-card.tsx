import { Ban, Check, Copy, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { toast } from '@studio/shared/ui/notifier'
import type { DockerContainer } from '../types'
import { generateSnippet } from '../utilities/connection-snippet-generator'
import {
	detectKeyValueProvider,
	getContainerConnectionDetails,
	getKeyValueConnectionUrl,
	getKeyValuePort
} from '../utilities/container-connection'

type Props = {
	container: DockerContainer
	showSecrets: boolean
	onToggleSecrets: () => void
	onStart: () => void
	isActionPending: boolean
}

type Format = 'url' | 'cli'

type ConnectionView = {
	url: string
	cli: string
	password: string
	fields: Array<[string, string]>
}

const MASK = '••••••••'

function getConnectionView(container: DockerContainer): ConnectionView {
	const keyValueProvider = detectKeyValueProvider(container)
	if (keyValueProvider) {
		const port = getKeyValuePort(container)
		return {
			url: getKeyValueConnectionUrl(container),
			cli: `${keyValueProvider}-cli -h 127.0.0.1 -p ${port}`,
			password: '',
			fields: [
				['Host', '127.0.0.1'],
				['Port', String(port)],
				['DB index', '0'],
				['Auth', 'none']
			]
		}
	}

	const connection = getContainerConnectionDetails(container)
	return {
		url: connection.connectionUrl,
		cli: generateSnippet(container, 'terminal'),
		password: connection.password,
		fields: [
			['Host', connection.host],
			['Port', String(connection.port)],
			['User', connection.user],
			['Database', connection.database]
		]
	}
}

function maskSecret(text: string, secret: string): string {
	if (!secret) return text
	return text.split(encodeURIComponent(secret)).join(MASK).split(secret).join(MASK)
}

export function ConnectionCard({
	container,
	showSecrets,
	onToggleSecrets,
	onStart,
	isActionPending
}: Props) {
	const [format, setFormat] = useState<Format>('url')
	const [copied, setCopied] = useState(false)
	const view = getConnectionView(container)
	const value = format === 'url' ? view.url : view.cli
	const display = showSecrets ? value : maskSecret(value, view.password)
	const isRunning = container.state === 'running'
	const schemeMatch = display.match(/^([a-z]+:\/\/)(.*)$/)

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(value)
			setCopied(true)
			setTimeout(() => setCopied(false), 1600)
		} catch (error) {
			toast.error('Failed to copy connection string', {
				description: error instanceof Error ? error.message : String(error)
			})
		}
	}

	return (
		<section className='dk-card' style={{ gridArea: 'conn' }} aria-label='Connection'>
			<div className='dk-card-h'>
				<span className='dk-eyebrow'>Connection</span>
				<div className='dk-card-r'>
					<div className='dk-seg' role='tablist' aria-label='Connection format'>
						<button
							type='button'
							role='tab'
							aria-selected={format === 'url'}
							onClick={() => setFormat('url')}
						>
							URL
						</button>
						<button
							type='button'
							role='tab'
							aria-selected={format === 'cli'}
							onClick={() => setFormat('cli')}
						>
							CLI
						</button>
					</div>
				</div>
			</div>
			<div className='dk-card-b'>
				<div className='dk-code dk-mono'>
					<span className='dk-code-t' title={display}>
						{schemeMatch ? (
							<>
								<span className='dk-faint'>{schemeMatch[1]}</span>
								{schemeMatch[2]}
							</>
						) : (
							display
						)}
					</span>
					{view.password && (
						<button
							type='button'
							className='dk-ibtn'
							data-size='sm'
							onClick={onToggleSecrets}
							aria-pressed={showSecrets}
							aria-label={showSecrets ? 'Hide password' : 'Show password'}
							title={showSecrets ? 'Hide password' : 'Show password'}
						>
							{showSecrets ? (
								<EyeOff className='h-3.5 w-3.5' aria-hidden='true' />
							) : (
								<Eye className='h-3.5 w-3.5' aria-hidden='true' />
							)}
						</button>
					)}
					<button
						type='button'
						className='dk-ibtn'
						data-size='sm'
						data-done={copied}
						onClick={handleCopy}
						aria-label={copied ? 'Copied' : 'Copy connection string'}
						title='Copy'
					>
						{copied ? (
							<Check className='h-3.5 w-3.5' aria-hidden='true' />
						) : (
							<Copy className='h-3.5 w-3.5' aria-hidden='true' />
						)}
					</button>
				</div>
				<div className='dk-kv'>
					{view.fields.map(([label, fieldValue]) => (
						<div key={label}>
							<div className='dk-k'>{label}</div>
							<div className='dk-v dk-mono' title={fieldValue}>
								{fieldValue}
							</div>
						</div>
					))}
				</div>
				{!isRunning && (
					<div className='dk-note'>
						<Ban className='h-3.5 w-3.5 shrink-0' aria-hidden='true' />
						<span>
							Not accepting connections while{' '}
							{container.state === 'created' ? 'created' : 'stopped'}.
						</span>
						<button
							type='button'
							className='dk-btn'
							data-variant='secondary'
							onClick={onStart}
							disabled={isActionPending}
						>
							Start
						</button>
					</div>
				)}
			</div>
		</section>
	)
}
