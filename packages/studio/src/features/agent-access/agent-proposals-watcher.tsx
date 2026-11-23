import { useEffect, useMemo, useRef, useState } from 'react'
import { notifySchemaChanged } from '@studio/core/schema-refresh'
import type { AgentConnectionRow, AgentProposal } from '@studio/lib/bindings'
import { StudioDialog } from '@studio/features/database-studio/components/studio-dialog'
import { Button } from '@studio/shared/ui/button'
import { Input } from '@studio/shared/ui/input'
import { useToast } from '@studio/shared/ui/use-toast'
import {
	useAgentActivity,
	useAgentConnections,
	useAgentMutations,
	useAgentProposals,
	useAgentSettings
} from './use-agent-access'

type Props = {
	proposal: AgentProposal
	connection: AgentConnectionRow | undefined
	position: string
	onDone: () => void
}

function ProposalReview({ proposal, connection, position, onDone }: Props) {
	const { toast } = useToast()
	const { approve, reject } = useAgentMutations()
	const [confirmation, setConfirmation] = useState('')
	const connectionName = connection?.name ?? 'Unknown connection'
	const isDestructive = proposal.risk === 'destructive'
	const isBusy = approve.isPending || reject.isPending
	const canApprove = !isBusy && (!isDestructive || confirmation === connectionName)

	function handleApprove() {
		approve.mutate(
			{
				proposalId: proposal.id,
				confirmation: isDestructive ? confirmation : null
			},
			{
				onSuccess: () => {
					setConfirmation('')
					onDone()
				}
			}
		)
	}

	function handleReject() {
		reject.mutate(proposal.id, {
			onSuccess: () => {
				setConfirmation('')
				onDone()
			},
			onError: (error) =>
				toast({
					title: 'Could not reject',
					description: error.message,
					variant: 'destructive'
				})
		})
	}

	return (
		<StudioDialog
			open
			onOpenChange={(open) => {
				if (!open) onDone()
			}}
			title={`Agent proposal ${position}`.trim()}
			description={`${proposal.agent_client ?? 'An agent'} wants to change ${connectionName}.`}
			className='sm:max-w-[680px]'
			footer={
				<>
					<Button variant='ghost' size='sm' disabled={isBusy} onClick={handleReject}>
						Reject
					</Button>
					<Button
						size='sm'
						variant={isDestructive ? 'destructive' : 'default'}
						disabled={!canApprove}
						onClick={handleApprove}
					>
						{approve.isPending ? 'Running' : 'Approve and run'}
					</Button>
				</>
			}
		>
			<div className='grid gap-3'>
				<div>
					<p className='text-[11px] font-medium text-muted-foreground'>
						Summary written by the agent
					</p>
					<p className='mt-1 whitespace-pre-wrap text-xs text-foreground'>
						{proposal.summary}
					</p>
				</div>
				<div>
					<p className='text-[11px] font-medium text-muted-foreground'>
						Exact SQL ({proposal.statements.length})
					</p>
					<pre className='mt-1 max-h-[320px] overflow-auto rounded-md bg-muted/40 p-3 font-mono text-[11.5px] text-foreground'>
						{proposal.statements.join('\n\n')}
					</pre>
				</div>
				{isDestructive ? (
					<div className='grid gap-1.5'>
						<label
							htmlFor='agent-proposal-confirmation'
							className='text-xs text-destructive-foreground'
						>
							This is destructive. Type {connectionName} to approve.
						</label>
						<Input
							id='agent-proposal-confirmation'
							value={confirmation}
							autoComplete='off'
							onChange={(event) => setConfirmation(event.target.value)}
						/>
					</div>
				) : null}
			</div>
		</StudioDialog>
	)
}

export function AgentProposalsWatcher() {
	const { toast } = useToast()
	const settings = useAgentSettings()
	const proposals = useAgentProposals()
	const activity = useAgentActivity()
	const connections = useAgentConnections()
	const [activeProposal, setActiveProposal] = useState<AgentProposal | null>(null)
	const lastActivityId = useRef<number | null>(null)

	const pending = useMemo(
		() => (proposals.data ?? []).filter((proposal) => proposal.status === 'pending'),
		[proposals.data]
	)

	useEffect(() => {
		const entries = activity.data
		if (!entries) return
		const newestId = entries[0]?.id ?? 0
		if (lastActivityId.current === null) {
			lastActivityId.current = newestId
			return
		}
		const previousId = lastActivityId.current
		const written = entries.filter(
			(entry) =>
				entry.id > previousId &&
				entry.status === 'success' &&
				entry.agent_proposal_id === null &&
				!/^\s*(select|with|show|explain)\b/i.test(entry.query_text)
		)
		lastActivityId.current = Math.max(previousId, newestId)
		if (written.length === 0) return
		for (const entry of written) {
			notifySchemaChanged(entry.connection_id, entry.query_text)
		}
		toast({
			title: 'An agent changed data',
			description: 'Reload open tables to see the latest rows.'
		})
	}, [activity.data, toast])

	if (settings.data?.enabled !== true) return null
	if (pending.length === 0 && activeProposal === null) return null

	const connection = connections.data?.find(
		(row) => row.kind === 'sql' && row.id === activeProposal?.connection_id
	)

	return (
		<>
			{activeProposal === null ? (
				<Button
					size='sm'
					className='fixed bottom-4 right-4 z-40'
					onClick={() => setActiveProposal(pending[0])}
				>
					{pending.length === 1
						? 'Review agent proposal'
						: `Review ${pending.length} agent proposals`}
				</Button>
			) : (
				<ProposalReview
					key={activeProposal.id}
					proposal={activeProposal}
					connection={connection}
					position={pending.length > 1 ? `1 of ${pending.length}` : ''}
					onDone={() => setActiveProposal(null)}
				/>
			)}
		</>
	)
}
