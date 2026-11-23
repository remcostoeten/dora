use std::{
    sync::Arc,
    time::{Duration, Instant},
};

use serde_json::{json, Value};
use uuid::Uuid;

use super::proposals::{store_proposal, validate_batch, WriteBatchArgs};
use crate::{
    database::{
        connection_repository::ConnectionRepository, services::mutation::MutationService,
        types::DatabaseClient,
    },
    mcp::{
        encode::{redact, sql_secrets},
        errors::{McpErrorCode, McpFailure},
        grants::{require_sql_access, Access},
        policy::check_write,
        session::ensure_builtin_functions,
        state::McpState,
    },
    storage::{AgentProposalRisk, NewAgentHistoryEntry},
};

const WRITE_TIMEOUT: Duration = Duration::from_secs(60);

#[allow(clippy::too_many_arguments)]
fn audit_batch(
    state: &McpState,
    connection_id: Uuid,
    statements: &[String],
    started: Instant,
    status: &str,
    affected_rows: i64,
    error_message: Option<&str>,
    client: Option<&str>,
) -> crate::Result<()> {
    for (index, statement) in statements.iter().enumerate() {
        state.storage.save_agent_history(&NewAgentHistoryEntry {
            connection_id,
            query_text: statement,
            duration_ms: Some(started.elapsed().as_millis() as i64),
            status,
            row_count: if index == 0 { affected_rows } else { 0 },
            error_message,
            agent_client: client,
            agent_proposal_id: None,
        })?;
    }
    Ok(())
}

pub async fn execute_write(
    state: &Arc<McpState>,
    args: WriteBatchArgs,
    client: Option<&str>,
) -> Result<Value, McpFailure> {
    let started = Instant::now();
    let (info, profile) = require_sql_access(state, args.connection, Access::Write)?;
    let family = validate_batch(&args, &profile)?;

    let checked = match check_write(family, &args.statements) {
        Ok(checked) => checked,
        Err(failure) => {
            let message = failure.message.clone();
            audit_batch(
                state,
                args.connection,
                &args.statements,
                started,
                "refused",
                0,
                Some(&message),
                client,
            )
            .map_err(|_| audit_failure(false))?;
            return Err(failure);
        }
    };
    if checked.risk == AgentProposalRisk::Destructive {
        let proposal = store_proposal(state, &args, checked.risk, client)?;
        return Ok(json!({
            "status": "approval_required",
            "proposal_id": proposal.id,
            "risk": proposal.risk,
            "expires_at": proposal.expires_at,
            "message": "This batch is destructive and was not run. A person must approve it in Dora.",
        }));
    }

    let lock = state.connection_lock(args.connection);
    let _guard = lock.lock().await;
    require_sql_access(state, args.connection, Access::Write)?;
    state.ensure_write(args.connection, &info).await?;
    let write_client = state
        .write_repository()
        .get_client(args.connection)
        .map_err(McpFailure::from)?;
    ensure_builtin_functions(&write_client, &checked.functions).await?;

    audit_batch(
        state,
        args.connection,
        &args.statements,
        started,
        "started",
        0,
        None,
        client,
    )
    .map_err(|_| audit_failure(false))?;

    let sqlite_deadline = spawn_sqlite_deadline(&write_client);
    let repository = state.write_repository();
    let service = MutationService {
        connection_repo: &repository,
        schemas: &state.schemas,
    };
    let outcome = tokio::time::timeout(
        WRITE_TIMEOUT,
        service.execute_batch(args.connection, args.statements.clone()),
    )
    .await;
    if let Some(deadline) = sqlite_deadline {
        deadline.abort();
    }
    state.mark_write_used(args.connection);

    let result = match outcome {
        Ok(Ok(result)) => result,
        Ok(Err(error)) => {
            let message = redact(&error.to_string(), &sql_secrets(&info));
            audit_batch(
                state,
                args.connection,
                &args.statements,
                started,
                "error",
                0,
                Some(&message),
                client,
            )
            .map_err(|_| audit_failure(false))?;
            return Err(McpFailure::new(McpErrorCode::QueryFailed, message).with_committed(false));
        }
        Err(_) => {
            state.close_write(args.connection).await;
            let message = "The write did not finish within 60 seconds. Its connection was closed. Check the database before retrying.";
            audit_batch(
                state,
                args.connection,
                &args.statements,
                started,
                "timeout",
                0,
                Some(message),
                client,
            )
            .map_err(|_| McpFailure::new(McpErrorCode::AuditFailed, message))?;
            return Err(McpFailure::new(McpErrorCode::QueryTimeout, message));
        }
    };

    state.schemas.remove(&args.connection);
    audit_batch(
        state,
        args.connection,
        &args.statements,
        started,
        "success",
        result.affected_rows as i64,
        None,
        client,
    )
    .map_err(|_| audit_failure(true))?;

    Ok(json!({
        "status": "applied",
        "affected_rows": result.affected_rows,
        "duration_ms": started.elapsed().as_millis() as u64,
    }))
}

fn spawn_sqlite_deadline(client: &DatabaseClient) -> Option<tauri::async_runtime::JoinHandle<()>> {
    let DatabaseClient::SQLite { connection } = client else {
        return None;
    };
    let handle = connection.lock().ok()?.get_interrupt_handle();
    Some(tauri::async_runtime::spawn(async move {
        tokio::time::sleep(WRITE_TIMEOUT).await;
        handle.interrupt();
    }))
}

fn audit_failure(committed: bool) -> McpFailure {
    McpFailure::new(
        McpErrorCode::AuditFailed,
        if committed {
            "The write was committed, but Dora could not record it."
        } else {
            "Dora could not record this write, so it was not run."
        },
    )
    .with_committed(committed)
}
