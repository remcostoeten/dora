import { BrowserRouter } from 'react-router-dom'
import { StudioApp, desktopAnalyticsConfig } from '@dora/studio'

function App() {
	return (
		<BrowserRouter>
			<StudioApp analyticsConfig={desktopAnalyticsConfig} />
		</BrowserRouter>
	)
}

export default App
