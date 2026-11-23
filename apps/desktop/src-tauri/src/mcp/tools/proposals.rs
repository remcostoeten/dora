use std::sync::Arc;

use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    mcp::{
        catalog::{AgentProfile, SqlFamily},
        errors::{McpErrorCode, McpFailure},
        grants::{require_server_access, require_sql_access, Access},
        policy::check_proposal,
        state::McpState,
    },
    storage::{AgentProposal, AgentProposalRisk, NewAgentProposal},
};

pub const MAX_STATEMENTS: usize = 50;
pub const MAX_BATCH_BYTES: usize = 256 * 1024;
const MAX_SUMMARY_CHARS: usize = 500;
const PROPOSAL_LIFETIME_SECONDS: i64 = 24 * 60 * 60;
const MAX_PENDING_PROPOSALS: i64 = 20;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WriteBatchArgs {
    pub connection: Uuid,
    pub statements: Vec<String>,
    pub summary: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GetProposalArgs {
    proposal_id: String,
}

/// @name validate_batch
/// @description Enforces the shared size, count and atomicity limits for agent
/// write batches.
///
/// @example
/// let family = validate_batch(&args, &profile)?;
pub fn validate_batch(
    args: &WriteBatchArgs,
    profile: &AgentProfile,
) -> Result<SqlFamily, McpFailure> {
    let family = profile
        .family
        .filter(|family| *family != SqlFamily::HogQl && profile.can_write)
        .ok_or_else(|| {
            McpFailure::new(
                McpErrorCode::WriteNotSupported,
                "This connection does not support agent writes.",
            )
        })?;
    if args.statements.is_empty() || args.statements.len() > MAX_STATEMENTS {
        return Err(McpFailure::new(
            McpErrorCode::InvalidInput,
            "Send between 1 and 50 statements.",
        ));
    }
    let total_bytes: usize = args.statements.iter().map(String::len).sum();
    if total_bytes > MAX_BATCH_BYTES {
        return Err(McpFailure::new(
            McpErrorCode::InvalidInput,
            "The statements are larger than 256 KiB.",
        ));
    }
    let summary_chars = args.summary.trim().chars().count();
    if summary_chars == 0 || summary_chars > MAX_SUMMARY_CHARS {
        return Err(McpFailure::new(
            McpErrorCode::InvalidInput,
            "The summary must be 1 to 500 characters.",
        ));
    }
    if !profile.atomic_batches && args.statements.len() > 1 {
        return Err(McpFailure::new(
            McpErrorCode::AtomicBatchUnsupported,
            "This engine cannot run a batch atomically. Send one statement.",
        ));
    }
    Ok(family)
}

/// @name store_proposal
/// @description Saves a validated batch as a pending proposal for human review.
///
/// @example
/// let proposal = store_proposal(&state, &args, risk, client)?;
pub fn store_proposal(
    state: &McpState,
    args: &WriteBatchArgs,
    risk: AgentProposalRisk,
    client: Option<&str>,
) -> Result<AgentProposal, McpFailure> {
    state
        .storage
        .create_agent_proposal(NewAgentProposal {
            connection_id: args.connection,
            statements: &args.statements,
            summary: args.summary.trim(),
            risk,
            agent_client: client,
            lifetime_seconds: PROPOSAL_LIFETIME_SECONDS,
            max_pending: MAX_PENDING_PROPOSALS,
        })?
        .ok_or_else(|| {
            McpFailure::new(
                McpErrorCode::TooManyPendingProposals,
                "This connection has 20 pending proposals. Ask the user to review them in Dora.",
            )
        })
}

pub fn propose_change(
    state: &Arc<McpState>,
    args: WriteBatchArgs,
    client: Option<&str>,
) -> Result<Value, McpFailure> {
    let (_, profile) = require_sql_access(state, args.connection, Access::Propose)?;
    let family = validate_batch(&args, &profile)?;
    let risk = check_proposal(family, &args.statements)?;
    let proposal = store_proposal(state, &args, risk, client)?;
    Ok(json!({
        "proposal_id": proposal.id,
        "status": "pending",
        "risk": proposal.risk,
        "expires_at": proposal.expires_at,
        "message": "A person must approve this proposal in Dora before it runs.",
    }))
}

pub fn get_proposal(state: &Arc<McpState>, args: GetProposalArgs) -> Result<Value, McpFailure> {
    require_server_access(state)?;
    let not_found = || McpFailure::new(McpErrorCode::ProposalNotFound, "Proposal not found.");
    state.storage.expire_agent_proposals()?;
    let proposal = state
        .storage
        .agent_proposal(&args.proposal_id)?
        .ok_or_else(not_found)?;
    require_sql_access(state, proposal.connection_id, Access::Read).map_err(|_| not_found())?;
    Ok(json!({
        "proposal_id": proposal.id,
        "status": proposal.status,
        "risk": proposal.risk,
        "created_at": proposal.created_at,
        "expires_at": proposal.expires_at,
        "decided_at": proposal.decided_at,
        "finished_at": proposal.finished_at,
        "affected_rows": proposal.affected_rows,
        "error_message": proposal.error_message,
    }))
}
