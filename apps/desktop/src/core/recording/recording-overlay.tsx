import { Pause, Play, RotateCcw, Square } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { useRecording } from './recording-provider'

type Waypoint = {
	id: number
	x: number
	y: number
	delayMs: number
}

type PlaybackState = 'idle' | 'recording' | 'playing' | 'paused'

function isDemoAutopilotEnabled(): boolean {
	if (typeof import.meta === 'undefined' || !import.meta.env) return false
	return (
		import.meta.env.VITE_DEMO_AUTOPILOT === 'true' ||
		import.meta.env.VITE_DEMO_AUTOPILOT === '1'
	)
}

function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value))
}

function cubicBezier(
	t: number,
	p0: number,
	p1: number,
	p2: number,
	p3: number
): number {
	const oneMinusT = 1 - t
	return (
		oneMinusT * oneMinusT * oneMinusT * p0 +
		3 * oneMinusT * oneMinusT * t * p1 +
		3 * oneMinusT * t * t * p2 +
		t * t * t * p3
	)
}

function easeInOutCubic(t: number): number {
	if (t < 0.5) return 4 * t * t * t
	return 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function RecordingOverlay() {
	const { isRecordingMode } = useRecording()
	const demoAutopilotEnabled = isDemoAutopilotEnabled()
	const [playbackState, setPlaybackState] = useState<PlaybackState>('idle')
	const [waypoints, setWaypoints] = useState<Waypoint[]>([])
	const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)

	const runTokenRef = useRef(0)
	const pausedRef = useRef(false)
	const lastCaptureRef = useRef<number | null>(null)

	const isPlaying = playbackState === 'playing' || playbackState === 'paused'
	const controlsEnabled = isRecordingMode && demoAutopilotEnabled

	const waitWithPause = useCallback(async function waitWithPause(ms: number, token: number) {
		let elapsed = 0
		let last = performance.now()
		while (elapsed < ms) {
			await new Promise<void>(function nextFrame(resolve) {
				requestAnimationFrame(function () {
					resolve()
				})
			})
			if (token !== runTokenRef.current) return false
			const now = performance.now()
			if (pausedRef.current) {
				last = now
				continue
			}
			elapsed += now - last
			last = now
		}
		return true
	}, [])

	const animateSegment = useCallback(
		async function animateSegment(
			start: { x: number; y: number },
			end: { x: number; y: number },
			token: number
		) {
			const dx = end.x - start.x
			const dy = end.y - start.y
			const distance = Math.hypot(dx, dy)
			const durationMs = clamp(distance * 2.4, 300, 1100)
			const angle = Math.atan2(dy, dx)
			const arc = clamp(distance * 0.18, 18, 120) * (Math.random() > 0.5 ? 1 : -1)
			const c1x = start.x + dx * 0.34 + Math.cos(angle + Math.PI / 2) * arc
			const c1y = start.y + dy * 0.34 + Math.sin(angle + Math.PI / 2) * arc
			const c2x = start.x + dx * 0.68 + Math.cos(angle - Math.PI / 2) * arc * 0.65
			const c2y = start.y + dy * 0.68 + Math.sin(angle - Math.PI / 2) * arc * 0.65
			const startTs = performance.now()

			while (true) {
				await new Promise<void>(function nextFrame(resolve) {
					requestAnimationFrame(function () {
						resolve()
					})
				})
				if (token !== runTokenRef.current) return false
				if (pausedRef.current) continue
				const t = clamp((performance.now() - startTs) / durationMs, 0, 1)
				const easedT = easeInOutCubic(t)
				setCursor({
					x: cubicBezier(easedT, start.x, c1x, c2x, end.x),
					y: cubicBezier(easedT, start.y, c1y, c2y, end.y)
				})
				if (t >= 1) return true
			}
		},
		[]
	)

	const dispatchClickAtPoint = useCallback(function dispatchClickAtPoint(x: number, y: number) {
		const target = document.elementFromPoint(x, y)
		if (!target) return

		const eventInit: MouseEventInit = {
			bubbles: true,
			cancelable: true,
			view: window,
			clientX: x,
			clientY: y
		}
		target.dispatchEvent(new PointerEvent('pointerdown', eventInit))
		target.dispatchEvent(new MouseEvent('mousedown', eventInit))
		target.dispatchEvent(new PointerEvent('pointerup', eventInit))
		target.dispatchEvent(new MouseEvent('mouseup', eventInit))
		target.dispatchEvent(new MouseEvent('click', eventInit))
	}, [])

	const runPlayback = useCallback(async function runPlayback() {
		if (waypoints.length === 0) return

		const token = runTokenRef.current + 1
		runTokenRef.current = token
		pausedRef.current = false
		setPlaybackState('playing')

		let current = cursor ?? {
			x: window.innerWidth / 2,
			y: window.innerHeight / 2
		}
		setCursor(current)

		for (const waypoint of waypoints) {
			const waitingCompleted = await waitWithPause(waypoint.delayMs, token)
			if (!waitingCompleted) return
			const movementCompleted = await animateSegment(current, waypoint, token)
			if (!movementCompleted) return
			current = waypoint
			setCursor({ x: waypoint.x, y: waypoint.y })
			dispatchClickAtPoint(waypoint.x, waypoint.y)
		}

		if (token === runTokenRef.current) {
			pausedRef.current = false
			setPlaybackState('idle')
		}
	}, [animateSegment, cursor, dispatchClickAtPoint, waitWithPause, waypoints])

	useEffect(
		function captureWaypointsOnClick() {
			if (!controlsEnabled || playbackState !== 'recording') return

			function onPointerDown(event: PointerEvent) {
				const target = event.target
				if (
					target instanceof Element &&
					target.closest('[data-recording-control="true"]')
				) {
					return
				}

				const now = performance.now()
				const previous = lastCaptureRef.current
				lastCaptureRef.current = now
				const delayMs = previous === null ? 500 : clamp(now - previous, 120, 2500)

				setWaypoints(function appendWaypoint(prev) {
					const nextId = prev.length > 0 ? prev[prev.length - 1].id + 1 : 1
					return [
						...prev,
						{
							id: nextId,
							x: event.clientX,
							y: event.clientY,
							delayMs: Math.round(delayMs)
						}
					]
				})
			}

			window.addEventListener('pointerdown', onPointerDown, true)
			return function cleanup() {
				window.removeEventListener('pointerdown', onPointerDown, true)
			}
		},
		[controlsEnabled, playbackState]
	)

	useEffect(function cleanupPlaybackOnUnmount() {
		return function stop() {
			runTokenRef.current += 1
		}
	}, [])

	const waypointPath = useMemo(function path() {
		return waypoints.map((point) => `${point.x},${point.y}`).join(' ')
	}, [waypoints])

	function handleRecordToggle() {
		if (playbackState === 'recording') {
			setPlaybackState('idle')
			return
		}
		lastCaptureRef.current = null
		setPlaybackState('recording')
	}

	function handlePlay() {
		if (!controlsEnabled || playbackState === 'recording' || waypoints.length === 0) return
		void runPlayback()
	}

	function handlePauseToggle() {
		if (playbackState === 'playing') {
			pausedRef.current = true
			setPlaybackState('paused')
			return
		}
		if (playbackState === 'paused') {
			pausedRef.current = false
			setPlaybackState('playing')
		}
	}

	function handleStopPlayback() {
		runTokenRef.current += 1
		pausedRef.current = false
		setPlaybackState('idle')
	}

	function handleReset() {
		if (isPlaying) return
		setWaypoints([])
		setCursor(null)
		lastCaptureRef.current = null
		setPlaybackState('idle')
	}

	if (!isRecordingMode) return null

	return (
		<>
			<div className='fixed top-2 right-2 z-[9999] flex items-center gap-2 px-2 py-1 rounded-md bg-red-500/90 text-white text-xs font-medium pointer-events-none'>
				<span className='w-2 h-2 rounded-full bg-white animate-pulse' />
				REC
			</div>

			{controlsEnabled && (
				<>
					{waypoints.length > 0 && (
						<svg className='fixed inset-0 z-[9996] pointer-events-none'>
							<polyline
								points={waypointPath}
								fill='none'
								stroke='rgba(56, 189, 248, 0.9)'
								strokeWidth='2'
								strokeDasharray='6 6'
							/>
							{waypoints.map(function (point, index) {
								return (
									<g key={point.id}>
										<circle
											cx={point.x}
											cy={point.y}
											r='5'
											fill='rgba(34, 197, 94, 0.95)'
										/>
										<text
											x={point.x + 8}
											y={point.y - 8}
											fill='white'
											fontSize='11'
											fontFamily='JetBrains Mono, monospace'
										>
											{index + 1}
										</text>
									</g>
								)
							})}
						</svg>
					)}

					{cursor && (
						<div
							className='fixed z-[9998] pointer-events-none'
							style={{
								left: cursor.x,
								top: cursor.y,
								transform: 'translate(-2px, -2px)'
							}}
						>
							<div
								className='h-4 w-4 rounded-full border-2 border-sky-400 bg-sky-400/20 shadow-[0_0_16px_rgba(56,189,248,0.65)]'
								aria-hidden='true'
							/>
						</div>
					)}

					<div
						data-recording-control='true'
						className='fixed top-12 right-2 z-[9999] w-[320px] rounded-md border border-border bg-background/95 p-3 shadow-xl backdrop-blur'
					>
						<div className='mb-2 flex items-center justify-between'>
							<p className='text-xs font-semibold tracking-wide uppercase text-muted-foreground'>
								Demo Autopilot
							</p>
							<p className='text-[11px] font-mono text-muted-foreground'>{playbackState}</p>
						</div>

						<div className='mb-3 flex flex-wrap gap-2'>
							<Button
								size='sm'
								variant={playbackState === 'recording' ? 'destructive' : 'secondary'}
								onClick={handleRecordToggle}
								disabled={isPlaying}
							>
								<Square className='mr-1 h-3.5 w-3.5' />
								{playbackState === 'recording' ? 'Stop Rec' : 'Record'}
							</Button>
							<Button
								size='sm'
								variant='default'
								onClick={handlePlay}
								disabled={waypoints.length === 0 || playbackState === 'recording'}
							>
								<Play className='mr-1 h-3.5 w-3.5' />
								Play
							</Button>
							<Button
								size='sm'
								variant='outline'
								onClick={handlePauseToggle}
								disabled={!isPlaying}
							>
								<Pause className='mr-1 h-3.5 w-3.5' />
								{playbackState === 'paused' ? 'Resume' : 'Pause'}
							</Button>
							<Button
								size='sm'
								variant='outline'
								onClick={handleStopPlayback}
								disabled={!isPlaying}
							>
								Stop
							</Button>
							<Button
								size='sm'
								variant='ghost'
								onClick={handleReset}
								disabled={isPlaying || waypoints.length === 0}
							>
								<RotateCcw className='mr-1 h-3.5 w-3.5' />
								Clear
							</Button>
						</div>

						<div className='mb-2 text-[11px] text-muted-foreground font-mono'>
							points={waypoints.length}
							{cursor ? `  cursor=(${Math.round(cursor.x)},${Math.round(cursor.y)})` : ''}
						</div>

						<div className='max-h-[180px] overflow-auto rounded border border-border/60 bg-muted/20 p-2 font-mono text-[11px]'>
							{waypoints.length === 0 && (
								<p className='text-muted-foreground'>
									Press Record, click through your flow, then Play.
								</p>
							)}
							{waypoints.map(function (point, index) {
								return (
									<div key={point.id} className='flex items-center justify-between py-0.5'>
										<span>
											{index + 1}. ({Math.round(point.x)}, {Math.round(point.y)})
										</span>
										<span className='text-muted-foreground'>{point.delayMs}ms</span>
									</div>
								)
							})}
						</div>
					</div>
				</>
			)}
		</>
	)
}
