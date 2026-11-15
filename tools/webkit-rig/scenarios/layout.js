async function run() {
	const rig = window.__rig
	const { select } = rig
	const probe = window.__layoutProbe
	const captures = []

	async function capture(label, action, waitMs) {
		const fromSlow = probe.slow.length
		const before = JSON.parse(JSON.stringify(probe.totals))
		const start = performance.now()
		action()
		const sync = Math.round(performance.now() - start)
		await rig.sleep(waitMs)
		const totals = {}
		for (const [name, entry] of Object.entries(probe.totals)) {
			const prior = before[name] || { n: 0, ms: 0 }
			if (entry.ms - prior.ms < 1) continue
			totals[name] = { n: entry.n - prior.n, ms: Math.round(entry.ms - prior.ms) }
		}
		const slow = probe.slow
			.slice(fromSlow, fromSlow + 12)
			.map((entry) => ({ ...entry, at: entry.at - Math.round(start) }))
		captures.push({ label, sync, totals, slow })
	}

	await rig.waitFor(() => document.querySelector(select.cell) !== null, 30000)
	await rig.sleep(2000)

	for (let index = 0; index < 2; index += 1) {
		await capture(`menu open #${index}`, () => rig.press(select.connectionTrigger), 600)
		await capture(
			`dialog open #${index}`,
			() => rig.click(select.menuItem('Add connection')),
			1200
		)
		await capture(`dialog close #${index}`, () => rig.key('Escape'), 900)
		rig.key('Escape')
		await rig.sleep(500)
	}

	rig.click(select.tableItem('perf_regions'))
	await rig.sleep(900)
	await capture('table switch', () => rig.click(select.tableItem('perf_accounts')), 700)
	await capture('view -> console', () => rig.click(select.navItem('SQL Console')), 1500)
	await capture('view -> viewer', () => rig.click(select.navItem('Data Viewer')), 900)
	await capture('view -> console again', () => rig.click(select.navItem('SQL Console')), 900)

	return JSON.stringify(captures)
}

window.__rigScenario = run
