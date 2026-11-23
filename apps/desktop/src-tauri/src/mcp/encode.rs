use serde_json::{json, Map, Value};

use crate::{
    credentials,
    database::types::{ConnectionInfo, DatabaseInfo, SshConfig},
    storage::KvConnectionInfo,
};

pub const MAX_RESULT_BYTES: usize = 256 * 1024;
pub const MAX_CELL_BYTES: usize = 8 * 1024;
pub const MAX_COLUMNS: usize = 200;

#[derive(Debug, Default)]
pub struct EncodedRows {
    pub columns: Vec<Value>,
    pub rows: Vec<Value>,
    pub reasons: Vec<&'static str>,
}

fn add_reason(reasons: &mut Vec<&'static str>, reason: &'static str) {
    if !reasons.contains(&reason) {
        reasons.push(reason);
    }
}

fn floor_char_boundary(text: &str, limit: usize) -> usize {
    let mut index = limit.min(text.len());
    while !text.is_char_boundary(index) {
        index -= 1;
    }
    index
}

fn limit_cell(value: Value, reasons: &mut Vec<&'static str>) -> Value {
    match value {
        Value::String(text) if text.len() > MAX_CELL_BYTES => {
            add_reason(reasons, "cell_limit");
            let end = floor_char_boundary(&text, MAX_CELL_BYTES);
            json!({ "truncated": true, "value": &text[..end], "original_bytes": text.len() })
        }
        Value::Array(items) => {
            let encoded_len = serde_json::to_string(&items).map_or(usize::MAX, |text| text.len());
            if encoded_len > MAX_CELL_BYTES {
                add_reason(reasons, "cell_limit");
                json!({ "truncated": true, "original_bytes": encoded_len })
            } else {
                Value::Array(items)
            }
        }
        Value::Object(fields) => limit_object(fields, reasons),
        other => other,
    }
}

fn limit_object(fields: Map<String, Value>, reasons: &mut Vec<&'static str>) -> Value {
    let encoded_len = serde_json::to_string(&fields).map_or(usize::MAX, |text| text.len());
    if encoded_len > MAX_CELL_BYTES {
        add_reason(reasons, "cell_limit");
        return json!({ "truncated": true, "original_bytes": encoded_len });
    }
    Value::Object(fields)
}

/// @name encode_rows
/// @description Applies the row, column, cell and byte limits to a query result
/// before it reaches an agent.
///
/// @example
/// let encoded = encode_rows(columns, rows, 200);
pub fn encode_rows(columns: Vec<String>, rows: Vec<Vec<Value>>, max_rows: usize) -> EncodedRows {
    let mut encoded = EncodedRows::default();
    let visible_columns = columns.len().min(MAX_COLUMNS);
    if columns.len() > MAX_COLUMNS {
        add_reason(&mut encoded.reasons, "column_limit");
    }
    encoded.columns = columns
        .into_iter()
        .take(visible_columns)
        .map(|name| json!({ "name": name }))
        .collect();

    if rows.len() > max_rows {
        add_reason(&mut encoded.reasons, "row_limit");
    }

    let mut used_bytes = 0;
    for row in rows.into_iter().take(max_rows) {
        let cells: Vec<Value> = row
            .into_iter()
            .take(visible_columns)
            .map(|cell| limit_cell(cell, &mut encoded.reasons))
            .collect();
        let row = Value::Array(cells);
        let row_bytes = serde_json::to_string(&row).map_or(usize::MAX, |text| text.len());
        if used_bytes + row_bytes > MAX_RESULT_BYTES {
            add_reason(&mut encoded.reasons, "byte_limit");
            break;
        }
        used_bytes += row_bytes;
        encoded.rows.push(row);
    }
    encoded
}

/// @name limit_kv_value
/// @description Applies cell limits to a serialized key-value result, and drops
/// the value when the whole result is still over the byte limit.
///
/// @example
/// let (value, reasons) = limit_kv_value(serde_json::to_value(result)?);
pub fn limit_kv_value(value: Value) -> (Value, Vec<&'static str>) {
    let mut reasons = Vec::new();
    let limited = limit_nested(value, &mut reasons);
    let encoded_len = serde_json::to_string(&limited).map_or(usize::MAX, |text| text.len());
    if encoded_len > MAX_RESULT_BYTES {
        add_reason(&mut reasons, "byte_limit");
        return (
            json!({ "truncated": true, "original_bytes": encoded_len }),
            reasons,
        );
    }
    (limited, reasons)
}

fn limit_nested(value: Value, reasons: &mut Vec<&'static str>) -> Value {
    match value {
        Value::String(text) if text.len() > MAX_CELL_BYTES => {
            add_reason(reasons, "cell_limit");
            let end = floor_char_boundary(&text, MAX_CELL_BYTES);
            json!({ "truncated": true, "value": &text[..end], "original_bytes": text.len() })
        }
        Value::Array(items) => Value::Array(
            items
                .into_iter()
                .map(|item| limit_nested(item, reasons))
                .collect(),
        ),
        Value::Object(fields) => Value::Object(
            fields
                .into_iter()
                .map(|(key, item)| (key, limit_nested(item, reasons)))
                .collect(),
        ),
        other => other,
    }
}

