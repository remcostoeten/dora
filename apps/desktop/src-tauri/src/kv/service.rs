use std::time::Duration;

use redis::{aio::MultiplexedConnection, Cmd, Value};
use tokio::time::timeout;

use crate::error::{Error, Result};

use super::types::{
    KvBytes, KvConnectionConfig, KvDataType, KvHashEntry, KvKeySummary, KvMutationResult,
    KvReadRequest, KvReadResult, KvScanPage, KvScanRequest, KvScoredMember, KvValue,
    RawCommandResult, RawCommandSafety,
};

const DEFAULT_PAGE_SIZE: u32 = 100;
const MAX_PAGE_SIZE: u32 = 1_000;
const DEFAULT_CONNECT_TIMEOUT_MS: u64 = 10_000;

#[derive(Debug, Clone)]
pub struct KvService {
    connection: MultiplexedConnection,
}

impl KvService {
    pub async fn connect(config: &KvConnectionConfig) -> Result<Self> {
        validate_url(&config.url)?;
        let client = redis::Client::open(config.url.as_str())
            .map_err(|error| Error::ConnectionFailed(error.to_string()))?;
        let duration = Duration::from_millis(DEFAULT_CONNECT_TIMEOUT_MS);
        let connection = timeout(duration, client.get_multiplexed_async_connection())
            .await
            .map_err(|_| Error::Timeout {
                ms: duration.as_millis() as u64,
            })?
            .map_err(map_connection_error)?;
        let mut service = Self { connection };
        service.probe().await?;
        Ok(service)
    }

    pub async fn probe(&mut self) -> Result<()> {
        let response: String = redis::cmd("PING")
            .query_async(&mut self.connection)
            .await
            .map_err(map_connection_error)?;
        if response == "PONG" {
            Ok(())
        } else {
            Err(Error::ConnectionFailed(format!(
                "unexpected PING response: {response}"
            )))
        }
    }

    pub async fn scan(&mut self, request: KvScanRequest) -> Result<KvScanPage> {
        let limit = page_size(request.limit);
        let mut command = redis::cmd("SCAN");
        command.arg(request.cursor.unwrap_or(0));
        if let Some(pattern) = request.pattern.filter(|value| !value.is_empty()) {
            command.arg("MATCH").arg(pattern);
        }
        command.arg("COUNT").arg(limit);
        let (cursor, keys): (u64, Vec<Vec<u8>>) = command
            .query_async(&mut self.connection)
            .await
            .map_err(map_driver_error)?;

        // TYPE/PTTL per key is too slow over a hosted connection, so pipeline them
        let metadata = self.metadata_many(&keys).await?;
        let mut summaries = Vec::with_capacity(keys.len());
        for (key, (data_type, ttl_ms)) in keys.into_iter().zip(metadata) {
            summaries.push(KvKeySummary {
                key: KvBytes::from_bytes(key),
                data_type,
                ttl_ms,
            });
        }
        Ok(KvScanPage {
            cursor,
            keys: summaries,
        })
    }

