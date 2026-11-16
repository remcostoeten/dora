;(function installCommitAttribution() {
	if (window.top !== window) return

	const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__
	const log = []
	window.__commitLog = log

	// React fiber tags for function, class, forwardRef, memo and simple memo components.
	const COMPOSITE_TAGS = new Set([0, 1, 11, 14, 15])
	const PERFORMED_WORK = 1

	function nameOf(fiber) {
		const type = fiber.type
		if (!type) return 'Unknown'
		if (typeof type === 'function') return type.displayName || type.name || 'Anonymous'
		if (type.render) {
			return type.displayName || type.render.displayName || type.render.name || 'ForwardRef'
		}
		if (type.type) {
			const inner = type.type
			return (
				type.displayName ||
				inner.displayName ||
				inner.name ||
				(inner.render && inner.render.name) ||
				'Memo'
			)
		}
		return type.displayName || 'Unknown'
	}

	function walk(fiber, parentRendered, tally) {
		const previous = fiber.alternate
		const rendered =
			COMPOSITE_TAGS.has(fiber.tag) &&
			(previous === null || (fiber.flags & PERFORMED_WORK) === PERFORMED_WORK)
		let childTime = 0
		// A subtree React bailed out of keeps the same child pointer as its alternate.
		if (previous === null || fiber.child !== previous.child) {
			let child = fiber.child
			while (child) {
				childTime += walk(child, parentRendered || rendered, tally)
				child = child.sibling
			}
		}
		if (!rendered) return childTime

		const name = nameOf(fiber)
		const total = fiber.actualDuration || 0
		const mounted = previous === null
		tally.count += 1
		if (!parentRendered) tally.roots.push(mounted ? `${name}(mount)` : name)
		const entry = tally.byName.get(name) || { self: 0, count: 0, mounts: 0 }
		entry.self += Math.max(0, total - childTime)
		entry.count += 1
		if (mounted) entry.mounts += 1
		tally.byName.set(name, entry)
		return total
	}

	function describe(name, entry) {
		const mounts = entry.mounts ? `(m${entry.mounts})` : ''
		return `${name}×${entry.count}${mounts}=${entry.self.toFixed(1)}`
	}

	hook.onCommitFiberRoot = (id, root) => {
		const at = performance.now()
		window.__doraPerf.commits.push(at)
		try {
			const tally = { count: 0, roots: [], byName: new Map() }
			const total = walk(root.current, false, tally)
			const top = [...tally.byName.entries()]
				.sort((a, b) => b[1].self - a[1].self)
				.slice(0, 14)
				.map(([name, entry]) => describe(name, entry))
			log.push({
				at,
				total: Math.round(total * 10) / 10,
				count: tally.count,
				roots: tally.roots.slice(0, 8),
				top
			})
		} catch (error) {
			log.push({ at, error: String(error) })
		}
	}
})()
