type EnvCfg = {
	enabled: boolean
	debug?: boolean
	remcoStoeten?: RemcoStoetenCfg
}

type RemcoStoetenCfg = {
	enabled: boolean
	url?: string
}

type EvtData = {
	name: string
	data?: Record<string, unknown>
}

type Provider = {
	name: string
	init: () => void
	send: (evt: EvtData) => void
}

type Bus = {
	list: Provider[]
}

let cfg: EnvCfg = {
	enabled: false,
	debug: false,
	remcoStoeten: {
		enabled: false
	}
}

let booted = false

let globalBus: Bus | null = null

export function getGlobalBus(): Bus | null {
	return globalBus
}

export function setCfg(next: Partial<EnvCfg>): void {
	cfg = { ...cfg, ...next }

	if (!globalBus) {
		globalBus = createBus()
	}

	bootLog()
}

export function createBus(): Bus {
	bootLog()

	const list: Provider[] = []

	if (cfg.enabled) {
		if (cfg.remcoStoeten?.enabled) {
			list.push(createRemcoStoeten())
		}
	}

	return { list }
}

export function sendEvt(bus: Bus, evt: EvtData): void {
	if (!cfg.enabled) return

	for (const p of bus.list) {
		p.send(evt)
	}

	devLog(evt)
}

function createRemcoStoeten(): Provider {
	let client: RemcoStoetenClient | null = null

	function init(): void {
		if (client) return

		const url =
			cfg.remcoStoeten?.url ??
			'https://ingestion-beryl.vercel.app/'

		client = {
			url,
			send(evt: EvtData) {
				fetch(this.url, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						name: evt.name,
						data: evt.data ?? {},
						timestamp: new Date().toISOString()
					})
				}).catch(() => {})
			}
		}
	}

	function send(evt: EvtData): void {
		init()
		client?.send(evt)
	}

	return {
		name: 'remcoStoeten',
		init,
		send
	}
}

type RemcoStoetenClient = {
	url: string
	send: (evt: EvtData) => void
}

function devLog(evt: EvtData): void {
	if (!cfg.debug) return

	const isDev = import.meta.env.DEV

	if (!isDev) return

	console.group('analytics:event')
	console.log('name:', evt.name)
	console.log('data:', evt.data ?? {})
	console.groupEnd()
}

function bootLog(): void {
	if (booted) return

	booted = true

	const mode = import.meta.env.MODE ?? 'unknown'

	const lines: string[] = []

	lines.push('')
	lines.push('analytics configuration')
	lines.push('mode: ' + mode)
	lines.push('enabled: ' + bool(cfg.enabled))

	if (cfg.remcoStoeten) {
		lines.push('remcoStoeten: ' + bool(cfg.remcoStoeten.enabled))
	}

	lines.push('debug: ' + bool(cfg.debug))
	lines.push('')

	console.log('='.repeat(40))

	for (const line of lines) {
		console.log(line)
	}

	console.log('='.repeat(40))
}

function bool(v: boolean | undefined): string {
	return v ? 'on' : 'off'
}
