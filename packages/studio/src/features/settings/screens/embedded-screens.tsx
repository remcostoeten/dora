import type { ReactNode } from 'react'
import { AiUsageSection } from '@studio/features/ai-assistant/ai-usage-section'
import { OllamaModelsSection } from '@studio/features/ai-assistant/ollama-models-section'
import { useAiSelection } from '@studio/features/ai-assistant/ai-selection-store'
import { UpdateSection } from '@studio/features/updater/update-section'
import { AiKeysSection } from '@studio/features/sidebar/components/ai-keys-section'
import { BuildCacheSection } from '@studio/features/sidebar/components/build-cache-section'
import { StorageSection } from '@studio/features/sidebar/components/storage-section'
import { SettingCard } from '../components/setting-primitives'

function Embedded({ children, focusId }: { children: ReactNode; focusId?: string }) {
	return (
		<SettingCard className='p-4'>
			<div tabIndex={-1} data-settings-focus={focusId} className='outline-none'>
				{children}
			</div>
		</SettingCard>
	)
}

export function OllamaModelsScreen() {
	return (
		<Embedded>
			<OllamaModelsSection />
		</Embedded>
	)
}

export function AiKeysScreen() {
	const selection = useAiSelection()
	return (
		<Embedded>
			<AiKeysSection activeProvider={selection.provider} />
		</Embedded>
	)
}

export function AiUsageScreen() {
	return (
		<Embedded>
			<AiUsageSection />
		</Embedded>
	)
}

export function StorageScreen() {
	return (
		<Embedded>
			<StorageSection />
		</Embedded>
	)
}

export function BuildCacheScreen() {
	return (
		<Embedded focusId='build-cache-clean'>
			<BuildCacheSection />
		</Embedded>
	)
}

export function UpdatesScreen() {
	return (
		<Embedded>
			<UpdateSection />
		</Embedded>
	)
}
