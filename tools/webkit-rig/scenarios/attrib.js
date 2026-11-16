async function run() {
	const rig = window.__rig
	const { select } = rig
	const log = window.__commitLog
	const captures = []

	async function capture(label, action, waitMs) {
		const from = log.length
		const start = performance.now()
		action()
		const sync = Math.round(performance.now() - start)
		await rig.sleep(waitMs)
		const commits = log.slice(from).map((entry) => ({
			t: Math.round(entry.at - start),
			ms: entry.total,
			n: entry.count,
			roots: entry.roots,
			top: entry.top,
			error: entry.error
		}))
		captures.push({ label, sync, commits })
	}

	await rig.waitFor(() => document.querySelector(select.cell) !== null, 30000)
	await rig.sleep(2000)

	if (rig.wants('table')) {
		for (const name of ['perf_accounts', 'perf_regions']) {
			rig.click(select.tableItem(name))
			await rig.sleep(900)
		}
		await capture(
			'cached table switch A',
			() => rig.click(select.tableItem('perf_accounts')),
			700
		)
		await capture(
			'cached table switch B',
			() => rig.click(select.tableItem('perf_regions')),
			700
		)
	}

	if (rig.wants('view')) {
		rig.click(select.navItem('SQL Console'))
		await rig.sleep(1500)
		rig.click(select.navItem('Data Viewer'))
		await rig.sleep(1000)
		await capture('view -> console', () => rig.click(select.navItem('SQL Console')), 700)
		await capture('view -> viewer', () => rig.click(select.navItem('Data Viewer')), 700)
	}

	if (rig.wants('menu')) {
		rig.press(select.connectionTrigger)
		await rig.sleep(700)
		rig.key('Escape')
		await rig.sleep(700)
		await capture('connection menu open', () => rig.press(select.connectionTrigger), 600)
		await capture('connection menu close', () => rig.key('Escape'), 600)
	}

	if (rig.wants('dialog')) {
		for (let index = 0; index < 2; index += 1) {
			rig.press(select.connectionTrigger)
			await rig.waitFor(() => select.menuItem('Add connection') !== undefined, 3000)
			await rig.sleep(400)
			await capture(
				`add connection dialog open #${index}`,
				() => rig.click(select.menuItem('Add connection')),
				1200
			)
			await capture(`add connection dialog close #${index}`, () => rig.key('Escape'), 900)
			rig.key('Escape')
			await rig.sleep(500)
		}
	}

	if (rig.wants('connection')) {
		for (const id of ['perf-conn-01', 'perf-conn-00', 'perf-conn-01']) {
			const item = select.connectionItem(id)
			rig.press(select.connectionTrigger)
			await rig.waitFor(() => document.querySelector(item) !== null, 3000)
			await rig.sleep(400)
			await capture(`connection switch -> ${id}`, () => rig.click(item), 1500)
			rig.key('Escape')
			await rig.sleep(400)
		}
	}

	return JSON.stringify(captures)
}

window.__rigScenario = run
