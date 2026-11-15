use std::fmt;
use std::sync::Arc;
use std::time::Duration;

use redis::{
    aio::{ConnectionLike, MultiplexedConnection},
    cluster::ClusterClientBuilder,
    cluster_async::ClusterConnection,
    cluster_routing::{MultipleNodeRoutingInfo, RoutingInfo, SingleNodeRoutingInfo},
    Cmd, Pipeline, RedisFuture, Value,
};
use tokio::time::timeout;

use crate::database::ssh_tunnel::SshTunnel;
use crate::error::{Error, Result};

use super::types::{
    KvBytes, KvConnectionConfig, KvDataType, KvHashEntry, KvKeySummary, KvMutationResult,
    KvReadRequest, KvReadResult, KvScanPage, KvScanRequest, KvScoredMember, KvValue,
    RawCommandResult, RawCommandSafety,
};

const DEFAULT_PAGE_SIZE: u32 = 100;
const MAX_PAGE_SIZE: u32 = 1_000;
const DEFAULT_CONNECT_TIMEOUT_MS: u64 = 10_000;
const DEFAULT_REDIS_PORT: u16 = 6379;
/// A cluster SCAN cursor packs the primary's index into the low bits, so one opaque u64 can resume on the right node.
const CLUSTER_CURSOR_SPAN: u64 = 1_024;

#[derive(Clone)]
enum Link {
    Single(MultiplexedConnection),
    Cluster(ClusterConnection),
}

impl fmt::Debug for Link {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Link::Single(_) => "Link::Single",
            Link::Cluster(_) => "Link::Cluster",
        })
    }
}

impl ConnectionLike for Link {
    fn req_packed_command<'a>(&'a mut self, cmd: &'a Cmd) -> RedisFuture<'a, Value> {
        match self {
            Link::Single(connection) => connection.req_packed_command(cmd),
            Link::Cluster(connection) => connection.req_packed_command(cmd),
        }
    }

