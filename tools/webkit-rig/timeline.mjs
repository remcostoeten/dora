const port = process.env.INSPECTOR_PORT || '9333'
const scenarioNames = (process.argv[2] || 'table').split(',')
const minimumMs = Number(process.env.RIG_MIN_MS || 4)
const RENDERING = ['Layout', 'RecalculateStyles', 'Paint', 'Composite']

const pending = new Map()
const events = []
let nextId = 1
let targetId = null

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

function connect() {
	return new Promise((resolve, reject) => {
		const socket = new WebSocket(`ws://127.0.0.1:${port}/socket/1/1/WebPage`)
		socket.addEventListener('open', () => resolve(socket))
		socket.addEventListener('error', () => reject(new Error('inspector socket failed')))
	})
}

const socket = await connect()

socket.addEventListener('message', (message) => {
	const outer = JSON.parse(message.data)
	if (outer.method === 'Target.targetCreated') {
		targetId = outer.params.targetInfo.targetId
		return
	}
	if (outer.method !== 'Target.dispatchMessageFromTarget') return
	const inner = JSON.parse(outer.params.message)
	const waiter = inner.id ? pending.get(inner.id) : undefined
	if (waiter) {
		pending.delete(inner.id)
		if (inner.error) waiter.reject(new Error(JSON.stringify(inner.error)))
		else waiter.resolve(inner.result)
		return
	}
	if (inner.method) events.push(inner)
})

function send(method, params = {}) {
	const id = nextId++
	const message = JSON.stringify({ id, method, params })
	const envelope = {
		id: nextId++,
		method: 'Target.sendMessageToTarget',
		params: { targetId, message }
	}
	return new Promise((resolve, reject) => {
		pending.set(id, { resolve, reject })
		socket.send(JSON.stringify(envelope))
	})
}

async function evaluate(expression) {
	const reply = await send('Runtime.evaluate', {
		expression,
		returnByValue: true,
		emulateUserGesture: true
	})
	if (reply.wasThrown)
		throw new Error(`page threw: ${JSON.stringify(reply.result).slice(0, 300)}`)
	return reply.result.value
}

function flatten(record, depth, parentType, flat) {
	const duration = record.endTime === undefined ? 0 : (record.endTime - record.startTime) * 1000
	let childTime = 0
	for (const child of record.children || []) {
		childTime += flatten(child, depth + 1, record.type, flat)
	}
	flat.push({
		type: record.type,
		start: record.startTime,
		duration,
		self: Math.max(0, duration - childTime),
		depth,
		parentType,
		data: record.data,
		stack: record.stackTrace
	})
	return duration
}

function frameLabel(frame) {
	const file = (frame.url || '').split('/').pop() || ''
	return `${frame.functionName || frame.name || '(anon)'}@${file}:${frame.lineNumber ?? frame.line}`
}

function clipLabel(data) {
	const clip = data && data.clip
	if (!clip) return ''
	const width = Math.round(clip[2] - clip[0])
	const height = Math.round(clip[5] - clip[1])
	return ` clip=${width}x${height}@${Math.round(clip[0])},${Math.round(clip[1])}`
}

function printRecords(records) {
	const byType = new Map()
	for (const record of records) {
		const entry = byType.get(record.type) || { count: 0, self: 0 }
		entry.count += 1
		entry.self += record.self
		byType.set(record.type, entry)
	}
	const summary = [...byType.entries()]
		.filter(([, entry]) => entry.self >= 0.5)
		.sort((a, b) => b[1].self - a[1].self)
		.map(([type, entry]) => `${type}×${entry.count}=${entry.self.toFixed(0)}ms`)
	console.log(`  self time by record: ${summary.join('  ')}`)

	const origin = Math.min(...records.map((record) => record.start))
	const heavy = records
		.filter((record) => RENDERING.includes(record.type) && record.duration >= minimumMs)
		.sort((a, b) => a.start - b.start)
	for (const record of heavy.slice(0, 30)) {
		const at = ((record.start - origin) * 1000).toFixed(0).padStart(4)
		const forced = record.depth > 0 ? ` FORCED inside ${record.parentType}` : ''
		const frames = Array.isArray(record.stack) ? record.stack : (record.stack?.callFrames ?? [])
		const stack = frames.slice(0, 4).map(frameLabel).join(' < ')
		console.log(
			`    t+${at}ms ${record.type.padEnd(18)} ${record.duration.toFixed(1).padStart(6)}ms${forced}${clipLabel(record.data)} ${stack}`
		)
	}
}

