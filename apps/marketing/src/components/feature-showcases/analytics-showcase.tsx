'use client'

import Link from 'next/link'
import posthog from 'posthog-js'
import { useEffect, useState } from 'react'

import { FeatureShowcaseShell } from '@/components/feature-showcases/feature-showcase-shell'
import { noop } from '@/lib/noop'

type TStats = { events: number; visitors: number }

function formatCompact(value: number): string {
	return new Intl.NumberFormat('en-US', {
		notation: 'compact',
		maximumFractionDigits: 1
	}).format(value)
}

export function AnalyticsShowcase() {
	const [stats, setStats] = useState<TStats | null>(null)

	useEffect(function fetchLiveStats() {
		let cancelled = false

		fetch('/api/posthog/stats')
			.then((response) => response.json())
			.then((data: { unavailable: boolean } & Partial<TStats>) => {
				if (cancelled || data.unavailable) return
				if (typeof data.events === 'number' && typeof data.visitors === 'number') {
					setStats({ events: data.events, visitors: data.visitors })
				}
			})
			.catch(noop)

		return () => {
			cancelled = true
		}
	}, [])

	return (
		<FeatureShowcaseShell slug='analytics' label='PostHog analytics in Dora'>
			<div className='flex aspect-video flex-col items-center justify-center gap-5 rounded-lg border border-line bg-background/40 px-6 text-center'>
				{stats ? (
					<>
						<p className='text-sm text-muted-foreground'>
							This page's own last 7 days, queried live with HogQL:
						</p>
						<div className='flex gap-6'>
							<div>
								<div className='font-mono text-2xl text-foreground'>
									{formatCompact(stats.events)}
								</div>
								<div className='font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground'>
									Events
								</div>
							</div>
							<div>
								<div className='font-mono text-2xl text-foreground'>
									{formatCompact(stats.visitors)}
								</div>
								<div className='font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground'>
									Visitors
								</div>
							</div>
						</div>
					</>
				) : (
					<p className='text-sm text-muted-foreground'>
						Connect a PostHog project to start querying events, persons, and sessions
						with HogQL.
					</p>
				)}
				<Link
					className='inline-flex min-h-8 items-center border border-line px-3 text-[12px] text-muted-foreground transition-colors hover:border-line-strong hover:text-foreground'
					href='/docs/features/analytics'
					onClick={() =>
						posthog.capture('analytics_card_cta_clicked', {
							source: 'feature-showcase'
						})
					}
				>
					See how it works
				</Link>
			</div>
		</FeatureShowcaseShell>
	)
}
