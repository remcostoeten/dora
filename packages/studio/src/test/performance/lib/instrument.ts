/**
 * Browser-side instrumentation, injected with `page.addInitScript` before any
 * application code runs.
 *
 * It installs three probes and touches no product code:
 *
 * - a React DevTools global hook shim, which React calls on every commit, so
 *   commits can be counted per interaction;
 * - a long-animation-frame observer, for the frames an interaction costs;
 * - a MutationObserver counting Monaco instance creations, which is how the
 *   "one editor per session" invariant is checked.
 *
 * The function is serialized to source by Playwright, so it must stay
 * self-contained: no imports, no closure over module scope.
 */

export type LoafEntry = {
	start: number
	duration: number
	name: string
	blockingDuration: number
}

export type PerfState = {
	/** `performance.now()` of every React commit on any root. */
	commits: number[]
	/** Long-animation-frame entries, oldest first. */
	loaf: LoafEntry[]
	/** How many times a Monaco editor root has been added to the DOM. */
	monacoCreations: number
	/** Node parked by a scenario so a later step can test `isConnected`. */
	tracked: Element | null
	/** Adapter calls counted by name, when the adapter probe is installed. */
	adapterCalls: Record<string, number>
}

export const PERF_STATE_KEY = '__doraPerf'

export function installPerfInstrumentation() {
	const state = {
		commits: [] as number[],
		loaf: [] as Array<{
			start: number
			duration: number
			name: string
			blockingDuration: number
		}>,
		monacoCreations: 0,
		tracked: null as Element | null,
		adapterCalls: {} as Record<string, number>
	}

	;(window as unknown as Record<string, unknown>).__doraPerf = state

	let nextRendererId = 0
	const renderers = new Map<number, unknown>()

	/**
	 * React looks for this hook at module init and, when it finds one, reports
	 * every commit to it. This is the same contract React DevTools uses; the
	 * shim implements the minimum React calls into.
	 */
	const hook = {
		renderers,
		supportsFiber: true,
		isDisabled: false,
		inject(renderer: unknown): number {
			nextRendererId += 1
			renderers.set(nextRendererId, renderer)
			return nextRendererId
		},
		onCommitFiberRoot(): void {
			state.commits.push(performance.now())
		},
		onPostCommitFiberRoot(): void {},
		onCommitFiberUnmount(): void {},
		onScheduleFiberRoot(): void {},
		checkDCE(): void {},
		emit(): void {},
		on(): void {},
		off(): void {},
		sub(): () => void {
			return function unsubscribe() {}
		},
		getFiberRoots(): Set<unknown> {
			return new Set()
		}
	}

	Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
		value: hook,
		configurable: true,
		writable: true
	})

	function observeLongFrames(type: string) {
		try {
			const observer = new PerformanceObserver(function onEntries(list) {
				for (const entry of list.getEntries()) {
					const record = entry as PerformanceEntry & { blockingDuration?: number }
					state.loaf.push({
						start: entry.startTime,
						duration: entry.duration,
						name: entry.name,
						blockingDuration: record.blockingDuration ?? 0
					})
				}
			})
			observer.observe({ type, buffered: true } as PerformanceObserverInit)
			return true
		} catch {
			return false
		}
	}

	// Chromium 123+ reports long-animation-frame; long-task is the fallback and
	// is coarser (it misses frames slow from layout rather than script).
	if (!observeLongFrames('long-animation-frame')) {
		observeLongFrames('longtask')
	}

	/**
	 * Driving primitives the scenarios call from inside the page. Keeping them
	 * here means a scenario is one `page.evaluate` with no round-trip in the
	 * measured window — at a 16 ms budget, a 1 ms round-trip is 6% of the number.
	 */
	;(window as unknown as Record<string, unknown>).__doraPerfKit = {
		frame(): Promise<void> {
			return new Promise(function resolver(resolve) {
				requestAnimationFrame(function onFrame() {
					resolve()
				})
			})
		},
		async settle(): Promise<void> {
			const kit = (window as unknown as { __doraPerfKit: { frame(): Promise<void> } })
				.__doraPerfKit
			await kit.frame()
			await kit.frame()
		},
		async waitFor(test: () => boolean, timeoutMs: number): Promise<boolean> {
			const kit = (window as unknown as { __doraPerfKit: { frame(): Promise<void> } })
				.__doraPerfKit
			const deadline = performance.now() + timeoutMs
			while (performance.now() < deadline) {
				if (test()) return true
				await kit.frame()
			}
			return test()
		},
		click(selector: string): boolean {
			const node = document.querySelector(selector)
			if (!(node instanceof HTMLElement)) return false
			node.click()
			return true
		},
		text(selector: string): string {
			return document.querySelector(selector)?.textContent ?? ''
		}
	}

	/**
	 * Counts distinct Monaco root elements over the session by identity rather
	 * than by insertion: Monaco inserts a bare div and adds `.monaco-editor` to
	 * it afterwards, so watching `addedNodes` for the class misses every
	 * instance and reports a reassuring 1 forever.
	 */
	let lastEditorRoot: Element | null = null
	function sampleEditorRoots() {
		const root = document.querySelector('.monaco-editor')
		if (root && root !== lastEditorRoot) {
			lastEditorRoot = root
			state.monacoCreations += 1
		}
	}

	// `document`, not `document.documentElement`: an init script runs before the
	// document is parsed, where `documentElement` is still null and `observe`
	// throws — silently taking the rest of this function with it.
	const monacoObserver = new MutationObserver(sampleEditorRoots)
	monacoObserver.observe(document, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ['class']
	})
}