    pub async fn read(&mut self, request: KvReadRequest) -> Result<KvReadResult> {
        let key_value = request.key.clone();
        let key = request.key.into_bytes()?;
        let (data_type, ttl_ms) = self.metadata(&key).await?;
        let limit = page_size(request.limit);
        let cursor = request.cursor.unwrap_or(0);
        let offset = request.offset.unwrap_or(0);

        let value = match data_type {
            KvDataType::String => {
                let total_bytes: u64 = redis::cmd("STRLEN")
                    .arg(&key)
                    .query_async(&mut self.connection)
                    .await
                    .map_err(map_driver_error)?;
                let bytes: Vec<u8> = redis::cmd("GETRANGE")
                    .arg(&key)
                    .arg(offset)
                    .arg(offset.saturating_add(u64::from(limit)).saturating_sub(1))
                    .query_async(&mut self.connection)
                    .await
                    .map_err(map_driver_error)?;
                KvValue::String {
                    truncated: offset.saturating_add(bytes.len() as u64) < total_bytes,
                    value: KvBytes::from_bytes(bytes),
                    total_bytes,
                }
            }
            KvDataType::Hash => {
                let (cursor, entries): (u64, Vec<(Vec<u8>, Vec<u8>)>) = redis::cmd("HSCAN")
                    .arg(&key)
                    .arg(cursor)
                    .arg("COUNT")
                    .arg(limit)
                    .query_async(&mut self.connection)
                    .await
                    .map_err(map_driver_error)?;
                KvValue::Hash {
                    entries: entries
                        .into_iter()
                        .map(|(field, value)| KvHashEntry {
                            field: KvBytes::from_bytes(field),
                            value: KvBytes::from_bytes(value),
                        })
                        .collect(),
                    cursor,
                }
            }
            KvDataType::List => {
                let total_items: u64 = redis::cmd("LLEN")
                    .arg(&key)
                    .query_async(&mut self.connection)
                    .await
                    .map_err(map_driver_error)?;
                let items: Vec<Vec<u8>> = redis::cmd("LRANGE")
                    .arg(&key)
                    .arg(offset)
                    .arg(offset.saturating_add(u64::from(limit)).saturating_sub(1))
                    .query_async(&mut self.connection)
                    .await
                    .map_err(map_driver_error)?;
                KvValue::List {
                    has_more: offset.saturating_add(items.len() as u64) < total_items,
                    items: items.into_iter().map(KvBytes::from_bytes).collect(),
                    offset,
                    total_items,
                }
            }
            KvDataType::Set => {
                let (cursor, members): (u64, Vec<Vec<u8>>) = redis::cmd("SSCAN")
                    .arg(&key)
                    .arg(cursor)
                    .arg("COUNT")
                    .arg(limit)
                    .query_async(&mut self.connection)
                    .await
                    .map_err(map_driver_error)?;
                KvValue::Set {
                    members: members.into_iter().map(KvBytes::from_bytes).collect(),
                    cursor,
                }
            }
            KvDataType::SortedSet => {
                let (cursor, members): (u64, Vec<(Vec<u8>, f64)>) = redis::cmd("ZSCAN")
                    .arg(&key)
                    .arg(cursor)
                    .arg("COUNT")
                    .arg(limit)
                    .query_async(&mut self.connection)
                    .await
                    .map_err(map_driver_error)?;
                KvValue::SortedSet {
                    members: members
                        .into_iter()
                        .map(|(member, score)| KvScoredMember {
                            member: KvBytes::from_bytes(member),
                            score,
                        })
                        .collect(),
                    cursor,
                }
            }
            KvDataType::Stream => {
                return Err(Error::NotImplemented("stream values for Redis/Valkey"));
            }
            KvDataType::Unknown => {
                return Err(Error::InvalidInput("key does not exist".to_string()));
            }
        };
        Ok(KvReadResult {
            key: key_value,
            ttl_ms,
            value,
        })
    }

    pub async fn delete_key(&mut self, key: KvBytes) -> Result<KvMutationResult> {
        self.integer_mutation(redis::cmd("DEL").arg(key.into_bytes()?))
            .await
    }

    pub async fn set_ttl_ms(&mut self, key: KvBytes, ttl_ms: u64) -> Result<KvMutationResult> {
        if ttl_ms == 0 {
            return Err(Error::InvalidInput(
                "TTL must be greater than zero".to_string(),
            ));
        }
        self.integer_mutation(redis::cmd("PEXPIRE").arg(key.into_bytes()?).arg(ttl_ms))
            .await
    }

    pub async fn clear_ttl(&mut self, key: KvBytes) -> Result<KvMutationResult> {
        self.integer_mutation(redis::cmd("PERSIST").arg(key.into_bytes()?))
            .await
    }

    pub async fn set_string(
        &mut self,
        key: KvBytes,
        value: KvBytes,
        keep_ttl: bool,
    ) -> Result<KvMutationResult> {
        let mut command = redis::cmd("SET");
        command.arg(key.into_bytes()?).arg(value.into_bytes()?);
        if keep_ttl {
            command.arg("KEEPTTL");
        }
        let _: String = command
            .query_async(&mut self.connection)
            .await
            .map_err(map_driver_error)?;
        Ok(KvMutationResult { changed: 1 })
    }

