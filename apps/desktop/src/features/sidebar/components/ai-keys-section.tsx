import { Check, Loader2, Plus, Trash2, X, Zap } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { commands, type AiApiKeyRecord } from '@/lib/bindings'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { cn } from '@/shared/utils/cn'
import { SidebarSection } from './sidebar-panel'

const PROVIDER = 'groq'

type TestState = { id: number; ok?: boolean; message?: string; testing: boolean }

function formatStatus(rec: AiApiKeyRecord): string {
	if (!rec.last_status) return 'untested'
	const ts = rec.last_tested ? new Date(rec.last_tested * 1000).toLocaleString() : ''
	return `${rec.last_status}${ts ? ' · ' + ts : ''}`
}

export function AiKeysSection() {
	const [keys, setKeys] = useState<AiApiKeyRecord[]>([])
	const [loading, setLoading] = useState(false)
	const [showAdd, setShowAdd] = useState(false)
	const [label, setLabel] = useState('')
	const [apiKey, setApiKey] = useState('')
	const [testNew, setTestNew] = useState<{ ok?: boolean; message?: string; testing: boolean }>({
		testing: false,
	})
	const [tests, setTests] = useState<Record<number, TestState>>({})

	const load = useCallback(async function load() {
		setLoading(true)
		try {
			const res = await commands.aiKeysList(PROVIDER)
			if (res.status === 'ok') setKeys(res.data)
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

	async function handleTestRaw() {
		if (!apiKey.trim()) return
		setTestNew({ testing: true })
		const res = await commands.aiKeysTestRaw(apiKey.trim())
		if (res.status === 'ok') setTestNew({ testing: false, ok: res.data.ok, message: res.data.message })
		else setTestNew({ testing: false, ok: false, message: 'Failed to test' })
	}

	async function handleAdd() {
		if (!apiKey.trim()) return
		const res = await commands.aiKeysAdd(PROVIDER, label.trim() || 'unnamed', apiKey.trim())
		if (res.status === 'ok') {
			setApiKey('')
			setLabel('')
			setTestNew({ testing: false })
			setShowAdd(false)
			await load()
		}
	}

	async function handleDelete(id: number) {
		const res = await commands.aiKeysDelete(id)
		if (res.status === 'ok') await load()
	}

	async function handleTest(id: number) {
		setTests((p) => ({ ...p, [id]: { id, testing: true } }))
		const res = await commands.aiKeysTest(id)
		if (res.status === 'ok') {
			setTests((p) => ({ ...p, [id]: { id, testing: false, ok: res.data.ok, message: res.data.message } }))
			await load()
		} else {
			setTests((p) => ({ ...p, [id]: { id, testing: false, ok: false, message: 'Test failed' } }))
		}
	}

	async function handleToggleActive(id: number, next: boolean) {
		const res = await commands.aiKeysSetActive(id, next)
		if (res.status === 'ok') await load()
	}

	return (
		<SidebarSection title='AI Keys (Groq)'>
			<div className='space-y-2'>
				<div className='text-xs text-muted-foreground leading-tight'>
					Encrypted with AES-256-GCM. The master key lives in your OS keychain. Keys from{' '}
					<code className='font-mono'>GROQ_API_KEY</code> env vars are merged in automatically.
				</div>

				{loading && (
					<div className='flex items-center gap-2 text-xs text-muted-foreground'>
						<Loader2 className='h-3 w-3 animate-spin' /> Loading…
					</div>
				)}

				{keys.length === 0 && !loading && (
					<div className='text-xs text-muted-foreground italic'>
						No saved keys. Add one below or set <code className='font-mono'>GROQ_API_KEY_1</code>.
					</div>
				)}

				{keys.map(function (k) {
					const t = tests[k.id]
					return (
						<div
							key={k.id}
							className='flex items-center gap-2 rounded-md border border-sidebar-border bg-background px-2 py-1.5'
						>
							<button
								type='button'
								onClick={() => handleToggleActive(k.id, !k.is_active)}
								className={cn(
									'h-2 w-2 rounded-full flex-shrink-0',
									k.is_active ? 'bg-emerald-500' : 'bg-muted-foreground/30'
								)}
								title={k.is_active ? 'Active — click to disable' : 'Disabled — click to enable'}
							/>
							<div className='min-w-0 flex-1'>
								<div className='text-xs font-medium text-sidebar-foreground truncate'>
									{k.label}
								</div>
								<div className='text-[10px] text-muted-foreground truncate'>
									{t && !t.testing
										? `${t.ok ? '✓' : '✗'} ${t.message}`
										: formatStatus(k)}
								</div>
							</div>
							<Button
								variant='ghost'
								size='sm'
								className='h-6 px-2 text-[10px]'
								onClick={() => handleTest(k.id)}
								disabled={t?.testing}
							>
								{t?.testing ? <Loader2 className='h-3 w-3 animate-spin' /> : <Zap className='h-3 w-3' />}
							</Button>
							<Button
								variant='ghost'
								size='sm'
								className='h-6 px-2 text-[10px] text-destructive hover:text-destructive'
								onClick={() => handleDelete(k.id)}
							>
								<Trash2 className='h-3 w-3' />
							</Button>
						</div>
					)
				})}

				{!showAdd ? (
					<Button
						variant='outline'
						size='sm'
						className='h-7 w-full text-xs'
						onClick={() => setShowAdd(true)}
					>
						<Plus className='h-3 w-3 mr-1' /> Add Groq key
					</Button>
				) : (
					<div className='space-y-2 rounded-md border border-sidebar-border bg-background p-2'>
						<Input
							value={label}
							onChange={(e) => setLabel(e.target.value)}
							placeholder='Label (e.g. personal-free)'
							className='h-7 text-xs'
						/>
						<Input
							value={apiKey}
							onChange={(e) => setApiKey(e.target.value)}
							placeholder='gsk_...'
							type='password'
							className='h-7 font-mono text-xs'
						/>
						{testNew.message && (
							<div
								className={cn(
									'text-[10px] font-mono',
									testNew.ok ? 'text-emerald-500' : 'text-destructive'
								)}
							>
								{testNew.ok ? '✓' : '✗'} {testNew.message}
							</div>
						)}
						<div className='flex items-center gap-1'>
							<Button
								variant='ghost'
								size='sm'
								className='h-6 px-2 text-[10px]'
								onClick={handleTestRaw}
								disabled={testNew.testing || !apiKey.trim()}
							>
								{testNew.testing ? <Loader2 className='h-3 w-3 animate-spin' /> : 'Test'}
							</Button>
							<Button
								variant='default'
								size='sm'
								className='h-6 px-2 text-[10px] ml-auto'
								onClick={handleAdd}
								disabled={!apiKey.trim()}
							>
								<Check className='h-3 w-3 mr-1' /> Save
							</Button>
							<Button
								variant='ghost'
								size='sm'
								className='h-6 px-2 text-[10px]'
								onClick={() => {
									setShowAdd(false)
									setApiKey('')
									setLabel('')
									setTestNew({ testing: false })
								}}
							>
								<X className='h-3 w-3' />
							</Button>
						</div>
					</div>
				)}
			</div>
		</SidebarSection>
	)
}
