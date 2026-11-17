import { useState } from 'react'
import type { DockerContainer } from '../types'

type Props = {
	container: DockerContainer
	showSecrets: boolean
}

type Tab = 'ports' | 'env' | 'volumes'

// Env keys whose values should stay hidden until the user reveals secrets.
const SECRET_KEY_PATTERN = /PASSWORD|SECRET|TOKEN|_KEY$/i

function splitEnv(entry: string): [string, string] {
	const index = entry.indexOf('=')
	return index === -1 ? [entry, ''] : [entry.slice(0, index), entry.slice(index + 1)]
}

export function ConfigCard({ container, showSecrets }: Props) {
	const [tab, setTab] = useState<Tab>('ports')
	const tabs: Array<{ id: Tab; label: string; count: number }> = [
		{ id: 'ports', label: 'Ports', count: container.ports.length },
		{ id: 'env', label: 'Environment', count: container.env.length },
		{ id: 'volumes', label: 'Volumes', count: container.volumes.length }
	]

	function renderRows() {
		if (tab === 'ports') {
			if (container.ports.length === 0) {
				return <div className='dk-t-empty'>No published ports.</div>
			}
			return container.ports.map((port) => (
				<div
					key={`${port.hostPort}-${port.containerPort}-${port.protocol}`}
					className='dk-tr dk-mono'
				>
					<span className='dk-tr-a'>0.0.0.0:{port.hostPort}</span>
					<span className='dk-tr-b'>
						<span className='dk-arrow'>→</span>
						{port.containerPort}/{port.protocol}
					</span>
					<span className='dk-tr-c'>
						{port.hostPort === port.containerPort ? 'same' : 'mapped'}
					</span>
				</div>
			))
		}

		if (tab === 'env') {
			if (container.env.length === 0) {
				return <div className='dk-t-empty'>No environment variables.</div>
			}
			return container.env.map((entry) => {
				const [key, value] = splitEnv(entry)
				const isSecret = SECRET_KEY_PATTERN.test(key)
				return (
					<div key={entry} className='dk-tr dk-mono'>
						<span className='dk-tr-a' title={key}>
							{key}
						</span>
						<span className='dk-tr-b'>
							{isSecret && !showSecrets ? '••••••••' : value}
						</span>
						<span className='dk-tr-c'>{isSecret ? 'secret' : ''}</span>
					</div>
				)
			})
		}

		if (container.volumes.length === 0) {
			return (
				<div className='dk-t-empty'>
					No volumes. Data is lost when this container is removed.
				</div>
			)
		}
		return container.volumes.map((volume) => (
			<div key={`${volume.name}-${volume.mountPath}`} className='dk-tr dk-mono'>
				<span className='dk-tr-a' title={volume.name}>
					{volume.name}
				</span>
				<span className='dk-tr-b' title={volume.mountPath}>
					<span className='dk-arrow'>→</span>
					{volume.mountPath}
				</span>
				<span className='dk-tr-c'>{volume.isEphemeral ? 'ephemeral' : 'volume'}</span>
			</div>
		))
	}

	return (
		<section className='dk-card' style={{ gridArea: 'cfg' }} aria-label='Configuration'>
			<div className='dk-card-h'>
				<div className='dk-seg' role='tablist' aria-label='Configuration'>
					{tabs.map((item) => (
						<button
							key={item.id}
							type='button'
							role='tab'
							aria-selected={tab === item.id}
							onClick={() => setTab(item.id)}
						>
							{item.label}
							<span className='dk-seg-n dk-mono'>{item.count}</span>
						</button>
					))}
				</div>
			</div>
			<div role='tabpanel'>{renderRows()}</div>
		</section>
	)
}