    pub async fn hash_set(
        &mut self,
        key: KvBytes,
        field: KvBytes,
        value: KvBytes,
    ) -> Result<KvMutationResult> {
        self.integer_mutation(
            redis::cmd("HSET")
                .arg(key.into_bytes()?)
                .arg(field.into_bytes()?)
                .arg(value.into_bytes()?),
        )
        .await
    }

    pub async fn hash_delete(&mut self, key: KvBytes, field: KvBytes) -> Result<KvMutationResult> {
        self.integer_mutation(
            redis::cmd("HDEL")
                .arg(key.into_bytes()?)
                .arg(field.into_bytes()?),
        )
        .await
    }

    pub async fn list_set(
        &mut self,
        key: KvBytes,
        index: i64,
        value: KvBytes,
    ) -> Result<KvMutationResult> {
        let _: String = redis::cmd("LSET")
            .arg(key.into_bytes()?)
            .arg(index)
            .arg(value.into_bytes()?)
            .query_async(&mut self.connection)
            .await
            .map_err(map_driver_error)?;
        Ok(KvMutationResult { changed: 1 })
    }

    pub async fn list_push(
        &mut self,
        key: KvBytes,
        value: KvBytes,
        left: bool,
    ) -> Result<KvMutationResult> {
        let command = if left { "LPUSH" } else { "RPUSH" };
        self.integer_mutation(
            redis::cmd(command)
                .arg(key.into_bytes()?)
                .arg(value.into_bytes()?),
        )
        .await
    }

    pub async fn list_remove_at(&mut self, key: KvBytes, index: i64) -> Result<KvMutationResult> {
        // Redis has no remove-by-index command, so LSET a unique marker and LREM it
        let marker = format!("__dora_deleted_{}__", uuid::Uuid::new_v4());
        let key = key.into_bytes()?;
        let results: Vec<Value> = redis::pipe()
            .atomic()
            .cmd("LSET")
            .arg(&key)
            .arg(index)
            .arg(&marker)
            .cmd("LREM")
            .arg(&key)
            .arg(1)
            .arg(&marker)
            .query_async(&mut self.connection)
            .await
            .map_err(map_driver_error)?;
        Ok(KvMutationResult {
            changed: u64::from(!results.is_empty()),
        })
    }

    pub async fn set_add(&mut self, key: KvBytes, member: KvBytes) -> Result<KvMutationResult> {
        self.integer_mutation(
            redis::cmd("SADD")
                .arg(key.into_bytes()?)
                .arg(member.into_bytes()?),
        )
        .await
    }

    pub async fn set_remove(&mut self, key: KvBytes, member: KvBytes) -> Result<KvMutationResult> {
        self.integer_mutation(
            redis::cmd("SREM")
                .arg(key.into_bytes()?)
                .arg(member.into_bytes()?),
        )
        .await
    }

    pub async fn sorted_set_add(
        &mut self,
        key: KvBytes,
        member: KvBytes,
        score: f64,
    ) -> Result<KvMutationResult> {
        if !score.is_finite() {
            return Err(Error::InvalidInput("score must be finite".to_string()));
        }
        self.integer_mutation(
            redis::cmd("ZADD")
                .arg(key.into_bytes()?)
                .arg(score)
                .arg(member.into_bytes()?),
        )
        .await
    }

    pub async fn sorted_set_remove(
        &mut self,
        key: KvBytes,
        member: KvBytes,
    ) -> Result<KvMutationResult> {
        self.integer_mutation(
            redis::cmd("ZREM")
                .arg(key.into_bytes()?)
                .arg(member.into_bytes()?),
        )
        .await
    }

    pub async fn execute_raw(
        &mut self,
        input: &str,
        confirmation: Option<&str>,
    ) -> Result<RawCommandResult> {
        let args = parse_raw_command(input)?;
        let safety = classify_args(&args);
        if let RawCommandSafety::Destructive {
            confirmation: expected,
        } = &safety
        {
            if confirmation != Some(expected.as_str()) {
                return Err(Error::InvalidInput(format!(
                    "type {expected} to confirm this destructive command"
                )));
            }
        }
        let mut command = Cmd::new();
        command.arg(&args[0]);
        for argument in &args[1..] {
            command.arg(argument);
        }
        let value: Value = command
            .query_async(&mut self.connection)
            .await
            .map_err(map_driver_error)?;
        raw_result(value)
    }

