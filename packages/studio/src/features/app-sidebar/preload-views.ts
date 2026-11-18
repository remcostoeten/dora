import type { QueryClient } from '@tanstack/react-query'
import { prefetchDockerView } from '@studio/features/docker-manager/api/queries/use-containers'

const VIEW_CHUNKS: Record<string, () => Promise<unknown>> = {
	'database-studio': () => import('@studio/features/database-studio/database-studio'),
	'sql-console': () => import('@studio/features/sql-console/sql-console'),
	'schema-visualizer': () => import('@studio/features/schema-visualizer'),
	'orm-cockpit': () => import('@studio/features/orm-cockpit/components/orm-cockpit-panel'),
	'kv-studio': () => import('@studio/features/kv-studio/kv-workspace'),
	performance: () => import('@studio/features/performance'),
	analytics: () => import('@studio/features/posthog-analytics')
}

/**
 * @name preloadView
 * @description Starts loading a workspace view's lazy chunk (and Docker's data) ahead of the click, so navigation paints without a loading shell.
 * @example
 * onPointerEnter={() => preloadView('sql-console', queryClient)}
 */
export function preloadView(navId: string, queryClient: QueryClient) {
	if (navId === 'docker') {
		prefetchDockerView(queryClient)
		return
	}
	void VIEW_CHUNKS[navId]?.().catch(function ignorePreloadFailure() {})
}
