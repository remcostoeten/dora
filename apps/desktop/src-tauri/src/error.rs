use std::fmt::Debug;

use uuid::Uuid;

pub type Result<T = ()> = std::result::Result<T, Error>;

/// Database engine discriminator for driver-scoped errors.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum DatabaseKind {
    Postgres,
    Mysql,
    Sqlite,
    Libsql,
}

/// Unified error type crossing the Tauri IPC boundary.
///
/// Variants split into two groups:
/// - Typed application errors (preferred for new code) — map to specific
///   frontend handling via the `kind` discriminator in the serialized shape.
/// - Transparent wrappers around foreign errors (kept as an escape hatch for
///   existing call sites and to preserve `?`-propagation via `From` impls).
///
/// Wire shape on serialize: `{ "kind": "<Variant>", "detail": "<string>" }`.
/// Specta binding still emits `any`; a follow-up upgrade will surface the
/// discriminated union to TypeScript.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    // ---- Typed application errors -----------------------------------------
    #[error("connection not found: {0}")]
    ConnectionNotFound(Uuid),

    #[error("connection failed: {0}")]
    ConnectionFailed(String),

    #[error("authentication failed")]
    AuthFailed,

    #[error("permission denied: {0}")]
    PermissionDenied(String),

    #[error("driver error [{kind:?}]: {message}")]
    Driver { kind: DatabaseKind, message: String },

    #[error("serialization failed: {0}")]
    Serialization(String),

    #[error("query cancelled")]
    Cancelled,

    #[error("timeout after {ms}ms")]
    Timeout { ms: u64 },

    #[error("not implemented: {0}")]
    NotImplemented(&'static str),

    #[error("invalid input: {0}")]
    InvalidInput(String),

    #[error("io error: {0}")]
    Io(String),

    #[error("internal: {0}")]
    Internal(String),

    // ---- Transparent wrappers (escape hatches for existing call sites) ----
    #[error(transparent)]
    Any(#[from] anyhow::Error),
    #[error(transparent)]
    Tauri(#[from] tauri::Error),
    #[error(transparent)]
    Rusqlite(#[from] rusqlite::Error),
    #[error(transparent)]
    Fmt(#[from] std::fmt::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    Postgres(#[from] tokio_postgres::Error),
    #[error(transparent)]
    MySQL(#[from] mysql_async::Error),
}

impl<T: Debug> From<tokio::sync::mpsc::error::SendError<T>> for Error {
    fn from(error: tokio::sync::mpsc::error::SendError<T>) -> Self {
        Error::Internal(format!(
            "channel closed while sending {:?} — this should not happen, please report at https://github.com/remcostoeten/Dora/issues",
            error
        ))
    }
}

impl From<std::io::Error> for Error {
    fn from(error: std::io::Error) -> Self {
        Error::Io(error.to_string())
    }
}

impl Error {
    /// The serialized `kind` tag for this variant. Stable — frontend switches on it.
    fn tag(&self) -> &'static str {
        match self {
            Error::ConnectionNotFound(_) => "ConnectionNotFound",
            Error::ConnectionFailed(_) => "ConnectionFailed",
            Error::AuthFailed => "AuthFailed",
            Error::PermissionDenied(_) => "PermissionDenied",
            Error::Driver { .. } => "Driver",
            Error::Serialization(_) | Error::Json(_) => "Serialization",
            Error::Cancelled => "Cancelled",
            Error::Timeout { .. } => "Timeout",
            Error::NotImplemented(_) => "NotImplemented",
            Error::InvalidInput(_) => "InvalidInput",
            Error::Io(_) => "Io",
            Error::Rusqlite(_) | Error::Postgres(_) | Error::MySQL(_) => "Driver",
            Error::Internal(_) | Error::Any(_) | Error::Tauri(_) | Error::Fmt(_) => "Internal",
        }
    }
}

impl serde::Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        use serde::ser::SerializeMap;
        let kind = self.tag();
        let detail = self.to_string();
        let mut map = serializer.serialize_map(Some(2))?;
        map.serialize_entry("kind", kind)?;
        map.serialize_entry("detail", &detail)?;
        map.end()
    }
}

impl specta::Type for Error {
    fn inline(_: &mut specta::TypeCollection, _: specta::Generics) -> specta::DataType {
        // TODO: upgrade to a typed discriminated union so the frontend sees
        // `{ kind: "ConnectionNotFound" | ... ; detail: string }`. Kept as Any
        // for now to avoid coupling Phase 3 to a specta plumbing change.
        specta::DataType::Any
    }
}
