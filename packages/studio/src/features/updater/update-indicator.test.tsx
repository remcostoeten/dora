import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@studio/shared/ui/tooltip'
import { UpdateIndicator } from './update-indicator'
import { useUpdaterStore } from './updater-store'

vi.mock('@studio/core/workspace-store', () => ({ openSettingsView: vi.fn() }))

const AVAILABLE = {
	version: '0.46.0',
	currentVersion: '0.45.0',
	notes: '- Faster connection open\n- Fixes paste focus'
}

function renderIndicator() {
	return render(
		<TooltipProvider>
			<UpdateIndicator />
		</TooltipProvider>
	)
}

afterEach(() => {
	useUpdaterStore.setState({
		status: 'idle',
		available: null,
		progress: null,
		error: null,
		errorSource: null,
		snooze: null
	})
})

describe('UpdateIndicator', () => {
	it('renders nothing when there is no update', () => {
		useUpdaterStore.setState({ status: 'up-to-date' })
		const { container } = renderIndicator()
		expect(container).toBeEmptyDOMElement()
	})

	it('opens the update card from the rail and lists the release notes', () => {
		useUpdaterStore.setState({ status: 'available', available: AVAILABLE })
		renderIndicator()
		fireEvent.click(screen.getByRole('menuitem', { name: 'Update available: Dora 0.46.0' }))
		expect(screen.getByRole('button', { name: /Install & restart/ })).toBeTruthy()
		expect(screen.getByText('Faster connection open')).toBeTruthy()
	})

	it('moves to the paused state after Later', () => {
		useUpdaterStore.setState({ status: 'available', available: AVAILABLE })
		renderIndicator()
		fireEvent.click(screen.getByRole('menuitem', { name: 'Update available: Dora 0.46.0' }))
		fireEvent.click(screen.getByRole('button', { name: 'Later' }))
		expect(
			screen.getByRole('menuitem', { name: 'Dora 0.46.0 available, reminder paused' })
		).toBeTruthy()
	})
})
