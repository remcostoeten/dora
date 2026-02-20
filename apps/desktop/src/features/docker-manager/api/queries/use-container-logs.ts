import { useEffect, useState, useRef } from 'react'
import { streamContainerLogs } from '../container-service'
import { DEFAULT_LOG_TAIL } from '../../constants'
import type { ContainerLogsOptions } from '../../types'

type UseContainerLogsOptions = ContainerLogsOptions & {
	enabled?: boolean
}

export function useContainerLogs(
	containerId: string | null,
	options: UseContainerLogsOptions = {}
) {
	const { enabled = true } = options
	const [logs, setLogs] = useState<string>('')
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const activeStreamRef = useRef<(() => void) | null>(null)

	useEffect(() => {
		if (!containerId || !enabled) {
			return
		}

		setIsLoading(true)
		setLogs('')
		setError(null)
		let isMounted = true

		async function startStream() {
			// Cleanup previous stream
			if (activeStreamRef.current) {
				try {
					activeStreamRef.current()
				} catch (e) {
					console.error('Failed to cleanup stream:', e)
				}
			}

			try {
				const cleanup = await streamContainerLogs(
					containerId!,
					(line) => {
						if (isMounted) {
							setLogs((prev) => prev + line) // Append logs (Note: might need buffering for perf)
						}
					},
					(err) => {
						if (isMounted) {
							console.error('Stream error:', err)
						}
					}
				)

				if (isMounted) {
					activeStreamRef.current = cleanup
					setIsLoading(false)
				} else {
					// If unmounted during setup, clean up immediately
					void cleanup()
				}
			} catch (e) {
				if (isMounted) {
					setError(String(e))
					setIsLoading(false)
				}
			}
		}

		startStream()

		return () => {
			isMounted = false
			if (activeStreamRef.current) {
				activeStreamRef.current()
			}
		}
	}, [containerId, enabled])

	return {
		data: logs,
		isLoading,
		error,
		refetch: async () => {
			/* No-op for stream */
		}
	}
}
