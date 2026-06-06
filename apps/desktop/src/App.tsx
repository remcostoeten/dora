import { StudioApp } from '@dora/studio'
import { desktopAnalyticsConfig } from '@studio/features/analytics/desktop-config'

function App() {
	return <StudioApp analyticsConfig={desktopAnalyticsConfig} />
}

export default App
