async function run() {
	const rig = window.__rig
	await rig.waitFor(() => document.querySelector(rig.select.cell) !== null, 30000)
	await rig.sleep(Number(window.__rigOnly || 20000))
	return 'held'
}

window.__rigScenario = run
