import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConnectionForm } from '@/features/connections/components/connection-dialog/connection-form'

describe('ConnectionForm mysql ssh ui', function () {
	it('renders the SSH tunnel controls for MySQL connections', function () {
		render(
			<ConnectionForm
				formData={{
					type: 'mysql',
					sshConfig: {
						enabled: true,
						host: 'bastion.example.com',
						port: 22,
						username: 'deploy',
						authMethod: 'password',
						password: 'hunter2'
					}
				}}
				updateField={vi.fn()}
				setFormData={vi.fn()}
				useConnectionString={false}
				setUseConnectionString={vi.fn()}
			/>
		)

		expect(screen.getByText('Connect via SSH Tunnel')).toBeInTheDocument()
		expect(screen.getByLabelText('SSH Host')).toBeInTheDocument()
		expect(screen.getByLabelText('SSH Username')).toBeInTheDocument()
	})
})