fn add_secret(secrets: &mut Vec<String>, value: &str) {
    if value.len() >= 3 && !secrets.iter().any(|secret| secret == value) {
        secrets.push(value.to_string());
    }
}

fn add_url_secrets(secrets: &mut Vec<String>, value: &str) {
    add_secret(secrets, value);
    if let Ok(url) = url::Url::parse(value) {
        if let Some(password) = url.password() {
            add_secret(secrets, password);
            if let Ok(decoded) = urlencoding_decode(password) {
                add_secret(secrets, &decoded);
            }
        }
        for (key, item) in url.query_pairs() {
            let key = key.to_ascii_lowercase();
            if key.contains("password") || key.contains("token") || key.contains("secret") {
                add_secret(secrets, &item);
            }
        }
    }
}

fn urlencoding_decode(value: &str) -> Result<String, std::string::FromUtf8Error> {
    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            let pair = std::str::from_utf8(&bytes[index + 1..index + 3]).ok();
            if let Some(byte) = pair.and_then(|hex| u8::from_str_radix(hex, 16).ok()) {
                decoded.push(byte);
                index += 3;
                continue;
            }
        }
        decoded.push(bytes[index]);
        index += 1;
    }
    String::from_utf8(decoded)
}

fn add_ssh_secrets(secrets: &mut Vec<String>, ssh: Option<&SshConfig>) {
    if let Some(password) = ssh.and_then(|ssh| ssh.password.as_deref()) {
        add_secret(secrets, password);
    }
}

/// @name sql_secrets
/// @description Collects the secrets known for a SQL connection so driver errors
/// can be redacted before they reach an agent.
///
/// @example
/// let message = redact(&error, &sql_secrets(&info));
pub fn sql_secrets(info: &ConnectionInfo) -> Vec<String> {
    let mut secrets = Vec::new();
    match &info.database_type {
        DatabaseInfo::Postgres {
            connection_string,
            ssh_config,
        }
        | DatabaseInfo::CockroachDB {
            connection_string,
            ssh_config,
        }
        | DatabaseInfo::MySQL {
            connection_string,
            ssh_config,
        }
        | DatabaseInfo::MariaDB {
            connection_string,
            ssh_config,
        } => {
            add_url_secrets(&mut secrets, connection_string);
            add_ssh_secrets(&mut secrets, ssh_config.as_ref());
        }
        DatabaseInfo::LibSQL { url, auth_token } => {
            add_url_secrets(&mut secrets, url);
            if let Some(token) = auth_token {
                add_secret(&mut secrets, token);
            }
        }
        DatabaseInfo::D1 { url } | DatabaseInfo::Posthog { url } => {
            add_url_secrets(&mut secrets, url);
        }
        DatabaseInfo::SQLite { db_path } | DatabaseInfo::DuckDB { db_path, .. } => {
            add_secret(&mut secrets, db_path);
        }
    }
    if let Ok(Some(password)) = credentials::get_password(&info.id) {
        add_secret(&mut secrets, &password);
    }
    secrets
}

pub fn kv_secrets(info: &KvConnectionInfo) -> Vec<String> {
    let mut secrets = Vec::new();
    add_url_secrets(&mut secrets, &info.config.url);
    add_ssh_secrets(&mut secrets, info.config.ssh_tunnel.as_ref());
    secrets
}

/// @name redact
/// @description Removes known secrets and URL credentials from driver error text.
///
/// @example
/// let safe = redact("failed for postgres://u:p@host/db", &secrets);
pub fn redact(message: &str, secrets: &[String]) -> String {
    let mut ordered: Vec<&String> = secrets.iter().collect();
    ordered.sort_by_key(|secret| std::cmp::Reverse(secret.len()));
    let mut redacted = message.to_string();
    for secret in ordered {
        redacted = redacted.replace(secret.as_str(), "[redacted]");
    }
    redact_url_userinfo(&redacted)
}

fn redact_url_userinfo(message: &str) -> String {
    let mut output = String::with_capacity(message.len());
    let mut rest = message;
    while let Some(scheme_end) = rest.find("://") {
        let authority_start = scheme_end + 3;
        output.push_str(&rest[..authority_start]);
        let tail = &rest[authority_start..];
        let authority_end = tail
            .find(|character: char| character.is_whitespace() || "/?#'\"".contains(character))
            .unwrap_or(tail.len());
        let authority = &tail[..authority_end];
        if let Some(at) = authority.rfind('@') {
            output.push_str("[redacted]@");
            output.push_str(&authority[at + 1..]);
        } else {
            output.push_str(authority);
        }
        rest = &tail[authority_end..];
    }
    output.push_str(rest);
    output
}
