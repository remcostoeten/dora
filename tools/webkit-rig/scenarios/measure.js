async function run() {
	const rig = window.__rig
	const { select } = rig
	const report = { w: innerWidth, h: innerHeight, dpr: devicePixelRatio }

	await rig.waitFor(() => document.querySelector(select.cell) !== null, 30000)
	await rig.settle()
	await rig.sleep(1500)

	if (rig.wants('idle')) {
		report.idle = await rig.frames(1500)
	}

	if (rig.wants('tableSwitchCached')) {
		const tables = ['perf_accounts', 'perf_regions']
		for (const name of tables) {
			const previous = rig.text(select.cell)
			rig.click(select.tableItem(name))
			await rig.waitFor(() => rig.text(select.cell) !== previous, 10000)
			await rig.sleep(600)
		}
		const runs = []
		for (let index = 0; index < 22; index += 1) {
			const previous = rig.text(select.cell)
			runs.push(
				await rig.interaction(
					() => rig.click(select.tableItem(tables[index % 2])),
					() => rig.text(select.cell) !== previous && rig.text(select.cell) !== '',
					450
				)
			)
		}
		report.tableSwitchCached = rig.collect(runs.slice(2))
	}

	if (rig.wants('tableSwitchWalk')) {
		const names = [...document.querySelectorAll('[role="treeitem"]')]
			.map((node) => (node.getAttribute('aria-label') || '').split(',')[0])
			.filter((name) => name && !name.startsWith('perf_'))
			.slice(0, 12)
		const runs = []
		for (const name of names) {
			const previous = rig.text(select.gridHead)
			runs.push(
				await rig.interaction(
					() => rig.click(select.tableItem(name)),
					() =>
						rig.text(select.gridHead) !== previous && rig.text(select.gridHead) !== '',
					500
				)
			)
		}
		report.tableSwitchWalk = rig.collect(runs)
	}

	if (rig.wants('gridScroll')) {
		rig.click(select.tableItem('perf_events'))
		await rig.sleep(900)
		const grid = rig.scrollerOf(document.querySelector(select.grid))
		if (grid) {
			const span = grid.scrollHeight - grid.clientHeight
			report.gridScroll = await rig.frames(2500, (elapsed) => {
				grid.scrollTop = Math.abs(((elapsed * 0.9) % (span * 2)) - span)
			})
			grid.scrollTop = 0
		}
		const list = rig.scrollerOf(document.querySelector(select.tree))
		if (list) {
			const span = list.scrollHeight - list.clientHeight
			report.sidebarScroll = await rig.frames(2500, (elapsed) => {
				list.scrollTop = Math.abs(((elapsed * 1.2) % (span * 2)) - span)
			})
			list.scrollTop = 0
		}
		await rig.settle()
	}

	if (rig.wants('viewSwitch')) {
		const toConsole = []
		const toViewer = []
		for (let index = 0; index < 9; index += 1) {
			toConsole.push(
				await rig.interaction(
					() => rig.click(select.navItem('SQL Console')),
					() => rig.isVisible(select.editor),
					450
				)
			)
			toViewer.push(
				await rig.interaction(
					() => rig.click(select.navItem('Data Viewer')),
					() => rig.isVisible(select.cell),
					450
				)
			)
		}
		report.viewToConsole = rig.collect(toConsole.slice(1))
		report.viewToViewer = rig.collect(toViewer.slice(1))
	}

	if (rig.wants('connectionMenu')) {
		const opens = []
		const closes = []
		for (let index = 0; index < 7; index += 1) {
			opens.push(
				await rig.interaction(
					() => rig.press(select.connectionTrigger),
					() => document.querySelector(select.menu) !== null,
					400
				)
			)
			closes.push(
				await rig.interaction(
					() => rig.key('Escape'),
					() => document.querySelector(select.menu) === null,
					400
				)
			)
		}
		report.connectionMenuOpen = rig.collect(opens.slice(1))
		report.connectionMenuClose = rig.collect(closes.slice(1))
	}

	if (rig.wants('addConnectionDialog')) {
		const opens = []
		const closes = []
		for (let index = 0; index < 6; index += 1) {
			rig.press(select.connectionTrigger)
			await rig.waitFor(() => select.menuItem('Add connection') !== undefined, 3000)
			await rig.sleep(300)
			opens.push(
				await rig.interaction(
					() => rig.click(select.menuItem('Add connection')),
					() => document.querySelector(select.dialog) !== null,
					700
				)
			)
			closes.push(
				await rig.interaction(
					() => rig.key('Escape'),
					() => document.querySelector(select.dialog) === null,
					500
				)
			)
			await rig.closeMenus()
		}
		report.addConnectionOpenFirst = opens[0]
		report.addConnectionOpen = rig.collect(opens.slice(1))
		report.addConnectionClose = rig.collect(closes.slice(1))
	}

	if (rig.wants('connectionSwitch')) {
		const runs = []
		const ids = ['perf-conn-01', 'perf-conn-00']
		for (let index = 0; index < 8; index += 1) {
			const item = select.connectionItem(ids[index % 2])
			rig.press(select.connectionTrigger)
			await rig.waitFor(() => document.querySelector(item) !== null, 3000)
			await rig.sleep(300)
			const previous = rig.text(select.cell)
			runs.push(
				await rig.interaction(
					() => rig.click(item),
					() => rig.text(select.cell) !== previous && rig.text(select.cell) !== '',
					900
				)
			)
			await rig.closeMenus()
		}
		report.connectionSwitch = rig.collect(runs.slice(2))
	}

	report.errors = window.__doraPerf.errors.slice(0, 5)
	return JSON.stringify(report)
}

window.__rigScenario = run
