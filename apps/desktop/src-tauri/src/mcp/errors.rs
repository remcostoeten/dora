use serde_json::{json, Value};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum McpErrorCode {
    AgentAccessDisabled,
    ConnectionNotAvailable,
    PermissionDenied,
    PrivacyModeEnabled,
    StorageChanged,
    InvalidInput,
    ParseFailed,
    MultipleStatements,
    StatementNotAllowed,
    FunctionNotAllowed,
    UnsupportedLimit,
    AmbiguousTable,
    AtomicBatchUnsupported,
    WriteNotSupported,
    TooManyPendingProposals,
    ProposalNotFound,
    ConnectionFailed,
    QueryTimeout,
    QueryFailed,
    AuditFailed,
    Internal,
}

impl McpErrorCode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::AgentAccessDisabled => "agent_access_disabled",
            Self::ConnectionNotAvailable => "connection_not_available",
            Self::PermissionDenied => "permission_denied",
            Self::PrivacyModeEnabled => "privacy_mode_enabled",
            Self::StorageChanged => "storage_changed",
            Self::InvalidInput => "invalid_input",
            Self::ParseFailed => "parse_failed",
            Self::MultipleStatements => "multiple_statements",
            Self::StatementNotAllowed => "statement_not_allowed",
            Self::FunctionNotAllowed => "function_not_allowed",
            Self::UnsupportedLimit => "unsupported_limit",
            Self::AmbiguousTable => "ambiguous_table",
            Self::AtomicBatchUnsupported => "atomic_batch_unsupported",
            Self::WriteNotSupported => "write_not_supported",
            Self::TooManyPendingProposals => "too_many_pending_proposals",
            Self::ProposalNotFound => "proposal_not_found",
            Self::ConnectionFailed => "connection_failed",
            Self::QueryTimeout => "query_timeout",
            Self::QueryFailed => "query_failed",
            Self::AuditFailed => "audit_failed",
            Self::Internal => "internal_error",
        }
    }

    fn retryable(self) -> bool {
        matches!(
            self,
            Self::ConnectionFailed | Self::QueryTimeout | Self::AuditFailed
        )
    }
}

#[derive(Debug, Clone)]
pub struct McpFailure {
    pub code: McpErrorCode,
    pub message: String,
    pub committed: Option<bool>,
    pub details: Option<Value>,
}

impl McpFailure {
    pub fn new(code: McpErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            committed: None,
            details: None,
        }
    }

    pub fn internal() -> Self {
        Self::new(
            McpErrorCode::Internal,
            "Dora could not complete the request.",
        )
    }

    pub fn with_committed(mut self, committed: bool) -> Self {
        self.committed = Some(committed);
        self
    }

    pub fn with_details(mut self, details: Value) -> Self {
        self.details = Some(details);
        self
    }

    pub fn to_value(&self) -> Value {
        let mut value = json!({
            "code": self.code.as_str(),
            "message": self.message,
            "retryable": self.code.retryable(),
        });
        if let Some(committed) = self.committed {
            value["committed"] = json!(committed);
        }
        if let Some(details) = &self.details {
            value["details"] = details.clone();
        }
        value
    }
}

impl From<crate::Error> for McpFailure {
    fn from(error: crate::Error) -> Self {
        log::warn!("MCP storage operation failed: {error}");
        Self::internal()
    }
}
