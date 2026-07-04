'use client'

import { FeatureShowcaseShell } from '@/components/feature-showcases/feature-showcase-shell'

export function AnalyticsShowcase() {
	return (
		<FeatureShowcaseShell slug="analytics" label="PostHog analytics in Dora">
			<div className="flex aspect-video items-center justify-center rounded-lg border border-line bg-background/40">
				<div className="flex flex-col items-center gap-3 px-6 text-center">
					<p className="text-sm text-muted-foreground">
						Connect a PostHog project to start querying events, persons,
						and sessions with HogQL.
					</p>
				</div>
			</div>
		</FeatureShowcaseShell>
	)
}
