import { Copy, Check, Eye, EyeOff, Terminal, Code2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import type { DockerContainer } from '../types'
import {
	buildConnectionEnvVars,
	formatEnvVarsForClipboard,
	maskPassword
} from '../utilities/connection-string-builder'
import { generateSnippet, SnippetLanguage } from '../utilities/connection-snippet-generator'

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
	const user = container.labels['POSTGRES_USER'] || 'postgres'
	const database = container.labels['POSTGRES_DB'] || 'postgres'

	const envVars = buildConnectionEnvVars(host, port, user, password, database)
	const displayUrl = showPassword ? envVars.DATABASE_URL : maskPassword(envVars.DATABASE_URL)

	async function handleCopyEnv() {
		const envString = formatEnvVarsForClipboard(envVars)
		try {
			await navigator.clipboard.writeText(envString)
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

				<TabsContent value='env' className='space-y-2 mt-2 text-sm'>
					<div
						classNflex-1
						flex
						flex-col
						h-full
						overflow-hidden
						relative
						pt-4ame='flex items-center justify-between py-1.5 px-2 rounded bg-muted/50'
					>
						<span className='text-muted-foreground'>Host</span>
						<code className='text-xs font-mono'>{host}</code>
					</div>

					<div className='flex items-center justify-between py-1.5 px-2 rounded bg-muted/50'>
						<span className='text-muted-foreground'>Port</span>
						<code className='text-xs font-mono'>{port}</code>
					</div>

					<div className='flex items-center justify-between py-1.5 px-2 rounded bg-muted/50'>
						<span className='text-muted-foreground'>User</span>
						<code className='text-xs font-mono'>{user}</code>
					</div>

					<div className='flex items-center justify-between py-1.5 px-2 rounded bg-muted/50'>
						<span className='text-muted-foreground'>Password</span>
						<div className='flex items-center gap-1'>
							<code className='text-xs font-mono'>
								{showPassword ? password : '••••••••'}
							</code>
							<button
								type='button'
								onClick={togglePasswordVisibility}
								className='p-0.5 hover:text-foreground text-muted-foreground transition-colors'
							>
								{showPassword ? (
									<EyeOff className='h-3.5 w-3.5' />
								) : (
									<Eye className='h-3.5 w-3.5' />
								)}
							</button>
						</div>
					</div>

					<div className='flex items-center justify-between py-1.5 px-2 rounded bg-muted/50'>
						<span className='text-muted-foreground'>Database</span>
						<code className='text-xs font-mono'>{database}</code>
					</div>
				</TabsContent>

				<TabsContent value='snippets' className='mt-2 text-sm space-y-2'>
					<div className='flex gap-2 mb-2'>
						{(['terminal', 'nodejs', 'python', 'prisma'] as SnippetLanguage[]).map(
							(lang) => (
								<Button
									key={lang}
									variant={activeLanguage === lang ? 'secondary' : 'ghost'}
									size='sm'
									className='h-6 px-2 text-xs capitalize'
									onClick={() => setActiveLanguage(lang)}
								>
									{lang}
								</Button>
							)
						)}
					</div>

					<div className='relative group'>
						<pre className='p-3 rounded bg-zinc-950 text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap border border-border min-h-[100px]'>
							{generateSnippet(container, activeLanguage)}
						</pre>
						<Button
							variant='ghost'
							size='icon'
							className='absolute top-2 right-2 h-6 w-6 bg-zinc-900/50 hover:bg-zinc-800'
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
				<div className='mt-1 p-2 rounded bg-muted/50 overflow-x-auto'>
					<code className='text-xs font-mono break-all'>{displayUrl}</code>
				</div>
			</div>
		</div>
	)
}
