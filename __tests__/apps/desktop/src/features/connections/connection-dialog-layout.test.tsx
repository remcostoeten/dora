import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConnectionDialog } from '@/features/connections/components/connection-dialog'

vi.mock('@studio/core/data-provider', () => ({
	useIsTauri: () => true
}))

vi.mock('@studio/features/integrations/supabase/supabase-connect-flow', () => ({
	SupabaseConnectFlow: () => <div>Supabase flow</div>
}))

vi.mock('@studio/features/integrations/turso/turso-connect-flow', () => ({
	TursoConnectFlow: () => <div>Turso flow</div>
}))

vi.mock('@studio/features/integrations/neon/neon-connect-flow', () => ({
	NeonConnectFlow: () => <div>Neon flow</div>
}))

describe('ConnectionDialog provider layout', function () {
	it('compacts the database type chooser and prioritizes Neon when Neon is selected', async function () {
		render(<ConnectionDialog open onOpenChange={vi.fn()} onSave={vi.fn()} />)

		await userEvent.click(screen.getByRole('button', { name: /^Neon\b/i }))

		const typeSection = screen.getByTestId('provider-type-section')
		expect(typeSection).toHaveAttribute('data-integration-selected', 'true')
		expect(typeSection).toHaveAttribute('data-collapsible-provider-selector', 'true')

		const providerButtons = within(
			within(typeSection).getByRole('group', { name: /database type/i })
		).getAllByRole('button')
		expect(providerButtons[0]).toHaveAccessibleName(/^Neon\b/i)

		expect(screen.getByTestId('provider-flow-region')).toHaveAttribute(
			'data-active-provider',
			'neon'
		)
	})
})