    async fn metadata(&mut self, key: &[u8]) -> Result<(KvDataType, Option<i64>)> {
        let (kind, ttl): (String, i64) = redis::pipe()
            .cmd("TYPE")
            .arg(key)
            .cmd("PTTL")
            .arg(key)
            .query_async(&mut self.connection)
            .await
            .map_err(map_driver_error)?;
        Ok((
            KvDataType::from_redis_name(&kind),
            if ttl >= 0 { Some(ttl) } else { None },
        ))
    }

    async fn metadata_many(&mut self, keys: &[Vec<u8>]) -> Result<Vec<(KvDataType, Option<i64>)>> {
        if keys.is_empty() {
            return Ok(Vec::new());
        }
        let mut pipeline = redis::pipe();
        for key in keys {
            pipeline.cmd("TYPE").arg(key).cmd("PTTL").arg(key);
        }
        let values: Vec<Value> = pipeline
            .query_async(&mut self.connection)
            .await
            .map_err(map_driver_error)?;
        if values.len() != keys.len() * 2 {
            return Err(Error::Internal(
                "Redis/Valkey returned incomplete key metadata".to_string(),
            ));
        }
        values
            .chunks_exact(2)
            .map(|pair| {
                let kind: String = redis::from_redis_value(&pair[0]).map_err(map_driver_error)?;
                let ttl: i64 = redis::from_redis_value(&pair[1]).map_err(map_driver_error)?;
                Ok((
                    KvDataType::from_redis_name(&kind),
                    if ttl >= 0 { Some(ttl) } else { None },
                ))
            })
            .collect()
    }

    async fn integer_mutation(&mut self, command: &mut Cmd) -> Result<KvMutationResult> {
        let changed: u64 = command
            .query_async(&mut self.connection)
            .await
            .map_err(map_driver_error)?;
        Ok(KvMutationResult { changed })
    }
}

pub fn classify_raw_command(input: &str) -> Result<RawCommandSafety> {
    let args = parse_raw_command(input)?;
    Ok(classify_args(&args))
}

fn classify_args(args: &[Vec<u8>]) -> RawCommandSafety {
    let command = String::from_utf8_lossy(&args[0]).to_ascii_uppercase();
    match command.as_str() {
        "FLUSHALL" | "FLUSHDB" => RawCommandSafety::Destructive {
            confirmation: command,
        },
        _ => RawCommandSafety::Safe,
    }
}

pub fn parse_raw_command(input: &str) -> Result<Vec<Vec<u8>>> {
    let mut args = Vec::new();
    let mut current = Vec::new();
    let mut quote = None;
    let mut escaped = false;
    let mut started = false;

    for byte in input.bytes() {
        if escaped {
            current.push(match byte {
                b'n' => b'\n',
                b'r' => b'\r',
                b't' => b'\t',
                other => other,
            });
            escaped = false;
            started = true;
            continue;
        }
        if byte == b'\\' {
            escaped = true;
            started = true;
            continue;
        }
        if let Some(delimiter) = quote {
            if byte == delimiter {
                quote = None;
            } else {
                current.push(byte);
            }
            started = true;
            continue;
        }
        match byte {
            b'\'' | b'"' => {
                quote = Some(byte);
                started = true;
            }
            byte if byte.is_ascii_whitespace() => {
                if started {
                    args.push(std::mem::take(&mut current));
                    started = false;
                }
            }
            _ => {
                current.push(byte);
                started = true;
            }
        }
    }
    if escaped {
        return Err(Error::InvalidInput(
            "raw command ends with an incomplete escape".to_string(),
        ));
    }
    if quote.is_some() {
        return Err(Error::InvalidInput(
            "raw command contains an unterminated quote".to_string(),
        ));
    }
    if started {
        args.push(current);
    }
    if args.is_empty() || args[0].is_empty() {
        return Err(Error::InvalidInput("raw command is empty".to_string()));
    }
    Ok(args)
}

