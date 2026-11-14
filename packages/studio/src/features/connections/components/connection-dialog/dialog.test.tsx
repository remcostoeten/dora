import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Connection } from '../../types'
import { ConnectionDialog } from '../connection-dialog'

vi.mock('@studio/core/data-provider', () => ({
	useIsTauri: () => true
}))

vi.mock('@studio/features/integrations/neon/neon-connect-flow', () => ({
	NeonConnectFlow: () => <div>Neon flow</div>
}))

const saved: Connection = {
	id: 'c1',
	name: 'shop-prod',
	type: 'postgres',
	host: 'db.acme.internal',
	user: 'app',
	database: 'shop',
	createdAt: 1
}

async function openPostgres(onSave = vi.fn()) {
	render(<ConnectionDialog open onOpenChange={vi.fn()} onSave={onSave} />)
	await userEvent.click(await screen.findByRole('option', { name: /PostgreSQL/ }))
	await screen.findByLabelText('Host')
	return onSave
}

describe('ConnectionDialog source step', () => {
	it('lists the sources in groups and filters them as you type', async () => {
		render(<ConnectionDialog open onOpenChange={vi.fn()} onSave={vi.fn()} />)

		expect(screen.getByText('Database servers')).toBeInTheDocument()
		expect(screen.getByText('Cloud accounts')).toBeInTheDocument()

		await userEvent.type(screen.getByRole('combobox'), 'neon')
		await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))
		expect(screen.getByRole('option', { name: /Neon/ })).toBeInTheDocument()
	})

	it('opens a provider connect flow for a cloud account', async () => {
		render(<ConnectionDialog open onOpenChange={vi.fn()} onSave={vi.fn()} />)

		await userEvent.type(screen.getByRole('combobox'), 'neon')
		await userEvent.keyboard('{Enter}')

		expect(await screen.findByText('Neon flow')).toBeInTheDocument()
		expect(screen.getByTestId('provider-flow-region')).toHaveAttribute(
			'data-active-provider',
			'neon'
		)
	})

	it('detects a pasted URL and carries its details into the form', async () => {
		render(<ConnectionDialog open onOpenChange={vi.fn()} onSave={vi.fn()} />)

		await userEvent.click(screen.getByRole('combobox'))
		await userEvent.paste(
			'postgres://app:secret@ep-1.us-east-2.aws.neon.tech/shop?sslmode=require'
		)

		expect(await screen.findByText('PostgreSQL on Neon')).toBeInTheDocument()
		await userEvent.keyboard('{Enter}')

		expect(await screen.findByLabelText('Host')).toHaveValue('ep-1.us-east-2.aws.neon.tech')
		expect(screen.getByLabelText('Connection name')).toHaveValue('shop (Neon)')
		expect(
			screen.queryByRole('group', { name: /save without a passing test/i })
		).not.toBeInTheDocument()
		await waitFor(() =>
			expect(screen.getByRole('button', { name: /test connection/i })).toHaveFocus()
		)
	})

	it('explains a URL it cannot read', async () => {
		render(<ConnectionDialog open onOpenChange={vi.fn()} onSave={vi.fn()} />)

		await userEvent.click(screen.getByRole('combobox'))
		await userEvent.paste('foo://bar')

		expect(await screen.findByRole('alert')).toHaveTextContent(/can.t read foo:\/\//i)
	})
})

describe('ConnectionDialog details step', () => {
	it('shows validation errors and focuses the first invalid field', async () => {
		await openPostgres()

		await userEvent.clear(screen.getByLabelText('Host'))
		await userEvent.click(screen.getByRole('button', { name: /save connection/i }))

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Fix 2 fields before saving: Host, Name.'
		)
		await waitFor(() => expect(screen.getByLabelText('Host')).toHaveFocus())
		expect(screen.getByLabelText('Host')).toHaveAttribute('aria-invalid', 'true')
	})

	it('asks before saving untested details and waits for the save to finish', async () => {
		let resolveSave: () => void = () => {}
		const onSave = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveSave = resolve
				})
		)
		await openPostgres(onSave)

		await userEvent.click(screen.getByRole('button', { name: /save connection/i }))
		const confirm = await screen.findByRole('group', { name: /save without a passing test/i })
		expect(onSave).not.toHaveBeenCalled()

		await userEvent.click(within(confirm).getByRole('button', { name: /save anyway/i }))
		expect(onSave).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'postgres', name: 'postgres (local)' })
		)
		expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()

		resolveSave()
		await waitFor(() =>
			expect(screen.getByRole('button', { name: /save connection/i })).toBeEnabled()
		)
	})

	it('offers the SSH tunnel fields for MySQL', async () => {
		render(<ConnectionDialog open onOpenChange={vi.fn()} onSave={vi.fn()} />)
		await userEvent.click(await screen.findByRole('option', { name: /^MySQL\b/ }))
		await screen.findByLabelText('Host')

		await userEvent.click(screen.getByRole('button', { name: /ssh tunnel/i }))

		expect(screen.getByLabelText('SSH host')).toBeInTheDocument()
		expect(screen.getByLabelText('Username')).toBeInTheDocument()
	})

	it('switches between fields and a connection string', async () => {
		await openPostgres()

		await userEvent.click(screen.getByRole('tab', { name: 'Connection string' }))
		const connectionString = await screen.findByLabelText('Connection string')
		if (!(connectionString instanceof HTMLTextAreaElement))
			throw new Error('expected a textarea')
		expect(connectionString.value).toContain('localhost')

		await userEvent.click(screen.getByRole('tab', { name: 'Fields' }))
		expect(await screen.findByLabelText('Host')).toHaveValue('localhost')
	})

	it('goes back to the source list with Alt+ArrowLeft', async () => {
		await openPostgres()

		await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}')

		expect(await screen.findByRole('combobox')).toBeInTheDocument()
	})
})

describe('ConnectionDialog edit mode', () => {
	it('opens on the details of the saved connection and saves a rename directly', async () => {
		const onSave = vi.fn()
		render(
			<ConnectionDialog open onOpenChange={vi.fn()} onSave={onSave} initialValues={saved} />
		)

		expect(await screen.findByText('Edit connection')).toBeInTheDocument()
		expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
		expect(await screen.findByLabelText('Host')).toHaveValue('db.acme.internal')

		await userEvent.clear(screen.getByLabelText('Connection name'))
		await userEvent.type(screen.getByLabelText('Connection name'), 'renamed')
		await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

		expect(onSave).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'renamed', host: 'db.acme.internal' })
		)
	})
})
