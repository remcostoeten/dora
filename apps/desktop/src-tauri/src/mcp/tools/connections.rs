use std::sync::Arc;

use serde_json::{json, Value};

use crate::mcp::{
    catalog::list_agent_connection_rows, errors::McpFailure, grants::require_server_access,
    state::McpState,
};

pub fn list_connections(state: &Arc<McpState>) -> Result<Value, McpFailure> {
    require_server_access(state)?;
    let connections: Vec<Value> = list_agent_connection_rows(&state.storage)?
        .into_iter()
        .filter(|row| row.unavailable_reason.is_none())
        .filter_map(|row| {
            let permission = row.permission?;
            Some(json!({
                "id": row.id,
                "name": row.name,
                "kind": row.kind,
                "engine": row.engine,
                "permission": permission,
                "read_enforcement": row.read_enforcement,
            }))
        })
        .collect();
    Ok(json!({ "connections": connections }))
}
