import { Copy, Check, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import type { DockerContainer } from '../types'
import { buildConnectionEnvVars, maskPassword } from '../utilities/connection-string-builder'
import { cn } from '@/shared/utils/cn'

type Props = {
	container: DockerContainer
	password: string
}

export function ConnectionDetails({ container, password }: Props) {
	const [copied, setCopied] = useState(false)
	const [showPassword, setShowPassword] = useState(false)

	const primaryPort = container.ports.find(function (p) {
		return p.containerPort === 5432
	})

	const host = 'localhost'
	const port = primaryPort?.hostPort ?? 5432
	const user =
		container.env.find((e) => e.startsWith('POSTGRES_USER='))?.split('=')[1] || 'postgres'
	const database =
		container.env.find((e) => e.startsWith('POSTGRES_DB='))?.split('=')[1] || 'postgres'

	const envVars = buildConnectionEnvVars(host, port, user, password, database)
	const displayUrl = showPassword ? envVars.DATABASE_URL : maskPassword(envVars.DATABASE_URL)

	async function handleCopyEnv() {
		try {
			await navigator.clipboard.writeText(envVars.DATABASE_URL)
			setCopied(true)
			setTimeout(function () {
				setCopied(false)
			}, 2000)
		} catch {
			console.error('Failed to copy to clipboard')
		}
	}

	function togglePasswordVisibility() {
		setShowPassword(function (prev) {
			return !prev
		})
	}

	return (
		<div className='space-y-3'>
			<div className='flex items-center justify-between'>
				<h4 className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
					Connection
				</h4>
				<Button
					variant='ghost'
					size='sm'
					className='h-7 gap-1.5 text-xs'
					onClick={handleCopyEnv}
				>
					{copied ? (
						<>
							<Check className='h-3.5 w-3.5 text-emerald-500' />
							Copied
						</>
					) : (
						<>
							<Copy className='h-3.5 w-3.5' />
							Copy Env
						</>
					)}
				</Button>
			</div>

			<div className='mt-2 text-sm'>
				<div className='rounded-lg border border-border overflow-hidden'>
					<ConnectionRow label='Host' value={host} />
					<ConnectionRow label='Port' value={String(port)} />
					<ConnectionRow label='User' value={user} />
					<div className='flex items-center justify-between py-2 px-3 border-b border-border/50 last:border-b-0 bg-muted/30 even:bg-transparent'>
						<span className='text-xs text-muted-foreground'>Password</span>
						<div className='flex items-center gap-1.5'>
							<code className='text-xs font-mono text-foreground'>
								{showPassword ? password : '••••••••'}
							</code>
							<button
								type='button'
								onClick={togglePasswordVisibility}
								aria-label={showPassword ? 'Hide password' : 'Show password'}
								className='p-0.5 hover:text-foreground text-muted-foreground transition-colors rounded hover:bg-muted'
							>
								{showPassword ? (
									<EyeOff className='h-3.5 w-3.5' />
								) : (
									<Eye className='h-3.5 w-3.5' />
								)}
							</button>
						</div>
					</div>
					<ConnectionRow label='Database' value={database} isLast />
				</div>
			</div>

			<div className='pt-2'>
				<div className='flex items-center justify-between mb-1'>
					<label className='text-xs text-muted-foreground'>Connection URL</label>
					<button
						type='button'
						onClick={togglePasswordVisibility}
						aria-label={showPassword ? 'Hide password in URL' : 'Show password in URL'}
						className='p-0.5 hover:text-foreground text-muted-foreground transition-colors rounded hover:bg-muted'
					>
						{showPassword ? (
							<EyeOff className='h-3.5 w-3.5' />
						) : (
							<Eye className='h-3.5 w-3.5' />
						)}
					</button>
				</div>
				<div className='p-2.5 rounded-lg bg-muted/50 border border-border/50 overflow-x-auto'>
					<code className='text-xs font-mono break-all text-foreground/80'>
						{displayUrl}
					</code>
				</div>
			</div>
		</div>
	)
}

function ConnectionRow({
	label,
	value,
	isLast
}: {
	label: string
	value: string
	isLast?: boolean
}) {
	return (
		<div
			className={cn(
				'flex items-center justify-between py-2 px-3 bg-muted/30 even:bg-transparent',
				!isLast && 'border-b border-border/50'
			)}
		>
			<span className='text-xs text-muted-foreground'>{label}</span>
			<code className='text-xs font-mono text-foreground'>{value}</code>
		</div>
	)
}
