import { Minus, Square, X } from 'lucide-react'
import { useCallback, useState, useEffect } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/shared/utils/cn'

type Props = {
	className?: string
}

export function WindowControls({ className }: Props) {
	const [isMaximized, setIsMaximized] = useState(false)
	const [isTauri, setIsTauri] = useState(false)

	useEffect(function checkTauriEnvironment() {
		setIsTauri(typeof window !== 'undefined' && '__TAURI__' in window)
	}, [])

	useEffect(
		function listenToWindowResize() {
			if (!isTauri) return

			async function checkMaximized() {
				try {
					const { getCurrentWindow } = await import('@tauri-apps/api/window')
					const appWindow = getCurrentWindow()
					const maximized = await appWindow.isMaximized()
					setIsMaximized(maximized)
				} catch {}
			}

			checkMaximized()

			async function setupListener() {
				try {
					const { getCurrentWindow } = await import('@tauri-apps/api/window')
					const appWindow = getCurrentWindow()
					const unlisten = await appWindow.onResized(function () {
						checkMaximized()
					})
					return unlisten
				} catch {
					return undefined
				}
			}

			let cleanup: (() => void) | undefined

			setupListener().then(function (unlisten) {
				cleanup = unlisten
			})

			return function () {
				if (cleanup) cleanup()
			}
		},
		[isTauri]
	)

	const handleMinimize = useCallback(
		async function () {
			if (!isTauri) return
			try {
				const { getCurrentWindow } = await import('@tauri-apps/api/window')
				const appWindow = getCurrentWindow()
				await appWindow.minimize()
			} catch (error) {
				console.error('Failed to minimize window:', error)
			}
		},
		[isTauri]
	)

	const handleMaximize = useCallback(
		async function () {
			if (!isTauri) return
			try {
				const { getCurrentWindow } = await import('@tauri-apps/api/window')
				const appWindow = getCurrentWindow()
				await appWindow.toggleMaximize()
			} catch (error) {
				console.error('Failed to toggle maximize:', error)
			}
		},
		[isTauri]
	)

	const handleClose = useCallback(
		async function () {
			if (!isTauri) return
			try {
				const { getCurrentWindow } = await import('@tauri-apps/api/window')
				const appWindow = getCurrentWindow()
				await appWindow.close()
			} catch (error) {
				console.error('Failed to close window:', error)
			}
		},
		[isTauri]
	)

	if (!isTauri) return null

	return (
		<div className={cn('flex items-center gap-1', className)} data-tauri-drag-region='false'>
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type='button'
						onClick={handleMinimize}
						className='flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/80 transition-colors hover:bg-muted hover:text-foreground'
						aria-label='Minimize window'
					>
						<Minus className='h-4 w-4' />
					</button>
				</TooltipTrigger>
				<TooltipContent side='bottom'>Minimize</TooltipContent>
			</Tooltip>

			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type='button'
						onClick={handleMaximize}
						className='flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/80 transition-colors hover:bg-muted hover:text-foreground'
						aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
					>
						<Square className='h-3.5 w-3.5' />
					</button>
				</TooltipTrigger>
				<TooltipContent side='bottom'>
					{isMaximized ? 'Restore' : 'Maximize'}
				</TooltipContent>
			</Tooltip>

			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type='button'
						onClick={handleClose}
						className='flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/80 transition-colors hover:bg-destructive/90 hover:text-destructive-foreground'
						aria-label='Close window'
					>
						<X className='h-4 w-4' />
					</button>
				</TooltipTrigger>
				<TooltipContent side='bottom'>Close</TooltipContent>
			</Tooltip>
		</div>
	)
}
