;(function installLayoutProbe() {
	if (window.top !== window) return

	const SLOW_MS = 3
	const slow = []
	const totals = {}
	window.__layoutProbe = { slow, totals }

	function callerStack() {
		return (new Error().stack || '')
			.split('\n')
			.slice(4, 11)
			.map((line) => line.replace(/@?https?:\/\/[^/]+\/assets\//, '@').trim())
			.join(' < ')
	}

	function record(name, ms) {
		const entry = totals[name] || (totals[name] = { n: 0, ms: 0 })
		entry.n += 1
		entry.ms += ms
		if (ms < SLOW_MS) return
		slow.push({
			name,
			ms: Math.round(ms),
			at: Math.round(performance.now()),
			stack: callerStack()
		})
	}

	function timed(name, run) {
		const start = performance.now()
		try {
			return run()
		} finally {
			record(name, performance.now() - start)
		}
	}

	function wrapMethod(owner, name) {
		const original = owner[name]
		if (typeof original !== 'function') return
		owner[name] = function wrapped(...args) {
			return timed(name, () => original.apply(this, args))
		}
	}

	function wrapGetter(prototype, name) {
		const descriptor = Object.getOwnPropertyDescriptor(prototype, name)
		if (!descriptor || !descriptor.get) return
		Object.defineProperty(prototype, name, {
			...descriptor,
			get() {
				return timed(name, () => descriptor.get.call(this))
			}
		})
	}

	for (const name of ['getBoundingClientRect', 'getClientRects', 'scrollIntoView']) {
		wrapMethod(Element.prototype, name)
	}
	wrapMethod(HTMLElement.prototype, 'focus')
	wrapMethod(window, 'getComputedStyle')
	wrapMethod(CSSStyleDeclaration.prototype, 'getPropertyValue')
	for (const name of ['offsetWidth', 'offsetHeight', 'offsetTop', 'offsetLeft', 'offsetParent']) {
		wrapGetter(HTMLElement.prototype, name)
	}
	for (const name of [
		'clientWidth',
		'clientHeight',
		'scrollWidth',
		'scrollHeight',
		'scrollTop',
		'scrollLeft'
	]) {
		wrapGetter(Element.prototype, name)
	}
	wrapGetter(window, 'innerWidth')
})()
