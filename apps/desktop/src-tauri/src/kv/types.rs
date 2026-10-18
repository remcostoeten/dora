use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct KvConnectionConfig {
    pub url: String,
}

pub type KvValueType = KvDataType;
pub type KvKeyPage = KvScanPage;
pub type KvCommandResult = RawCommandResult;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum KvDataType {
    String,
    Hash,
    List,
    Set,
    SortedSet,
    Stream,
    Unknown,
}

impl KvDataType {
    pub(crate) fn from_redis_name(name: &str) -> Self {
        match name {
            "string" => Self::String,
            "hash" => Self::Hash,
            "list" => Self::List,
            "set" => Self::Set,
            "zset" => Self::SortedSet,
            "stream" => Self::Stream,
            _ => Self::Unknown,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(tag = "encoding", content = "value", rename_all = "snake_case")]
pub enum KvBytes {
    Utf8(String),
    Base64(String),
}

impl KvBytes {
    pub fn from_bytes(bytes: Vec<u8>) -> Self {
        match String::from_utf8(bytes) {
            Ok(text) => Self::Utf8(text),
            Err(error) => Self::Base64(STANDARD.encode(error.into_bytes())),
        }
    }

    pub fn into_bytes(self) -> Result<Vec<u8>> {
        match self {
            Self::Utf8(text) => Ok(text.into_bytes()),
            Self::Base64(value) => STANDARD
                .decode(value)
                .map_err(|error| Error::InvalidInput(format!("invalid base64 value: {error}"))),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct KvScanRequest {
    pub cursor: Option<u64>,
    pub pattern: Option<String>,
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct KvKeySummary {
    pub key: KvBytes,
    pub data_type: KvDataType,
    pub ttl_ms: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct KvScanPage {
    pub cursor: u64,
    pub keys: Vec<KvKeySummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct KvReadRequest {
    pub key: KvBytes,
    pub cursor: Option<u64>,
    pub offset: Option<u64>,
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct KvHashEntry {
    pub field: KvBytes,
    pub value: KvBytes,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct KvScoredMember {
    pub member: KvBytes,
    pub score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum KvValue {
    String {
        value: KvBytes,
        total_bytes: u64,
        truncated: bool,
    },
    Hash {
        entries: Vec<KvHashEntry>,
        cursor: u64,
    },
    List {
        items: Vec<KvBytes>,
        offset: u64,
        total_items: u64,
        has_more: bool,
    },
    Set {
        members: Vec<KvBytes>,
        cursor: u64,
    },
    SortedSet {
        members: Vec<KvScoredMember>,
        cursor: u64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct KvReadResult {
    pub key: KvBytes,
    pub ttl_ms: Option<i64>,
    pub value: KvValue,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct KvMutationResult {
    pub changed: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(tag = "level", rename_all = "snake_case")]
pub enum RawCommandSafety {
    Safe,
    Destructive { confirmation: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(tag = "type", content = "value", rename_all = "snake_case")]
pub enum RawCommandResult {
    Null,
    Integer(i64),
    Double(f64),
    Boolean(bool),
    Text(String),
    Bytes(KvBytes),
    Array(Vec<RawCommandResult>),
    Map(Vec<(RawCommandResult, RawCommandResult)>),
    Set(Vec<RawCommandResult>),
}
