type StreamBatcher = {
	push: (delta: string) => void
	flush: () => void
	getContent: () => string
	dispose: () => void
}

export function createStreamBatcher(onFlush: (content: string) => void): StreamBatcher {
	let accumulated = ''
	let rafId: number | null = null

	function flushNow() {
		if (rafId !== null) {
			cancelAnimationFrame(rafId)
			rafId = null
		}
		onFlush(accumulated)
	}

	function scheduleFlush() {
		if (rafId !== null) return
		rafId = requestAnimationFrame(function () {
			rafId = null
			onFlush(accumulated)
		})
	}

	return {
		push(delta: string) {
			accumulated += delta
			scheduleFlush()
		},
		flush() {
			flushNow()
		},
		getContent() {
			return accumulated
		},
		dispose() {
			if (rafId !== null) {
				cancelAnimationFrame(rafId)
				rafId = null
			}
		}
	}
}
