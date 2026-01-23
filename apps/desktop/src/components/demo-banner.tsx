import { X, Download } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useRecording } from "@/core/recording";

type Props = {
	githubUrl?: string
	onClose?: () => void
	defaultVisible?: boolean
}

export function DemoBanner({
	githubUrl = 'https://github.com/remcostoeten/dora/releases',
	onClose,
	defaultVisible = true
}: Props) {
	const { shouldHide } = useRecording()
	const [os, setOs] = useState<string>('')
	const [isVisible, setIsVisible] = useState<boolean>(defaultVisible)
	const [isDemo, setIsDemo] = useState(false)

	useEffect(function detectDemoAndOs() {
		const isWebDemo =
			import.meta.env.MODE === 'demo' ||
			window.location.hostname.includes('demo') ||
			import.meta.env.VITE_IS_WEB === 'true' ||
			window.location.hostname === 'localhost' ||
			window.location.hostname === '127.0.0.1'

		setIsDemo(isWebDemo)

		if (isWebDemo) {
			const userAgent = window.navigator.userAgent.toLowerCase()
			if (userAgent.indexOf('win') !== -1) {
				setOs('Windows')
			} else if (userAgent.indexOf('mac') !== -1) {
				setOs('macOS')
			} else if (userAgent.indexOf('linux') !== -1) {
				setOs('Linux')
			}
		}
	}, [])

	const handleClose = useCallback(
		function onCloseBanner() {
			setIsVisible(false)
			if (onClose) {
				onClose()
			}
		},
		[onClose]
	)

	if (!isVisible || !isDemo || shouldHide('hideDemoBanner')) return null

	return (
		<div
			className={`
        fixed bottom-6 right-6 z-50
        flex items-center gap-3 px-5 py-2.5
        bg-popover/90 backdrop-blur-md
        border border-border/50
        rounded-full shadow-2xl
        ring-1 ring-white/10
        overflow-hidden
        transition-all duration-300 ease-out
        ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}
      `}
		>
			<span className='text-sm font-medium'>You're viewing the demo.</span>

			<a
				href={githubUrl}
				target='_blank'
				rel='noopener noreferrer'
				className='
          flex items-center gap-2 px-3 py-1.5 
          bg-primary text-primary-foreground
          rounded-full text-xs font-bold
          transition-opacity hover:opacity-90
        '
			>
				<Download className='w-3.5 h-3.5' />
				{os ? `Download for ${os}` : 'Download'}
			</a>

			<button
				onClick={handleClose}
				className='
          flex items-center justify-center w-5 h-5 ml-1
          rounded-full text-muted-foreground/70
          transition-colors hover:text-foreground hover:bg-muted
        '
				aria-label='Close banner'
			>
				<X className='w-3 h-3' />
			</button>
		</div>
	)
}
