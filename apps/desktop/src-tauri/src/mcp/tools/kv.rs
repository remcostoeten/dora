use std::{sync::Arc, time::Instant};

use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    kv::{KvBytes, KvReadRequest, KvScanRequest},
    mcp::{
        encode::{kv_secrets, limit_kv_value, redact},
        errors::{McpErrorCode, McpFailure},
        grants::require_kv_access,
        state::McpState,
    },
    storage::KvConnectionInfo,
};

const DEFAULT_ITEMS: u32 = 100;
const MAX_ITEMS: u32 = 500;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct KvScanArgs {
    connection: Uuid,
    pattern: Option<String>,
    cursor: Option<u64>,
    limit: Option<u32>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct KvReadArgs {
    connection: Uuid,
    key: KvKeyArg,
    max_items: Option<u32>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum KvKeyArg {
    Text(String),
    Encoded(KvBytes),
}

impl From<KvKeyArg> for KvBytes {
    fn from(key: KvKeyArg) -> Self {
        match key {
            KvKeyArg::Text(text) => KvBytes::Utf8(text),
            KvKeyArg::Encoded(bytes) => bytes,
        }
    }
}

fn audit(
    state: &McpState,
    connection_id: Uuid,
    command: &str,
    started: Instant,
    error_message: Option<&str>,
    client: Option<&str>,
) -> Result<(), McpFailure> {
    state
        .storage
        .save_agent_kv_history(
            &connection_id,
            command,
            Some(started.elapsed().as_millis() as i64),
            if error_message.is_some() {
                "error"
            } else {
                "success"
            },
            error_message,
            client,
        )
        .map_err(|error| {
            log::error!("Agent key-value audit write failed: {error}");
            McpFailure::new(
                McpErrorCode::AuditFailed,
                "Dora could not record this read, so its result was withheld.",
            )
        })
}

fn driver_failure(
    state: &McpState,
    connection_id: Uuid,
    command: &str,
    started: Instant,
    message: &str,
    info: &KvConnectionInfo,
    client: Option<&str>,
) -> McpFailure {
    let message = redact(message, &kv_secrets(info));
    if let Err(failure) = audit(
        state,
        connection_id,
        command,
        started,
        Some(&message),
        client,
    ) {
        return failure;
    }
    McpFailure::new(McpErrorCode::QueryFailed, message)
}

pub async fn kv_scan(
    state: &Arc<McpState>,
    args: KvScanArgs,
    client: Option<&str>,
) -> Result<Value, McpFailure> {
    let started = Instant::now();
    let info = require_kv_access(state, args.connection)?;
    let lock = state.connection_lock(args.connection);
    let _guard = lock.lock().await;
    let mut connection = state.kv_client(args.connection, &info).await?;
    let limit = args.limit.unwrap_or(DEFAULT_ITEMS).clamp(1, MAX_ITEMS);
    let command = format!(
        "agent kv_scan pattern={}",
        args.pattern.as_deref().unwrap_or("*")
    );
    let page = connection
        .scan(KvScanRequest {
            cursor: args.cursor,
            pattern: args.pattern,
            limit: Some(limit),
        })
        .await
        .map_err(|error| {
            driver_failure(
                state,
                args.connection,
                &command,
                started,
                &error.to_string(),
                &info,
                client,
            )
        })?;
    audit(state, args.connection, &command, started, None, client)?;

    let next_cursor = (page.cursor != 0).then_some(page.cursor);
    let keys = serde_json::to_value(page.keys).map_err(|_| McpFailure::internal())?;
    let (keys, reasons) = limit_kv_value(keys);
    Ok(json!({
        "keys": keys,
        "next_cursor": next_cursor,
        "truncation_reasons": reasons,
        "data_trust": "untrusted_database_content",
    }))
}

pub async fn kv_read(
    state: &Arc<McpState>,
    args: KvReadArgs,
    client: Option<&str>,
) -> Result<Value, McpFailure> {
    let started = Instant::now();
    let info = require_kv_access(state, args.connection)?;
    let lock = state.connection_lock(args.connection);
    let _guard = lock.lock().await;
    let mut connection = state.kv_client(args.connection, &info).await?;
    let limit = args.max_items.unwrap_or(DEFAULT_ITEMS).clamp(1, MAX_ITEMS);
    let key = KvBytes::from(args.key);
    let command = format!("agent kv_read key={key:?}");
    let result = connection
        .read(KvReadRequest {
            key,
            cursor: None,
            offset: None,
            limit: Some(limit),
        })
        .await
        .map_err(|error| {
            driver_failure(
                state,
                args.connection,
                &command,
                started,
                &error.to_string(),
                &info,
                client,
            )
        })?;
    audit(state, args.connection, &command, started, None, client)?;

    let value = serde_json::to_value(result).map_err(|_| McpFailure::internal())?;
    let (value, reasons) = limit_kv_value(value);
    Ok(json!({
        "result": value,
        "truncation_reasons": reasons,
        "data_trust": "untrusted_database_content",
    }))
}
