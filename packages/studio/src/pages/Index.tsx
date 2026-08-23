import { TabsProvider } from '@studio/core/tabs'
import { WorkspaceShell } from './workspace/workspace-shell'

/**
 * The workspace is assembled from slice consumers that each subscribe to the
 * part of the store they render (see `pages/workspace/`). This file only
 * supplies the tab session provider around them.
 */
export default function Index() {
	return (
		<TabsProvider>
			<WorkspaceShell />
		</TabsProvider>
	)
}