function printSamples(samples) {
	const traces = samples.stackTraces
	const selfMs = new Map()
	for (const trace of traces) {
		const top = trace.stackFrames[0]
		if (!top) continue
		const label = `${top.name || '(anon)'}@${(top.url || '').split('/').pop()}:${top.line}`
		selfMs.set(label, (selfMs.get(label) || 0) + 1)
	}
	const top = [...selfMs.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 14)
		.map(([label, ms]) => `${label}=${ms}ms`)
	console.log(`  JS: about ${traces.length} ms sampled; top self: ${top.join('  ')}`)
}

async function profile(label, action, waitMs) {
	events.length = 0
	await send('ScriptProfiler.startTracking', { includeSamples: true })
	await send('Timeline.start', { maxCallStackDepth: 12 })
	await sleep(120)
	await evaluate(action)
	await sleep(waitMs)
	await send('Timeline.stop')
	await send('ScriptProfiler.stopTracking')
	await sleep(500)

	const records = []
	let samples = null
	for (const event of events) {
		if (event.method === 'Timeline.eventRecorded')
			flatten(event.params.record, 0, null, records)
		if (event.method === 'ScriptProfiler.trackingComplete') samples = event.params.samples
	}
	console.log(`\n### ${label}`)
	if (records.length > 0) printRecords(records)
	if (samples?.stackTraces) printSamples(samples)
}

function tableItem(name) {
	return `window.__rig.click(window.__rig.select.tableItem('${name}'))`
}

function navItem(label) {
	return `window.__rig.click(window.__rig.select.navItem('${label}'))`
}

const openConnectionMenu = 'window.__rig.press(window.__rig.select.connectionTrigger)'
const clickAddConnection = `window.__rig.click(window.__rig.select.menuItem('Add connection'))`
const pressEscape = `window.__rig.key('Escape')`
const scrollGrid = `(() => {
	const scroller = window.__rig.scrollerOf(document.querySelector(window.__rig.select.grid))
	const span = scroller.scrollHeight - scroller.clientHeight
	const start = performance.now()
	function tick(now) {
		scroller.scrollTop = ((now - start) * 0.9) % span
		if (now - start < 1200) requestAnimationFrame(tick)
	}
	requestAnimationFrame(tick)
})()`

async function prime(action, waitMs) {
	await evaluate(action)
	await sleep(waitMs)
}

const scenarios = {
	async table() {
		await prime(tableItem('perf_accounts'), 900)
		await prime(tableItem('perf_regions'), 900)
		await profile('cached table switch A', tableItem('perf_accounts'), 700)
		await profile('cached table switch B', tableItem('perf_regions'), 700)
	},
	async view() {
		await prime(navItem('SQL Console'), 1800)
		await prime(navItem('Data Viewer'), 1200)
		await profile('view -> console', navItem('SQL Console'), 800)
		await profile('view -> viewer', navItem('Data Viewer'), 800)
	},
	async menu() {
		await prime(openConnectionMenu, 700)
		await prime(pressEscape, 700)
		await profile('connection menu open', openConnectionMenu, 600)
		await profile('connection menu close', pressEscape, 600)
	},
	async dialog() {
		for (let index = 0; index < 2; index += 1) {
			await prime(openConnectionMenu, 700)
			await profile(`add connection dialog open #${index}`, clickAddConnection, 1000)
			await profile(`add connection dialog close #${index}`, pressEscape, 800)
			await prime(pressEscape, 500)
		}
	},
	async scroll() {
		await prime(tableItem('perf_events'), 1000)
		await profile('grid scroll 1.2s', scrollGrid, 1500)
	},
	async idle() {
		await profile('idle 1s', 'undefined', 1000)
	},
	async custom() {
		if (process.env.RIG_SETUP)
			await prime(process.env.RIG_SETUP, Number(process.env.RIG_SETUP_WAIT || 1000))
		const repeats = Number(process.env.RIG_REPEAT || 2)
		for (let index = 0; index < repeats; index += 1) {
			await profile(
				`custom #${index}`,
				process.env.RIG_ACTION,
				Number(process.env.RIG_WAIT || 800)
			)
			if (process.env.RIG_RESET)
				await prime(process.env.RIG_RESET, Number(process.env.RIG_RESET_WAIT || 800))
		}
	}
}

for (let attempt = 0; attempt < 50 && !targetId; attempt += 1) await sleep(100)
if (!targetId) {
	console.error('The inspector did not announce a page target')
	process.exit(1)
}

// WebKit only starts the clock behind record timestamps once these domains are enabled.
for (const method of [
	'Inspector.enable',
	'Inspector.initialized',
	'Page.enable',
	'Debugger.enable'
]) {
	await send(method).catch(() => undefined)
}
await send('Timeline.enable')

for (const name of scenarioNames) {
	const scenario = scenarios[name]
	if (scenario) await scenario()
	else console.error(`unknown scenario ${name}, have: ${Object.keys(scenarios).join(', ')}`)
}
socket.close()
process.exit(0)
