import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@studio/shared/ui/button'
import { toast } from '@studio/shared/ui/notifier'
import type { DockerContainer } from '../types'
import { getKeyValueConnectionUrl, getKeyValuePort } from '../utilities/container-connection'

type Props = {
	container: DockerContainer
}

export function KeyValueConnectionDetails({ container }: Props) {
	const [copied, setCopied] = useState(false)

	const url = getKeyValueConnectionUrl(container)

	async function handleCopyUrl() {
		try {
			await navigator.clipboard.writeText(url)
			setCopied(true)
			setTimeout(function () {
				setCopied(false)
			}, 2000)
		} catch (error) {
			console.error('Failed to copy to clipboard', error)
			toast.error('Failed to copy connection string', {
				description: error instanceof Error ? error.message : String(error)
			})
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
					onClick={handleCopyUrl}
				>
					{copied ? (
						<>
							<Check className='h-3.5 w-3.5 text-emerald-500' />
							Copied URL
						</>
					) : (
						<>
							<Copy className='h-3.5 w-3.5' />
							Copy URL
						</>
					)}
				</Button>
			</div>

			<div className='mt-2 text-sm'>
				<div className='rounded-lg border border-border overflow-hidden'>
					<div className='flex items-center justify-between py-2 px-3 border-b border-border/50 bg-muted/30'>
						<span className='text-xs text-muted-foreground'>Host</span>
						<code className='text-xs font-mono text-foreground'>127.0.0.1</code>
					</div>
					<div className='flex items-center justify-between py-2 px-3'>
						<span className='text-xs text-muted-foreground'>Port</span>
						<code className='text-xs font-mono text-foreground'>
							{getKeyValuePort(container)}
						</code>
					</div>
				</div>
			</div>

			<div className='pt-2'>
				<label className='mb-1 block text-xs text-muted-foreground'>Connection URL</label>
				<div className='p-2.5 rounded-lg bg-muted/50 border border-border/50 overflow-x-auto'>
					<code className='text-xs font-mono break-all text-foreground/80'>{url}</code>
				</div>
			</div>
		</div>
	)
}
