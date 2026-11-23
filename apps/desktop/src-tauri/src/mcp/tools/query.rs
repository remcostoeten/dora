use std::{
    sync::Arc,
    time::{Duration, Instant},
};

use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    database::{
        connection_repository::ConnectionRepository, services::query::QueryService,
        types::QueryStatus,
    },
    mcp::{
        catalog::SqlFamily,
        encode::{encode_rows, redact, sql_secrets},
        errors::{McpErrorCode, McpFailure},
        grants::{require_no_privacy_mode, require_sql_access, Access},
        policy::check_read_statement,
        session::ensure_builtin_functions,
        state::McpState,
    },
    storage::NewAgentHistoryEntry,
};

const MAX_SQL_BYTES: usize = 100 * 1024;
const DEFAULT_MAX_ROWS: usize = 200;
const MAX_ROWS: usize = 1000;
const DEFAULT_TIMEOUT_MS: u64 = 15_000;
const MIN_TIMEOUT_MS: u64 = 100;
const MAX_TIMEOUT_MS: u64 = 60_000;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RunQueryArgs {
    connection: Uuid,
    sql: String,
    max_rows: Option<usize>,
    timeout_ms: Option<u64>,
}

#[allow(clippy::too_many_arguments)]
fn audit(
    state: &McpState,
    connection_id: Uuid,
    sql: &str,
    started: Instant,
    status: &str,
    row_count: i64,
    error_message: Option<&str>,
    client: Option<&str>,
) -> Result<(), McpFailure> {
    state
        .storage
        .save_agent_history(&NewAgentHistoryEntry {
            connection_id,
            query_text: sql,
            duration_ms: Some(started.elapsed().as_millis() as i64),
            status,
            row_count,
            error_message,
            agent_client: client,
            agent_proposal_id: None,
        })
        .map_err(|error| {
            log::error!("Agent audit write failed: {error}");
            McpFailure::new(
                McpErrorCode::AuditFailed,
                "Dora could not record this query, so its result was withheld.",
            )
        })
}

fn parse_page(page: &serde_json::value::RawValue) -> Result<Vec<Vec<Value>>, McpFailure> {
    serde_json::from_str(page.get()).map_err(|error| {
        log::warn!("Failed to decode result page: {error}");
        McpFailure::internal()
    })
}

async fn approve_read(
    state: &McpState,
    connection_id: Uuid,
    family: SqlFamily,
    sql: &str,
    max_rows: usize,
) -> Result<String, McpFailure> {
    let approved = check_read_statement(family, sql, max_rows)?;
    let client = state
        .read_repository()
        .get_client(connection_id)
        .map_err(McpFailure::from)?;
    ensure_builtin_functions(&client, &approved.functions).await?;
    Ok(approved.sql)
}

pub async fn run_query(
    state: &Arc<McpState>,
    args: RunQueryArgs,
    client: Option<&str>,
) -> Result<Value, McpFailure> {
    let started = Instant::now();
    if args.sql.len() > MAX_SQL_BYTES {
        return Err(McpFailure::new(
            McpErrorCode::InvalidInput,
            "SQL is larger than 100 KiB.",
        ));
    }
    let (info, profile) = require_sql_access(state, args.connection, Access::Read)?;
    require_no_privacy_mode(state)?;
    let family = profile.family.ok_or_else(McpFailure::internal)?;
    let max_rows = args.max_rows.unwrap_or(DEFAULT_MAX_ROWS).clamp(1, MAX_ROWS);
    let timeout_ms = args
        .timeout_ms
        .unwrap_or(DEFAULT_TIMEOUT_MS)
        .clamp(MIN_TIMEOUT_MS, MAX_TIMEOUT_MS);

    let lock = state.connection_lock(args.connection);
    let _guard = lock.lock().await;
    let enforcement = match state.ensure_read(args.connection, &info, &profile).await {
        Ok(enforcement) => enforcement,
        Err(failure) => {
            let message = failure.message.clone();
            audit(
                state,
                args.connection,
                &args.sql,
                started,
                "error",
                0,
                Some(&message),
                client,
            )?;
            return Err(failure);
        }
    };

    let executable = if family == SqlFamily::HogQl {
        args.sql.clone()
    } else {
        match approve_read(state, args.connection, family, &args.sql, max_rows).await {
            Ok(sql) => sql,
            Err(failure) => {
                let message = failure.message.clone();
                audit(
                    state,
                    args.connection,
                    &args.sql,
                    started,
                    "refused",
                    0,
                    Some(&message),
                    client,
                )?;
                return Err(failure);
            }
        }
    };

    let repository = state.read_repository();
    let service = QueryService {
        connection_repo: &repository,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    let secrets = sql_secrets(&info);
    let result = match service
        .run_query(
            args.connection,
            &executable,
            Duration::from_millis(timeout_ms),
        )
        .await
    {
        Ok(result) => result,
        Err(error) => {
            let message = redact(&error.to_string(), &secrets);
            audit(
                state,
                args.connection,
                &args.sql,
                started,
                "error",
                0,
                Some(&message),
                client,
            )?;
            return Err(McpFailure::new(McpErrorCode::QueryFailed, message));
        }
    };

    if matches!(result.status, QueryStatus::Pending | QueryStatus::Running) {
        state.stmt_manager.cancel_queries(&[result.query_id]);
        let message = format!("The query did not finish within {timeout_ms} ms and was cancelled.");
        audit(
            state,
            args.connection,
            &args.sql,
            started,
            "timeout",
            0,
            Some(&message),
            client,
        )?;
        return Err(McpFailure::new(McpErrorCode::QueryTimeout, message));
    }
    if result.status == QueryStatus::Error {
        let message = redact(
            result.error.as_deref().unwrap_or("The query failed."),
            &secrets,
        );
        audit(
            state,
            args.connection,
            &args.sql,
            started,
            "error",
            0,
            Some(&message),
            client,
        )?;
        return Err(McpFailure::new(McpErrorCode::QueryFailed, message));
    }

    let columns: Vec<String> = match &result.columns {
        Some(columns) => serde_json::from_str(columns.get()).map_err(|error| {
            log::warn!("Failed to decode result columns: {error}");
            McpFailure::internal()
        })?,
        None => Vec::new(),
    };

    let mut rows = match &result.first_page {
        Some(page) => parse_page(page)?,
        None => Vec::new(),
    };
    for page_index in 1..result.page_count {
        if rows.len() > max_rows {
            break;
        }
        if let Some(page) = state
            .stmt_manager
            .fetch_page(result.query_id, page_index)
            .map_err(McpFailure::from)?
        {
            rows.extend(parse_page(&page)?);
        }
    }

    let encoded = encode_rows(columns, rows, max_rows);
    let row_count = encoded.rows.len();
    audit(
        state,
        args.connection,
        &args.sql,
        started,
        "success",
        row_count as i64,
        None,
        client,
    )?;

    Ok(json!({
        "columns": encoded.columns,
        "rows": encoded.rows,
        "row_count": row_count,
        "truncated": !encoded.reasons.is_empty(),
        "truncation_reasons": encoded.reasons,
        "duration_ms": started.elapsed().as_millis() as u64,
        "read_enforcement": enforcement,
        "data_trust": "untrusted_database_content",
    }))
}
