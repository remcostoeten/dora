import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useIsTauri } from '@studio/core/data-provider'
import { notifySchemaChanged } from '@studio/core/schema-refresh'
import {
	commands,
	type AgentConnectionKind,
	type AgentPermission,
	type Result
} from '@studio/lib/bindings'
import { useToast } from '@studio/shared/ui/use-toast'

const POLL_INTERVAL_MS = 3000
const AGENT_QUERY_KEY = 'agent-access'

function unwrap<Data>(result: Result<Data, { kind: string; detail: string }>): Data {
	if (result.status === 'error') throw new Error(result.error.detail)
	return result.data
}

async function loadSettings() {
	return unwrap(await commands.getAgentSettings())
}

async function loadConnections() {
	return unwrap(await commands.listAgentConnections())
}

async function loadProposals() {
	return unwrap(await commands.listAgentProposals(100))
}

async function loadActivity() {
	return unwrap(await commands.listAgentActivity(50))
}

async function loadSetupInfo() {
	return unwrap(await commands.getAgentSetupInfo())
}

export function useAgentSettings() {
	const isTauri = useIsTauri()
	return useQuery({
		queryKey: [AGENT_QUERY_KEY, 'settings'],
		queryFn: loadSettings,
		enabled: isTauri,
		refetchOnWindowFocus: true
	})
}

export function useAgentConnections() {
	const isTauri = useIsTauri()
	return useQuery({
		queryKey: [AGENT_QUERY_KEY, 'connections'],
		queryFn: loadConnections,
		enabled: isTauri
	})
}

export function useAgentProposals() {
	const isTauri = useIsTauri()
	const settings = useAgentSettings()
	const isEnabled = isTauri && settings.data?.enabled === true
	return useQuery({
		queryKey: [AGENT_QUERY_KEY, 'proposals'],
		queryFn: loadProposals,
		enabled: isEnabled,
		refetchInterval: isEnabled ? POLL_INTERVAL_MS : false,
		refetchIntervalInBackground: false,
		refetchOnWindowFocus: true
	})
}

export function useAgentActivity() {
	const isTauri = useIsTauri()
	const settings = useAgentSettings()
	const isEnabled = isTauri && settings.data?.enabled === true
	return useQuery({
		queryKey: [AGENT_QUERY_KEY, 'activity'],
		queryFn: loadActivity,
		enabled: isEnabled,
		refetchInterval: isEnabled ? POLL_INTERVAL_MS : false,
		refetchIntervalInBackground: false
	})
}

export function useAgentSetupInfo() {
	const isTauri = useIsTauri()
	return useQuery({
		queryKey: [AGENT_QUERY_KEY, 'setup'],
		queryFn: loadSetupInfo,
		enabled: isTauri,
		staleTime: Infinity
	})
}

export function useAgentMutations() {
	const queryClient = useQueryClient()
	const { toast } = useToast()

	function invalidate() {
		return queryClient.invalidateQueries({ queryKey: [AGENT_QUERY_KEY] })
	}

	const setEnabled = useMutation({
		mutationFn: async (enabled: boolean) => unwrap(await commands.setAgentEnabled(enabled)),
		onSettled: invalidate
	})

	const setGrant = useMutation({
		mutationFn: async (input: {
			connectionId: string
			kind: AgentConnectionKind
			permission: AgentPermission | null
		}) =>
			unwrap(
				await commands.setAgentGrant(input.connectionId, input.kind, input.permission)
			),
		onSettled: invalidate
	})

	const approve = useMutation({
		mutationFn: async (input: { proposalId: string; confirmation: string | null }) =>
			unwrap(await commands.approveAgentProposal(input.proposalId, input.confirmation)),
		onSuccess: (result) => {
			if (result.status === 'applied') {
				for (const statement of result.statements) {
					notifySchemaChanged(result.connection_id, statement)
				}
				toast({
					title: 'Proposal applied',
					description: `${result.affected_rows ?? 0} rows affected.`
				})
				return
			}
			toast({
				title: 'Proposal failed',
				description: result.error_message ?? 'The database refused it.',
				variant: 'destructive'
			})
		},
		onError: (error) =>
			toast({
				title: 'Could not approve',
				description: error.message,
				variant: 'destructive'
			}),
		onSettled: invalidate
	})

	const reject = useMutation({
		mutationFn: async (proposalId: string) =>
			unwrap(await commands.rejectAgentProposal(proposalId)),
		onSettled: invalidate
	})

	return { setEnabled, setGrant, approve, reject }
}
