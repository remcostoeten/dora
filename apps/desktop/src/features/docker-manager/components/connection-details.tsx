import { Copy, Check, Eye, EyeOff, Terminal, Code2, Database, Hash } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import type { DockerContainer } from '../types'
import {
	buildConnectionEnvVars,
	maskPassword
} from '../utilities/connection-string-builder'
import { generateSnippet, SnippetLanguage } from '../utilities/connection-snippet-generator'
import { SnippetHighlight } from './snippet-highlight'
import { cn } from '@/shared/utils/cn'

type Props = {
	container: DockerContainer
	password: string
}

const LANGUAGE_CONFIG: Record<SnippetLanguage, { label: string; icon: string; color: string }> = {
	terminal: { label: 'Shell', icon: '$_', color: 'text-emerald-400' },
	nodejs: { label: 'Node', icon: 'JS', color: 'text-yellow-400' },
	python: { label: 'Python', icon: 'Py', color: 'text-blue-400' },
	prisma: { label: 'Prisma', icon: '◮', color: 'text-indigo-400' },
}

export function ConnectionDetails({ container, password }: Props) {
	const [copied, setCopied] = useState(false)
	const [showPassword, setShowPassword] = useState(false)

	const primaryPort = container.ports.find(function (p) {
		return p.containerPort === 5432
	})

	const host = 'localhost'
	const port = primaryPort?.hostPort ?? 5432
	const user = container.env.find((e) => e.startsWith('POSTGRES_USER='))?.split('=')[1] || 'postgres'
	const database = container.env.find((e) => e.startsWith('POSTGRES_DB='))?.split('=')[1] || 'postgres'

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

	const [activeLanguage, setActiveLanguage] = useState<SnippetLanguage>('terminal')
	const [snippetCopied, setSnippetCopied] = useState(false)

	function togglePasswordVisibility() {
		setShowPassword(function (prev) {
			return !prev
		})
	}

	async function handleCopySnippet() {
		const snippet = generateSnippet(container, activeLanguage)
		try {
			await navigator.clipboard.writeText(snippet)
			setSnippetCopied(true)
			setTimeout(function () {
				setSnippetCopied(false)
			}, 2000)
		} catch {
			console.error('Failed to copy to clipboard')
		}
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

			<Tabs defaultValue='env' className='w-full'>
				<TabsList className='grid w-full grid-cols-2'>
					<TabsTrigger value='env'>Env Vars</TabsTrigger>
					<TabsTrigger value='snippets'>Snippets</TabsTrigger>
				</TabsList>

				<TabsContent value='env' className='mt-2 text-sm'>
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
				</TabsContent>

				<TabsContent value='snippets' className='mt-2 text-sm space-y-2'>
					<div className='flex gap-1'>
						{(Object.keys(LANGUAGE_CONFIG) as SnippetLanguage[]).map(
							(lang) => {
								const config = LANGUAGE_CONFIG[lang]
								return (
									<Button
										key={lang}
										variant={activeLanguage === lang ? 'secondary' : 'ghost'}
										size='sm'
										className={cn(
											'h-7 px-2.5 text-xs gap-1.5 font-medium',
											activeLanguage === lang && 'ring-1 ring-border'
										)}
										onClick={() => setActiveLanguage(lang)}
									>
										<span className={cn('font-mono text-[10px] font-bold leading-none', config.color)}>
											{config.icon}
										</span>
										{config.label}
									</Button>
								)
							}
						)}
					</div>

					<div className='relative group'>
						<div className='p-3 rounded-lg bg-zinc-950 text-xs font-mono overflow-x-auto border border-border min-h-[100px]'>
							<SnippetHighlight code={generateSnippet(container, activeLanguage)} language={activeLanguage} />
						</div>
						<Button
							variant='ghost'
							size='icon'
							aria-label='Copy snippet'
							className='absolute top-2 right-2 h-6 w-6 bg-zinc-900/50 hover:bg-zinc-800 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity'
							onClick={handleCopySnippet}
						>
							{snippetCopied ? (
								<Check className='h-3.5 w-3.5 text-emerald-500' />
							) : (
								<Copy className='h-3.5 w-3.5' />
							)}
						</Button>
					</div>
				</TabsContent>
			</Tabs>

			<div className='pt-2'>
				<label className='text-xs text-muted-foreground'>Connection URL</label>
				<div className='mt-1 p-2.5 rounded-lg bg-muted/50 border border-border/50 overflow-x-auto'>
					<code className='text-xs font-mono break-all text-foreground/80'>{displayUrl}</code>
				</div>
			</div>
		</div>
	)
}

function ConnectionRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
	return (
		<div className={cn(
			'flex items-center justify-between py-2 px-3 bg-muted/30 even:bg-transparent',
			!isLast && 'border-b border-border/50'
		)}>
			<span className='text-xs text-muted-foreground'>{label}</span>
			<code className='text-xs font-mono text-foreground'>{value}</code>
		</div>
	)
}
