use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::{
    database::{
        schema_persistence::forget_schema, services::mutation::MutationService, RowCountRefresher,
    },
    error::Error,
    mcp::{
        catalog::{list_agent_connection_rows, profile_for_connection, AgentConnectionRow},
        encode::{redact, sql_secrets},
    },
    storage::{
        hash_agent_statements, AgentActivityEntry, AgentConnectionKind, AgentPermission,
        AgentProposal, AgentProposalRisk, AgentProposalStatus, NewAgentHistoryEntry,
    },
    AppState,
};

const DEFAULT_LIST_LIMIT: u32 = 100;
const MAX_LIST_LIMIT: u32 = 500;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct AgentSettings {
    pub enabled: bool,
    pub privacy_mode: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct AgentSetupInfo {
    pub command: String,
    pub args: Vec<String>,
    pub claude_code: String,
    pub cursor_json: String,
}

fn list_limit(limit: Option<u32>) -> i64 {
    i64::from(limit.unwrap_or(DEFAULT_LIST_LIMIT).clamp(1, MAX_LIST_LIMIT))
}

#[tauri::command]
#[specta::specta]
pub async fn get_agent_settings(state: State<'_, AppState>) -> Result<AgentSettings, Error> {
    Ok(AgentSettings {
        enabled: state.storage.agent_access_enabled()?,
        privacy_mode: state.storage.privacy_mode_enabled()?,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn set_agent_enabled(enabled: bool, state: State<'_, AppState>) -> Result<(), Error> {
    state.storage.set_agent_access_enabled(enabled)
}

#[tauri::command]
#[specta::specta]
pub async fn list_agent_connections(
    state: State<'_, AppState>,
) -> Result<Vec<AgentConnectionRow>, Error> {
    list_agent_connection_rows(&state.storage)
}

#[tauri::command]
#[specta::specta]
pub async fn set_agent_grant(
    connection_id: Uuid,
    connection_kind: AgentConnectionKind,
    permission: Option<AgentPermission>,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    if permission.is_some() {
        match connection_kind {
            AgentConnectionKind::Sql => {
                let info = state
                    .storage
                    .get_connection(&connection_id)?
                    .ok_or(Error::ConnectionNotFound(connection_id))?;
                let profile = profile_for_connection(&info);
                if let Some(reason) = profile.unavailable_reason {
                    return Err(Error::PermissionDenied(reason));
                }
                if !profile.can_write && permission != Some(AgentPermission::Read) {
                    return Err(Error::PermissionDenied(
                        "This connection only supports read access for agents".to_string(),
                    ));
                }
            }
            AgentConnectionKind::Kv => {
                state
                    .storage
                    .get_kv_connection(&connection_id)?
                    .ok_or(Error::ConnectionNotFound(connection_id))?;
                if permission != Some(AgentPermission::Read) {
                    return Err(Error::PermissionDenied(
                        "Key-value connections only support read access for agents".to_string(),
                    ));
                }
            }
        }
    }
    state
        .storage
        .set_agent_grant(&connection_id, connection_kind, permission)
}

#[tauri::command]
#[specta::specta]
pub async fn list_agent_proposals(
    limit: Option<u32>,
    state: State<'_, AppState>,
) -> Result<Vec<AgentProposal>, Error> {
    state.storage.list_agent_proposals(list_limit(limit))
}

#[tauri::command]
#[specta::specta]
pub async fn list_agent_activity(
    limit: Option<u32>,
    state: State<'_, AppState>,
) -> Result<Vec<AgentActivityEntry>, Error> {
    state.storage.list_agent_activity(list_limit(limit))
}

#[tauri::command]
#[specta::specta]
pub async fn reject_agent_proposal(
    proposal_id: String,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    let rejected = state.storage.transition_agent_proposal(
        &proposal_id,
        AgentProposalStatus::Pending,
        AgentProposalStatus::Rejected,
    )?;
    if rejected {
        Ok(())
    } else {
        Err(Error::InvalidInput(
            "This proposal is no longer pending".to_string(),
        ))
    }
}

fn check_approval(
    state: &AppState,
    proposal: &AgentProposal,
    confirmation: Option<&str>,
) -> Result<(), Error> {
    if !state.storage.agent_access_enabled()? {
        return Err(Error::PermissionDenied("Agent access is off".to_string()));
    }
    if proposal.status != AgentProposalStatus::Pending {
        return Err(Error::InvalidInput(
            "This proposal is no longer pending".to_string(),
        ));
    }
    if proposal.expires_at <= chrono::Utc::now().timestamp() {
        return Err(Error::InvalidInput("This proposal has expired".to_string()));
    }
    if hash_agent_statements(&proposal.statements)? != proposal.statements_hash {
        return Err(Error::PermissionDenied(
            "This proposal changed after it was created".to_string(),
        ));
    }
    let grant = state
        .storage
        .agent_grant(&proposal.connection_id, AgentConnectionKind::Sql)?;
    if !matches!(
        grant,
        Some(AgentPermission::Propose | AgentPermission::ReadWrite)
    ) {
        return Err(Error::PermissionDenied(
            "This connection no longer allows proposals".to_string(),
        ));
    }
    let info = state
        .storage
        .get_connection(&proposal.connection_id)?
        .ok_or(Error::ConnectionNotFound(proposal.connection_id))?;
    if proposal.risk == AgentProposalRisk::Destructive && confirmation != Some(info.name.as_str()) {
        return Err(Error::InvalidInput(
            "Type the connection name to approve a destructive proposal".to_string(),
        ));
    }
    let is_connected = state
        .connections
        .get(&proposal.connection_id)
        .is_some_and(|connection| connection.connected);
    if !is_connected {
        return Err(Error::InvalidInput(
            "Connect to this database in Dora before approving".to_string(),
        ));
    }
    Ok(())
}

fn record_proposal_history(
    state: &AppState,
    proposal: &AgentProposal,
    status: &str,
    affected_rows: i64,
    error_message: Option<&str>,
) {
    for (index, statement) in proposal.statements.iter().enumerate() {
        let saved = state.storage.save_agent_history(&NewAgentHistoryEntry {
            connection_id: proposal.connection_id,
            query_text: statement,
            duration_ms: None,
            status,
            row_count: if index == 0 { affected_rows } else { 0 },
            error_message,
            agent_client: proposal.agent_client.as_deref(),
            agent_proposal_id: Some(&proposal.id),
        });
        if let Err(error) = saved {
            log::error!("Failed to record agent proposal history: {error}");
        }
    }
}

#[tauri::command]
#[specta::specta]
pub async fn approve_agent_proposal(
    proposal_id: String,
    confirmation: Option<String>,
    state: State<'_, AppState>,
    refresher: State<'_, RowCountRefresher>,
) -> Result<AgentProposal, Error> {
    state.storage.expire_agent_proposals()?;
    let proposal = state
        .storage
        .agent_proposal(&proposal_id)?
        .ok_or_else(|| Error::InvalidInput("Proposal not found".to_string()))?;
    check_approval(state.inner(), &proposal, confirmation.as_deref())?;

    let approved = state.storage.transition_agent_proposal(
        &proposal_id,
        AgentProposalStatus::Pending,
        AgentProposalStatus::Approved,
    )?;
    let claimed = approved
        && state.storage.transition_agent_proposal(
            &proposal_id,
            AgentProposalStatus::Approved,
            AgentProposalStatus::Running,
        )?;
    if !claimed {
        return Err(Error::InvalidInput(
            "This proposal is no longer pending".to_string(),
        ));
    }

    let service = MutationService {
        connection_repo: state.inner(),
        schemas: &state.schemas,
    };
    let result = service
        .execute_batch(proposal.connection_id, proposal.statements.clone())
        .await;
    forget_schema(&state.storage, proposal.connection_id);
    refresher.cancel(proposal.connection_id);

    match result {
        Ok(result) => {
            let affected_rows = result.affected_rows as i64;
            state.storage.finish_agent_proposal(
                &proposal_id,
                AgentProposalStatus::Applied,
                Some(affected_rows),
                None,
            )?;
            record_proposal_history(state.inner(), &proposal, "success", affected_rows, None);
        }
        Err(error) => {
            let secrets = state
                .storage
                .get_connection(&proposal.connection_id)?
                .map(|info| sql_secrets(&info))
                .unwrap_or_default();
            let message = redact(&error.to_string(), &secrets);
            state.storage.finish_agent_proposal(
                &proposal_id,
                AgentProposalStatus::Failed,
                None,
                Some(&message),
            )?;
            record_proposal_history(state.inner(), &proposal, "error", 0, Some(&message));
        }
    }

    state
        .storage
        .agent_proposal(&proposal_id)?
        .ok_or_else(|| Error::InvalidInput("Proposal not found".to_string()))
}

fn shell_quote(value: &str) -> String {
    if value
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || "/._-".contains(character))
    {
        value.to_string()
    } else {
        format!("'{}'", value.replace('\'', "'\\''"))
    }
}

fn setup_command() -> (String, Vec<String>) {
    let mcp_flag = "--mcp-stdio".to_string();
    if std::env::var_os("FLATPAK_ID").is_some() {
        return (
            "flatpak".to_string(),
            vec![
                "run".to_string(),
                "io.github.remcostoeten.dora".to_string(),
                mcp_flag,
            ],
        );
    }
    if std::env::var_os("SNAP").is_some() {
        return (
            "snap".to_string(),
            vec!["run".to_string(), "dora".to_string(), mcp_flag],
        );
    }
    if let Some(appimage) = std::env::var_os("APPIMAGE") {
        return (appimage.to_string_lossy().into_owned(), vec![mcp_flag]);
    }
    let command = std::env::current_exe()
        .map(|path| path.to_string_lossy().into_owned())
        .unwrap_or_else(|_| "dora".to_string());
    (command, vec![mcp_flag])
}

#[tauri::command]
#[specta::specta]
pub async fn get_agent_setup_info() -> Result<AgentSetupInfo, Error> {
    let (command, args) = setup_command();
    let invocation = std::iter::once(command.as_str())
        .chain(args.iter().map(String::as_str))
        .map(shell_quote)
        .collect::<Vec<_>>()
        .join(" ");
    let cursor_json = serde_json::to_string_pretty(&serde_json::json!({
        "mcpServers": { "dora": { "command": command, "args": args } }
    }))
    .map_err(|error| Error::Any(anyhow::anyhow!("Failed to build setup snippet: {error}")))?;
    Ok(AgentSetupInfo {
        claude_code: format!("claude mcp add dora -- {invocation}"),
        command,
        args,
        cursor_json,
    })
}
