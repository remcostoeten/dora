import { useState } from 'react'
import type { AgentConnectionRow, AgentPermission } from '@studio/lib/bindings'
import { StudioDialog } from '@studio/features/database-studio/components/studio-dialog'
import {
	SettingCard,
	SettingGroup,
	SettingRow
} from '@studio/features/settings/components/setting-primitives'
import { Button } from '@studio/shared/ui/button'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@studio/shared/ui/select'
import { Switch } from '@studio/shared/ui/switch'
import { useToast } from '@studio/shared/ui/use-toast'
import {
	useAgentActivity,
	useAgentConnections,
	useAgentMutations,
	useAgentSettings,
	useAgentSetupInfo
} from './use-agent-access'

type PermissionValue = AgentPermission | 'off'

type PendingGrant = {
	row: AgentConnectionRow
	permission: AgentPermission
}

const PERMISSION_LABELS: Record<PermissionValue, string> = {
	off: 'Off',
	read: 'Read',
	propose: 'Propose',
	read_write: 'Read and write'
}

function optionsFor(row: AgentConnectionRow): PermissionValue[] {
	return row.can_write ? ['off', 'read', 'propose', 'read_write'] : ['off', 'read']
}

function needsConfirmation(row: AgentConnectionRow, permission: AgentPermission) {
	if (permission === 'read_write') return row.permission !== 'read_write'
	return row.read_enforcement === 'policy_only' && row.permission === null
}

function confirmationText(row: AgentConnectionRow, permission: AgentPermission) {
	const parts: string[] = []
	if (permission === 'read_write') {
		parts.push(
			'Agents can change data on this connection without review. Destructive statements still need your approval in Dora.'
		)
	}
	if (row.read_enforcement === 'policy_only') {
		parts.push(
			'Dora cannot enforce read-only on the server for this connection. Use a read-only token if you can.'
		)
	}
	return parts.join(' ')
}

