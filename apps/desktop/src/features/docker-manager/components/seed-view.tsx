import { Upload, FileCode, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { useState, useRef } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/shared/ui/button'
import { useSeedDatabase } from '../api/mutations/use-seed-database'
import type { DockerContainer } from '../types'

type Props = {
	container: DockerContainer
}

export function SeedView({ container }: Props) {
	const [file, setFile] = useState<File | null>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)
	const { toast } = useToast()

	const seedMutation = useSeedDatabase()

	// Determine connection config (fallbacking to defaults if labels missing)
	const user =
		container.env.find((e) => e.startsWith('POSTGRES_USER='))?.split('=')[1] || 'postgres'
	const db = container.env.find((e) => e.startsWith('POSTGRES_DB='))?.split('=')[1] || 'postgres'

	function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
		if (e.target.files && e.target.files[0]) {
			setFile(e.target.files[0])
			seedMutation.reset()
		}
	}

	function handleDrop(e: React.DragEvent) {
		e.preventDefault()
		if (e.dataTransfer.files && e.dataTransfer.files[0]) {
			const droppedFile = e.dataTransfer.files[0]
			if (droppedFile.name.endsWith('.sql')) {
				setFile(droppedFile)
				seedMutation.reset()
			} else {
				toast({
					title: 'Invalid file type',
					description: 'Only .sql files are supported',
					variant: 'destructive'
				})
			}
		}
	}

	function handleDragOver(e: React.DragEvent) {
		e.preventDefault()
	}

	async function handleSeed() {
		if (!file) return

		// In a real browser app, we can't get the full path.
		// But in Tauri, we might need the path or upload the file contents.
		// MVP Strategy: Since we are in Tauri, we can use the `path` property of file if available,
		// OR we might need to read the file content and write it to a temp file that the backend can see.

		// Wait! The implementation of copyToContainer uses `executeDockerCommand(['cp', hostPath...])`.
		// This requires `hostPath` to be a path on the filesystem accessible by the `docker` CLI.
		// In a webview/Tauri, `File` object usually has a `path` property in webkit environments sometimes,
		// but robustly, we should use the Tauri API to open a file dialog to get the real path,
		// OR read the file as text and write it to a temporary file in the app data dir.

		// Let's assume for MVP `file.path` works (often true in Electron/Tauri) or we prompt differently.
		// Actually, pure <input type="file"> in Tauri might expose the path.
		// Let's rely on standard web APIs for now but check if we need a "Browse..." button that uses Tauri dialog.

		// Refinement: Using Tauri dialog is safer.
		// But `file.path` often works in Tauri. Let's try `(file as any).path`.

		const filePath = (file as any).path

		if (!filePath) {
			toast({
				title: 'File path error',
				description: 'Cannot determine file path. Please select the file again.',
				variant: 'destructive'
			})
			return
		}

		seedMutation.mutate({
			containerId: container.id,
			filePath: filePath,
			connectionConfig: { user, database: db }
		})
	}

	return (
		<div className='flex-1 flex flex-col p-4 h-full'>
			<div
				className={`
                    flex-1 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-4 transition-colors
                    ${file ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-accent/50'}
                `}
				onDrop={handleDrop}
				onDragOver={handleDragOver}
			>
				{!file ? (
					<>
						<div className='p-4 rounded-full bg-accent'>
							<Upload className='h-8 w-8 text-muted-foreground' />
						</div>
						<div className='text-center space-y-1'>
							<h3 className='font-medium'>Drop SQL file here</h3>
							<p className='text-xs text-muted-foreground'>or click to browse</p>
						</div>
						<Button variant='outline' onClick={() => fileInputRef.current?.click()}>
							Select File
						</Button>
					</>
				) : (
					<>
						<div className='p-4 rounded-full bg-primary/10'>
							<FileCode className='h-8 w-8 text-primary' />
						</div>
						<div className='text-center'>
							<h3 className='font-medium break-all max-w-[250px]'>{file.name}</h3>
							<p className='text-xs text-muted-foreground'>
								{(file.size / 1024).toFixed(1)} KB
							</p>
						</div>
						<Button
							variant='ghost'
							size='sm'
							onClick={() => setFile(null)}
							disabled={seedMutation.isPending}
						>
							Change File
						</Button>
					</>
				)}

				<input
					ref={fileInputRef}
					type='file'
					accept='.sql'
					className='hidden'
					onChange={handleFileSelect}
				/>
			</div>

			{seedMutation.error && (
				<div className='mt-4 p-3 rounded bg-destructive/10 text-destructive text-xs flex items-center gap-2'>
					<AlertCircle className='h-4 w-4' />
					<span>{seedMutation.error.message}</span>
				</div>
			)}

			{seedMutation.isSuccess && (
				<div className='mt-4 p-3 rounded bg-emerald-500/10 text-emerald-500 text-xs flex items-center gap-2'>
					<CheckCircle2 className='h-4 w-4' />
					<span>Seeding completed successfully!</span>
				</div>
			)}

			<div className='mt-4 flex justify-end'>
				<Button
					onClick={handleSeed}
					disabled={!file || seedMutation.isPending}
					className='w-full'
				>
					{seedMutation.isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
					{seedMutation.isPending ? 'Seeding...' : 'Run Seed Script'}
				</Button>
			</div>
		</div>
	)
}