    fn req_packed_commands<'a>(
        &'a mut self,
        pipeline: &'a Pipeline,
        offset: usize,
        count: usize,
    ) -> RedisFuture<'a, Vec<Value>> {
        match self {
            Link::Single(connection) => connection.req_packed_commands(pipeline, offset, count),
            Link::Cluster(connection) => connection.req_packed_commands(pipeline, offset, count),
        }
    }

    fn get_db(&self) -> i64 {
        match self {
            Link::Single(connection) => connection.get_db(),
            Link::Cluster(connection) => connection.get_db(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct KvService {
    connection: Link,
    _tunnel: Option<Arc<SshTunnel>>,
}

impl KvService {
    pub async fn connect(config: &KvConnectionConfig) -> Result<Self> {
        let mut url = parse_url(&config.url)?;
        let tunnel = match &config.ssh_tunnel {
            Some(ssh) => {
                if url.scheme() == "rediss" && !config.skip_tls_verify {
                    return Err(Error::InvalidInput(
                        "TLS through an SSH tunnel connects to 127.0.0.1, so the certificate name can never match. Turn on \"Skip certificate verification\" to use rediss:// with a tunnel.".to_string(),
                    ));
                }
                let remote_host = url
                    .host_str()
                    .ok_or_else(|| Error::InvalidInput("Redis URL has no host".to_string()))?
                    .to_string();
                let remote_port = url.port().unwrap_or(DEFAULT_REDIS_PORT);
                let tunnel = SshTunnel::start(
                    &ssh.host,
                    ssh.port,
                    &ssh.username,
                    ssh.private_key_path
                        .as_deref()
                        .filter(|path| !path.is_empty()),
                    ssh.password
                        .as_deref()
                        .filter(|password| !password.is_empty()),
                    ssh.host_key_fingerprint.as_deref(),
                    remote_host,
                    remote_port,
                )
                .map_err(|error| Error::ConnectionFailed(format!("SSH tunnel: {error:#}")))?;
                route_through_tunnel(&mut url, tunnel.local_port)?;
                Some(Arc::new(tunnel))
            }
            None => None,
        };
        if config.skip_tls_verify && url.scheme() == "rediss" {
            url.set_fragment(Some("insecure"));
        }

        let duration = Duration::from_millis(DEFAULT_CONNECT_TIMEOUT_MS);
        let describe = |error: redis::RedisError| {
            let error = map_connection_error(error);
            match (&tunnel, error) {
                (Some(_), Error::ConnectionFailed(message)) => Error::ConnectionFailed(format!(
                    "could not reach Redis through the SSH tunnel ({message}). Check the SSH host, user, key and the Redis host as seen from the SSH server."
                )),
                (_, error) => error,
            }
        };
        let client = redis::Client::open(url.as_str())
            .map_err(|error| Error::ConnectionFailed(error.to_string()))?;
        let mut single = timeout(duration, client.get_multiplexed_async_connection())
            .await
            .map_err(|_| Error::Timeout {
                ms: duration.as_millis() as u64,
            })?
            .map_err(describe)?;

        let connection = if cluster_enabled(&mut single).await {
            if tunnel.is_some() {
                return Err(Error::InvalidInput(
                    "This server runs in cluster mode. Cluster nodes hand out their own addresses, which a single SSH tunnel cannot reach, so connect without the tunnel (for example from inside the network or over a VPN).".to_string(),
                ));
            }
            let cluster = ClusterClientBuilder::new(vec![url.as_str()])
                .connection_timeout(duration)
                .build()
                .map_err(map_connection_error)?;
            let connection = timeout(duration, cluster.get_async_connection())
                .await
                .map_err(|_| Error::Timeout {
                    ms: duration.as_millis() as u64,
                })?
                .map_err(map_connection_error)?;
            Link::Cluster(connection)
        } else {
            Link::Single(single)
        };

        let mut service = Self {
            connection,
            _tunnel: tunnel,
        };
        service.probe().await?;
        Ok(service)
    }

    pub fn is_cluster(&self) -> bool {
        matches!(self.connection, Link::Cluster(_))
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
        if let Link::Cluster(cluster) = &mut self.connection {
            return scan_cluster(cluster, request).await;
        }
        let command = scan_command(request.cursor.unwrap_or(0), request.pattern, request.limit);
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
        let values: Vec<Value> = metadata_pipeline(keys)
            .query_async(&mut self.connection)
            .await
            .map_err(map_driver_error)?;
        parse_metadata(keys, &values)
    }

    async fn integer_mutation(&mut self, command: &mut Cmd) -> Result<KvMutationResult> {
        let changed: u64 = command
            .query_async(&mut self.connection)
            .await
            .map_err(map_driver_error)?;
        Ok(KvMutationResult { changed })
    }
}

fn scan_command(cursor: u64, pattern: Option<String>, limit: Option<u32>) -> Cmd {
    let mut command = redis::cmd("SCAN");
    command.arg(cursor);
    if let Some(pattern) = pattern.filter(|value| !value.is_empty()) {
        command.arg("MATCH").arg(pattern);
    }
    command.arg("COUNT").arg(page_size(limit));
    command
}

fn metadata_pipeline(keys: &[Vec<u8>]) -> Pipeline {
    let mut pipeline = redis::pipe();
    for key in keys {
        pipeline.cmd("TYPE").arg(key).cmd("PTTL").arg(key);
    }
    pipeline
}

fn parse_metadata(keys: &[Vec<u8>], values: &[Value]) -> Result<Vec<(KvDataType, Option<i64>)>> {
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

async fn cluster_enabled(connection: &mut MultiplexedConnection) -> bool {
    let info: redis::RedisResult<String> = redis::cmd("INFO")
        .arg("cluster")
        .query_async(connection)
        .await;
    info.map(|text| text.lines().any(|line| line.trim() == "cluster_enabled:1"))
        .unwrap_or(false)
}

async fn cluster_primaries(cluster: &mut ClusterConnection) -> Result<Vec<(String, u16)>> {
    let reply = cluster
        .route_command(
            redis::cmd("ECHO").arg("dora"),
            RoutingInfo::MultiNode((MultipleNodeRoutingInfo::AllMasters, None)),
        )
        .await
        .map_err(map_driver_error)?;
    let Value::Map(entries) = reply else {
        return Err(Error::Internal(
            "Redis/Valkey cluster did not list its primaries".to_string(),
        ));
    };
    let mut primaries = entries
        .iter()
        .map(|(address, _)| {
            let address: String = redis::from_redis_value(address).map_err(map_driver_error)?;
            split_address(&address)
        })
        .collect::<Result<Vec<_>>>()?;
    primaries.sort();
    Ok(primaries)
}

fn split_address(address: &str) -> Result<(String, u16)> {
    address
        .rsplit_once(':')
        .and_then(|(host, port)| Some((host.to_string(), port.parse().ok()?)))
        .ok_or_else(|| Error::Internal(format!("unexpected cluster node address {address}")))
}

fn split_cluster_cursor(cursor: u64) -> (usize, u64) {
    (
        (cursor % CLUSTER_CURSOR_SPAN) as usize,
        cursor / CLUSTER_CURSOR_SPAN,
    )
}

fn next_cluster_cursor(node: usize, node_cursor: u64, node_count: usize) -> Result<u64> {
    if node_cursor != 0 {
        return node_cursor
            .checked_mul(CLUSTER_CURSOR_SPAN)
            .map(|cursor| cursor + node as u64)
            .ok_or_else(|| Error::Internal("cluster SCAN cursor overflowed".to_string()));
    }
    Ok(if node + 1 < node_count {
        node as u64 + 1
    } else {
        0
    })
}

async fn scan_cluster(
    cluster: &mut ClusterConnection,
    request: KvScanRequest,
) -> Result<KvScanPage> {
    let primaries = cluster_primaries(cluster).await?;
    if primaries.len() as u64 > CLUSTER_CURSOR_SPAN {
        return Err(Error::NotImplemented(
            "clusters with more than 1024 primaries",
        ));
    }
    let (node, node_cursor) = split_cluster_cursor(request.cursor.unwrap_or(0));
    let Some((host, port)) = primaries.get(node).cloned() else {
        return Err(Error::InvalidInput(
            "the cluster topology changed during the scan, start it again".to_string(),
        ));
    };
    let route = || SingleNodeRoutingInfo::ByAddress {
        host: host.clone(),
        port,
    };

    let reply = cluster
        .route_command(
            &scan_command(node_cursor, request.pattern, request.limit),
            RoutingInfo::SingleNode(route()),
        )
        .await
        .map_err(map_driver_error)?;
    let (next, keys): (u64, Vec<Vec<u8>>) =
        redis::from_redis_value(&reply).map_err(map_driver_error)?;

    let metadata = if keys.is_empty() {
        Vec::new()
    } else {
        let pipeline = metadata_pipeline(&keys);
        let values = cluster
            .route_pipeline(&pipeline, 0, keys.len() * 2, route())
            .await
            .map_err(map_driver_error)?;
        parse_metadata(&keys, &values)?
    };

    Ok(KvScanPage {
        cursor: next_cluster_cursor(node, next, primaries.len())?,
        keys: keys
            .into_iter()
            .zip(metadata)
            .map(|(key, (data_type, ttl_ms))| KvKeySummary {
                key: KvBytes::from_bytes(key),
                data_type,
                ttl_ms,
            })
            .collect(),
    })
}

fn route_through_tunnel(url: &mut url::Url, local_port: u16) -> Result<()> {
    url.set_host(Some("127.0.0.1"))
        .and_then(|_| {
            url.set_port(Some(local_port))
                .map_err(|_| url::ParseError::InvalidPort)
        })
        .map_err(|error| Error::InvalidInput(format!("invalid Redis URL: {error}")))
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

fn parse_url(value: &str) -> Result<url::Url> {
    let url = url::Url::parse(value.trim())
        .map_err(|error| Error::InvalidInput(format!("invalid Redis URL: {error}")))?;
    if !matches!(url.scheme(), "redis" | "rediss") {
        return Err(Error::InvalidInput(
            "Redis URL must use redis:// or rediss://".to_string(),
        ));
    }
    Ok(url)
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
        assert!(parse_url("redis://localhost:6379").is_ok());
        assert!(parse_url("rediss://example.com").is_ok());
        assert!(parse_url("postgres://localhost").is_err());
    }

    #[test]
    fn cluster_cursor_walks_every_primary_then_finishes() {
        assert_eq!(split_cluster_cursor(0), (0, 0));
        assert_eq!(next_cluster_cursor(0, 17, 3).unwrap(), 17 * 1_024);
        assert_eq!(split_cluster_cursor(17 * 1_024), (0, 17));
        assert_eq!(next_cluster_cursor(0, 0, 3).unwrap(), 1);
        assert_eq!(split_cluster_cursor(1), (1, 0));
        assert_eq!(next_cluster_cursor(1, 9, 3).unwrap(), 9 * 1_024 + 1);
        assert_eq!(split_cluster_cursor(9 * 1_024 + 1), (1, 9));
        assert_eq!(next_cluster_cursor(2, 0, 3).unwrap(), 0);
        assert!(next_cluster_cursor(0, u64::MAX, 3).is_err());
    }

    #[test]
    fn tunnel_rewrites_host_and_keeps_credentials() {
        let mut url = parse_url("rediss://default:secret@cache.internal:6380/2").unwrap();
        route_through_tunnel(&mut url, 40123).unwrap();
        assert_eq!(url.as_str(), "rediss://default:secret@127.0.0.1:40123/2");
    }

    #[test]
    fn splits_cluster_node_addresses() {
        assert_eq!(
            split_address("10.0.0.4:7001").unwrap(),
            ("10.0.0.4".to_string(), 7001)
        );
        assert!(split_address("no-port").is_err());
    }
}
