;(function installRigKit() {
	if (window.top !== window) return

	try {
		window.__DORA_CAPTURE_MODE = true
		localStorage.setItem('dora_perf_fixtures', '1')
		localStorage.setItem('dora_has_seen_scroll_hint', 'true')
		localStorage.setItem('dora_onboarding_tour_completed', '1')
		sessionStorage.setItem('dora_demo_notice_dismissed', 'true')
	} catch (error) {
		console.warn('[rig] storage unavailable', error)
	}

	const state = { commits: [], errors: [] }
	window.__doraPerf = state
	window.addEventListener('error', (event) => state.errors.push(String(event.message)))

	let nextRendererId = 0
	const renderers = new Map()
	Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
		value: {
			renderers,
			supportsFiber: true,
			isDisabled: false,
			inject(renderer) {
				nextRendererId += 1
				renderers.set(nextRendererId, renderer)
				return nextRendererId
			},
			onCommitFiberRoot() {
				state.commits.push(performance.now())
			},
			onPostCommitFiberRoot() {},
			onCommitFiberUnmount() {},
			onScheduleFiberRoot() {},
			checkDCE() {},
			emit() {},
			on() {},
			off() {},
			sub() {
				return () => {}
			},
			getFiberRoots() {
				return new Set()
			}
		},
		configurable: true,
		writable: true
	})

	function frame() {
		return new Promise((resolve) => requestAnimationFrame(() => resolve(performance.now())))
	}

	function sleep(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}

	function quantile(sorted, fraction) {
		if (sorted.length === 0) return 0
		return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]
	}

	function round(value) {
		return Math.round(value * 10) / 10
	}

	function summarize(samples) {
		const sorted = [...samples].sort((a, b) => a - b)
		return {
			n: samples.length,
			p50: round(quantile(sorted, 0.5)),
			p95: round(quantile(sorted, 0.95)),
			max: round(sorted[sorted.length - 1] ?? 0)
		}
	}

	function resolveNode(target) {
		return typeof target === 'string' ? document.querySelector(target) : target
	}

	async function settle() {
		await frame()
		await frame()
	}

	async function waitFor(test, timeoutMs) {
		const deadline = performance.now() + timeoutMs
		while (performance.now() < deadline) {
			if (test()) return true
			await frame()
		}
		return test()
	}

	function click(target) {
		const node = resolveNode(target)
		if (!(node instanceof HTMLElement)) return false
		node.click()
		return true
	}

	function press(target) {
		const node = resolveNode(target)
		if (!(node instanceof HTMLElement)) return false
		const rect = node.getBoundingClientRect()
		const init = {
			bubbles: true,
			cancelable: true,
			composed: true,
			button: 0,
			buttons: 1,
			clientX: rect.left + rect.width / 2,
			clientY: rect.top + rect.height / 2,
			pointerId: 1,
			pointerType: 'mouse',
			isPrimary: true
		}
		node.dispatchEvent(new PointerEvent('pointerdown', init))
		node.dispatchEvent(new MouseEvent('mousedown', init))
		node.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }))
		node.dispatchEvent(new MouseEvent('mouseup', { ...init, buttons: 0 }))
		node.click()
		return true
	}

	function key(name, options) {
		const target = document.activeElement || document.body
		const init = { key: name, bubbles: true, cancelable: true, composed: true, ...options }
		target.dispatchEvent(new KeyboardEvent('keydown', init))
		target.dispatchEvent(new KeyboardEvent('keyup', init))
	}

	function text(selector) {
		return document.querySelector(selector)?.textContent ?? ''
	}

	function scrollerOf(node) {
		let candidate = node
		while (candidate) {
			const overflows = candidate.scrollHeight > candidate.clientHeight + 10
			if (overflows && getComputedStyle(candidate).overflowY !== 'visible') return candidate
			candidate = candidate.parentElement
		}
		return null
	}

	async function interaction(action, done, watchMs) {
		const commitsBefore = state.commits.length
		const gaps = []
		let watching = true
		let last = performance.now()
		const start = last
		function tick(now) {
			gaps.push(now - last)
			last = now
			if (watching) requestAnimationFrame(tick)
		}
		requestAnimationFrame(tick)
		action()
		const sync = performance.now() - start
		await waitFor(done, 10000)
		const ready = performance.now() - start
		await settle()
		const painted = performance.now() - start
		const remaining = watchMs - (performance.now() - start)
		if (remaining > 0) await sleep(remaining)
		watching = false
		await frame()
		return {
			sync,
			ready,
			painted,
			commits: state.commits.length - commitsBefore,
			worstGap: Math.max(...gaps.slice(1), 0),
			frames: gaps.length - 1
		}
	}

	async function frames(durationMs, perFrame) {
		const deltas = []
		let last = performance.now()
		const start = last
		while (last - start < durationMs) {
			const now = await frame()
			deltas.push(now - last)
			last = now
			if (perFrame) perFrame(now - start)
		}
		const total = deltas.reduce((sum, delta) => sum + delta, 0)
		return { fps: round(1000 / (total / deltas.length)), ...summarize(deltas) }
	}

	function collect(runs) {
		const summary = {}
		for (const metric of ['sync', 'ready', 'painted', 'worstGap', 'commits']) {
			summary[metric] = summarize(runs.map((run) => run[metric]))
		}
		return summary
	}

	const select = {
		cell: '[data-cell-key="0:1"]',
		gridHead: 'table[role="grid"] thead',
		grid: 'table[role="grid"]',
		tree: '[role="tree"]',
		editor: '.monaco-editor',
		dialog: '[role="dialog"]',
		menu: '[role="menu"]',
		connectionTrigger: 'button[aria-label^="Change database connection"]',
		tableItem(name) {
			return `[role="treeitem"][aria-label^="${name},"]`
		},
		navItem(label) {
			return `[role="menuitem"][aria-label="${label}"]`
		},
		connectionItem(id) {
			return `[data-connection-id="${id}"]`
		},
		menuItem(label) {
			return [...document.querySelectorAll('[role="menu"] [role="menuitem"]')].find((node) =>
				(node.textContent || '').trim().startsWith(label)
			)
		}
	}

	function isVisible(selector) {
		const node = document.querySelector(selector)
		return node !== null && node.getBoundingClientRect().width > 0
	}

	async function closeMenus() {
		key('Escape')
		await waitFor(() => document.querySelector(select.menu) === null, 3000)
		await settle()
	}

	function wants(group) {
		const only = (window.__rigOnly || '').split(',').filter(Boolean)
		return only.length === 0 || only.includes(group)
	}

	window.__rig = {
		select,
		isVisible,
		closeMenus,
		wants,
		frame,
		sleep,
		settle,
		waitFor,
		click,
		press,
		key,
		text,
		scrollerOf,
		interaction,
		frames,
		collect,
		summarize
	}
})()