function ConnectionPermission({
	row,
	onChange
}: {
	row: AgentConnectionRow
	onChange: (row: AgentConnectionRow, value: PermissionValue) => void
}) {
	const labelId = `agent-grant-${row.id}`
	return (
		<SettingRow
			focusId='agent-access-connections'
			label={row.name}
			labelId={labelId}
			help={row.unavailable_reason ?? row.engine}
		>
			<Select
				disabled={row.unavailable_reason !== null}
				value={row.permission ?? 'off'}
				onValueChange={(value) => {
					const option = optionsFor(row).find((candidate) => candidate === value)
					if (option) onChange(row, option)
				}}
			>
				<SelectTrigger aria-labelledby={labelId} className='h-8 w-[150px] text-xs'>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{optionsFor(row).map((option) => (
						<SelectItem key={option} value={option} className='text-xs'>
							{PERMISSION_LABELS[option]}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</SettingRow>
	)
}

function SetupSnippet({ label, value }: { label: string; value: string }) {
	const { toast } = useToast()

	async function copy() {
		await navigator.clipboard.writeText(value)
		toast({ title: `${label} copied` })
	}

	return (
		<SettingRow focusId='agent-access-setup' label={label} stacked>
			<div className='flex w-full items-start gap-2'>
				<pre className='min-w-0 flex-1 overflow-x-auto rounded-md bg-muted/40 p-2 font-mono text-[11px] text-foreground'>
					{value}
				</pre>
				<Button variant='ghost' size='sm' onClick={copy}>
					Copy
				</Button>
			</div>
		</SettingRow>
	)
}

export function AgentAccessScreen() {
	const { toast } = useToast()
	const settings = useAgentSettings()
	const connections = useAgentConnections()
	const activity = useAgentActivity()
	const setup = useAgentSetupInfo()
	const { setEnabled, setGrant } = useAgentMutations()
	const [pendingGrant, setPendingGrant] = useState<PendingGrant | null>(null)

	function applyGrant(row: AgentConnectionRow, permission: AgentPermission | null) {
		setGrant.mutate(
			{ connectionId: row.id, kind: row.kind, permission },
			{
				onError: (error) =>
					toast({
						title: 'Could not change access',
						description: error.message,
						variant: 'destructive'
					})
			}
		)
	}

	function handlePermissionChange(row: AgentConnectionRow, value: PermissionValue) {
		if (value === 'off') {
			applyGrant(row, null)
			return
		}
		if (needsConfirmation(row, value)) {
			setPendingGrant({ row, permission: value })
			return
		}
		applyGrant(row, value)
	}

	const isEnabled = settings.data?.enabled === true

	return (
		<>
			<SettingGroup label='Access'>
				<SettingCard>
					<SettingRow
						focusId='agent-access-enabled'
						label='Enable agent access'
						labelId='agent-access-enabled-label'
						help='Lets coding agents use the connections you grant below through MCP. Agents only reach connections with a permission.'
					>
						<Switch
							aria-labelledby='agent-access-enabled-label'
							checked={isEnabled}
							disabled={settings.isLoading || setEnabled.isPending}
							onCheckedChange={(checked) => setEnabled.mutate(checked)}
						/>
					</SettingRow>
					{settings.data?.privacy_mode ? (
						<SettingRow
							focusId='agent-access-privacy'
							label='Privacy mode is on'
							helpTone='error'
							help='Agents can read schema, but row data stays blocked until Privacy mode is off.'
						/>
					) : null}
				</SettingCard>
			</SettingGroup>

			<SettingGroup
				label='Connections'
				help='Read runs bounded queries. Propose adds changes you approve. Read and write also runs non-destructive writes.'
			>
				<SettingCard>
					{(connections.data ?? []).map((row) => (
						<ConnectionPermission
							key={`${row.kind}-${row.id}`}
							row={row}
							onChange={handlePermissionChange}
						/>
					))}
					{connections.data?.length === 0 ? (
						<SettingRow
							focusId='agent-access-connections'
							label='No saved connections'
							help='Add a connection first.'
						/>
					) : null}
				</SettingCard>
			</SettingGroup>

			{setup.data ? (
				<SettingGroup label='Setup'>
					<SettingCard>
						<SetupSnippet label='Claude Code' value={setup.data.claude_code} />
						<SetupSnippet label='Cursor' value={setup.data.cursor_json} />
					</SettingCard>
				</SettingGroup>
			) : null}

			{isEnabled && (activity.data?.length ?? 0) > 0 ? (
				<SettingGroup label='Recent agent activity'>
					<SettingCard>
						{activity.data?.slice(0, 10).map((entry) => (
							<SettingRow
								key={entry.id}
								focusId='agent-access-activity'
								label={entry.status}
								help={`${entry.agent_client ?? 'Agent'}: ${entry.query_text.slice(0, 120)}`}
							/>
						))}
					</SettingCard>
				</SettingGroup>
			) : null}

			<StudioDialog
				open={pendingGrant !== null}
				onOpenChange={(open) => {
					if (!open) setPendingGrant(null)
				}}
				title={
					pendingGrant
						? `Allow ${PERMISSION_LABELS[pendingGrant.permission]} on ${pendingGrant.row.name}?`
						: ''
				}
				description={
					pendingGrant
						? confirmationText(pendingGrant.row, pendingGrant.permission)
						: undefined
				}
				footer={
					<>
						<Button variant='ghost' size='sm' onClick={() => setPendingGrant(null)}>
							Cancel
						</Button>
						<Button
							size='sm'
							onClick={() => {
								if (pendingGrant) {
									applyGrant(pendingGrant.row, pendingGrant.permission)
								}
								setPendingGrant(null)
							}}
						>
							Allow
						</Button>
					</>
				}
			>
				<span className='sr-only'>Confirm this permission change.</span>
			</StudioDialog>
		</>
	)
}
