use uuid::Uuid;

use super::{
    catalog::{profile_for_connection, AgentProfile},
    errors::{McpErrorCode, McpFailure},
    state::McpState,
};
use crate::{
    config::AppConfig,
    database::types::ConnectionInfo,
    storage::{AgentConnectionKind, AgentPermission, KvConnectionInfo},
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Access {
    Read,
    Propose,
    Write,
}

fn permits(permission: AgentPermission, access: Access) -> bool {
    match access {
        Access::Read => true,
        Access::Propose => matches!(
            permission,
            AgentPermission::Propose | AgentPermission::ReadWrite
        ),
        Access::Write => permission == AgentPermission::ReadWrite,
    }
}

fn not_available() -> McpFailure {
    McpFailure::new(
        McpErrorCode::ConnectionNotAvailable,
        "This connection is not available to agents.",
    )
}

/// @name require_server_access
/// @description Rechecks the master switch and the active storage path, so a
/// change in the Dora window applies on the next tool call.
///
/// @example
/// require_server_access(&state)?;
pub fn require_server_access(state: &McpState) -> Result<(), McpFailure> {
    let active_path = AppConfig::load()
        .and_then(|config| config.resolve_active_path())
        .map(|path| path.to_string_lossy().into_owned())?;
    if active_path != state.storage.active_path_string()? {
        return Err(McpFailure::new(
            McpErrorCode::StorageChanged,
            "Dora switched to another storage file. Restart the MCP server.",
        ));
    }
    if !state.storage.agent_access_enabled()? {
        return Err(McpFailure::new(
            McpErrorCode::AgentAccessDisabled,
            "Agent access is off. Turn it on in Dora under Settings, Agent access.",
        ));
    }
    Ok(())
}

pub fn require_no_privacy_mode(state: &McpState) -> Result<(), McpFailure> {
    if state.storage.privacy_mode_enabled()? {
        return Err(McpFailure::new(
            McpErrorCode::PrivacyModeEnabled,
            "Privacy mode is on in Dora, so agents cannot read row data.",
        ));
    }
    Ok(())
}

/// @name require_sql_access
/// @description Checks the server switch, grant and connection profile for one
/// SQL connection. Hidden and refused connections return the same error.
///
/// @example
/// let (info, profile) = require_sql_access(&state, id, Access::Read)?;
pub fn require_sql_access(
    state: &McpState,
    connection_id: Uuid,
    access: Access,
) -> Result<(ConnectionInfo, AgentProfile), McpFailure> {
    require_server_access(state)?;
    let info = state
        .storage
        .get_connection(&connection_id)?
        .ok_or_else(not_available)?;
    let profile = profile_for_connection(&info);
    if profile.unavailable_reason.is_some() {
        return Err(not_available());
    }
    let permission = state
        .storage
        .agent_grant(&connection_id, AgentConnectionKind::Sql)?
        .ok_or_else(not_available)?;
    if !permits(permission, access) {
        return Err(McpFailure::new(
            McpErrorCode::PermissionDenied,
            format!(
                "This connection is granted '{}' in Dora, which does not allow this tool.",
                permission.as_str()
            ),
        ));
    }
    Ok((info, profile))
}

pub fn require_kv_access(
    state: &McpState,
    connection_id: Uuid,
) -> Result<KvConnectionInfo, McpFailure> {
    require_server_access(state)?;
    let info = state
        .storage
        .get_kv_connection(&connection_id)?
        .ok_or_else(not_available)?;
    state
        .storage
        .agent_grant(&connection_id, AgentConnectionKind::Kv)?
        .ok_or_else(not_available)?;
    require_no_privacy_mode(state)?;
    Ok(info)
}