fn validate_url(value: &str) -> Result<()> {
    let url = url::Url::parse(value)
        .map_err(|error| Error::InvalidInput(format!("invalid Redis URL: {error}")))?;
    if !matches!(url.scheme(), "redis" | "rediss") {
        return Err(Error::InvalidInput(
            "Redis URL must use redis:// or rediss://".to_string(),
        ));
    }
    Ok(())
}

fn page_size(value: Option<u32>) -> u32 {
    value.unwrap_or(DEFAULT_PAGE_SIZE).clamp(1, MAX_PAGE_SIZE)
}

fn map_connection_error(error: redis::RedisError) -> Error {
    Error::ConnectionFailed(error.to_string())
}

fn map_driver_error(error: redis::RedisError) -> Error {
    Error::Internal(format!("Redis/Valkey: {error}"))
}

#[allow(unreachable_patterns)]
fn raw_result(value: Value) -> Result<RawCommandResult> {
    Ok(match value {
        Value::Nil => RawCommandResult::Null,
        Value::Int(value) => RawCommandResult::Integer(value),
        Value::BulkString(value) => RawCommandResult::Bytes(KvBytes::from_bytes(value)),
        Value::Array(values) => RawCommandResult::Array(
            values
                .into_iter()
                .map(raw_result)
                .collect::<Result<Vec<_>>>()?,
        ),
        Value::SimpleString(value) => RawCommandResult::Text(value),
        Value::Okay => RawCommandResult::Text("OK".to_string()),
        Value::Map(values) => RawCommandResult::Map(
            values
                .into_iter()
                .map(|(key, value)| Ok((raw_result(key)?, raw_result(value)?)))
                .collect::<Result<Vec<_>>>()?,
        ),
        Value::Attribute { data, .. } => raw_result(*data)?,
        Value::Set(values) => RawCommandResult::Set(
            values
                .into_iter()
                .map(raw_result)
                .collect::<Result<Vec<_>>>()?,
        ),
        Value::Double(value) => RawCommandResult::Double(value),
        Value::Boolean(value) => RawCommandResult::Boolean(value),
        Value::VerbatimString { text, .. } => RawCommandResult::Text(text),
        Value::BigNumber(value) => RawCommandResult::Text(value.to_string()),
        Value::Push { data, .. } => RawCommandResult::Array(
            data.into_iter()
                .map(raw_result)
                .collect::<Result<Vec<_>>>()?,
        ),
        other => RawCommandResult::Text(format!("{other:?}")),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_quoted_empty_and_escaped_arguments() {
        assert_eq!(
            parse_raw_command(r#"SET "user name" 'Ada Lovelace'"#).unwrap(),
            vec![
                b"SET".to_vec(),
                b"user name".to_vec(),
                b"Ada Lovelace".to_vec()
            ]
        );
        assert_eq!(
            parse_raw_command(r#"SET empty """#).unwrap(),
            vec![b"SET".to_vec(), b"empty".to_vec(), Vec::new()]
        );
        assert_eq!(
            parse_raw_command(r#"SET line one\ntwo"#).unwrap(),
            vec![b"SET".to_vec(), b"line".to_vec(), b"one\ntwo".to_vec()]
        );
    }

    #[test]
    fn rejects_incomplete_raw_input() {
        assert!(parse_raw_command("SET key 'value").is_err());
        assert!(parse_raw_command("SET key value\\").is_err());
        assert!(parse_raw_command("  ").is_err());
    }

    #[test]
    fn flags_only_flush_commands_for_confirmation() {
        assert_eq!(
            classify_raw_command("flushdb ASYNC").unwrap(),
            RawCommandSafety::Destructive {
                confirmation: "FLUSHDB".to_string()
            }
        );
        assert_eq!(
            classify_raw_command("  FLUSHALL").unwrap(),
            RawCommandSafety::Destructive {
                confirmation: "FLUSHALL".to_string()
            }
        );
        assert_eq!(
            classify_raw_command("DEL FLUSHALL").unwrap(),
            RawCommandSafety::Safe
        );
    }

    #[test]
    fn rejects_non_redis_urls() {
        assert!(validate_url("redis://localhost:6379").is_ok());
        assert!(validate_url("rediss://example.com").is_ok());
        assert!(validate_url("postgres://localhost").is_err());
    }
}
