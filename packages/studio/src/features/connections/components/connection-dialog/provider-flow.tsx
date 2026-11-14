import { lazy, Suspense, type ComponentType } from 'react'
import { Spinner } from '@studio/shared/ui/spinner'
import type { IntegrationKey } from './model'
import type { NewConnection } from './connection-mapping'

type FlowProps = {
	onComplete: (connection: NewConnection) => void
}

function flow(load: () => Promise<ComponentType<FlowProps>>) {
	return lazy(async () => ({ default: await load() }))
}

const FLOWS: Record<IntegrationKey, ComponentType<FlowProps>> = {
	supabase: flow(() =>
		import('@studio/features/integrations/supabase/supabase-connect-flow').then(
			(module) => module.SupabaseConnectFlow
		)
	),
	turso: flow(() =>
		import('@studio/features/integrations/turso/turso-connect-flow').then(
			(module) => module.TursoConnectFlow
		)
	),
	neon: flow(() =>
		import('@studio/features/integrations/neon/neon-connect-flow').then(
			(module) => module.NeonConnectFlow
		)
	),
	cloudflare: flow(() =>
		import('@studio/features/integrations/cloudflare/cloudflare-connect-flow').then(
			(module) => module.CloudflareConnectFlow
		)
	),
	xata: flow(() =>
		import('@studio/features/integrations/xata/xata-connect-flow').then(
			(module) => module.XataConnectFlow
		)
	),
	planetscale: flow(() =>
		import('@studio/features/integrations/planetscale/planetscale-connect-flow').then(
			(module) => module.PlanetscaleConnectFlow
		)
	),
	vercel: flow(() =>
		import('@studio/features/integrations/vercel/vercel-connect-flow').then(
			(module) => module.VercelConnectFlow
		)
	),
	posthog: flow(() =>
		import('@studio/features/integrations/posthog/posthog-connect-flow').then(
			(module) => module.PosthogConnectFlow
		)
	)
}

type Props = {
	provider: IntegrationKey
	onComplete: (connection: NewConnection) => void
}

export function ProviderFlow({ provider, onComplete }: Props) {
	const Flow = FLOWS[provider]

	return (
		<div data-testid='provider-flow-region' data-active-provider={provider}>
			<Suspense
				fallback={
					<div className='flex items-center gap-2 py-6 text-xs text-muted-foreground'>
						<Spinner className='h-3.5 w-3.5' />
						Loading
					</div>
				}
			>
				<Flow onComplete={onComplete} />
			</Suspense>
		</div>
	)
}
