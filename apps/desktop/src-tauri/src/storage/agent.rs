use anyhow::Context;
use rusqlite::{params, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use super::Storage;
use crate::{Error, Result};

const INTERRUPTED_PROPOSAL_MESSAGE: &str =
    "Dora closed before the result was recorded. Check the database before retrying.";

const PROPOSAL_COLUMNS: &str = "id, connection_id, statements_json, statements_hash, summary, risk, status, agent_client, created_at, expires_at, decided_at, finished_at, affected_rows, error_message";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum AgentPermission {
    Read,
    Propose,
    ReadWrite,
}

impl AgentPermission {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Read => "read",
            Self::Propose => "propose",
            Self::ReadWrite => "read_write",
        }
    }

    fn parse(value: &str) -> Option<Self> {
        match value {
            "read" => Some(Self::Read),
            "propose" => Some(Self::Propose),
            "read_write" => Some(Self::ReadWrite),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum AgentConnectionKind {
    Sql,
    Kv,
}

impl AgentConnectionKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Sql => "sql",
            Self::Kv => "kv",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum AgentProposalRisk {
    Standard,
    Destructive,
}

impl AgentProposalRisk {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Standard => "standard",
            Self::Destructive => "destructive",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum AgentProposalStatus {
    Pending,
    Approved,
    Rejected,
    Running,
    Applied,
    Failed,
    Expired,
}

impl AgentProposalStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Approved => "approved",
            Self::Rejected => "rejected",
            Self::Running => "running",
            Self::Applied => "applied",
            Self::Failed => "failed",
            Self::Expired => "expired",
        }
    }

    fn parse(value: &str) -> Self {
        match value {
            "pending" => Self::Pending,
            "approved" => Self::Approved,
            "rejected" => Self::Rejected,
            "running" => Self::Running,
            "applied" => Self::Applied,
            "expired" => Self::Expired,
            _ => Self::Failed,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct AgentProposal {
    pub id: String,
    pub connection_id: Uuid,
    pub statements: Vec<String>,
    pub statements_hash: String,
    pub summary: String,
    pub risk: AgentProposalRisk,
    pub status: AgentProposalStatus,
    pub agent_client: Option<String>,
    pub created_at: i64,
    pub expires_at: i64,
    pub decided_at: Option<i64>,
    pub finished_at: Option<i64>,
    pub affected_rows: Option<i64>,
    pub error_message: Option<String>,
}

pub struct NewAgentProposal<'a> {
    pub connection_id: Uuid,
    pub statements: &'a [String],
    pub summary: &'a str,
    pub risk: AgentProposalRisk,
    pub agent_client: Option<&'a str>,
    pub lifetime_seconds: i64,
    pub max_pending: i64,
}

pub struct NewAgentHistoryEntry<'a> {
    pub connection_id: Uuid,
    pub query_text: &'a str,
    pub duration_ms: Option<i64>,
    pub status: &'a str,
    pub row_count: i64,
    pub error_message: Option<&'a str>,
    pub agent_client: Option<&'a str>,
    pub agent_proposal_id: Option<&'a str>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct AgentActivityEntry {
    pub id: i64,
    pub connection_id: String,
    pub query_text: String,
    pub executed_at: i64,
    pub duration_ms: Option<i64>,
    pub status: String,
    pub row_count: i64,
    pub error_message: Option<String>,
    pub agent_client: Option<String>,
    pub agent_proposal_id: Option<String>,
}

fn lock_error() -> Error {
    Error::Internal("lock poisoned".into())
}

fn now() -> i64 {
    chrono::Utc::now().timestamp()
}

/// @name hash_agent_statements
/// @description Hashes the exact statements of a proposal so approval can detect
/// a stored proposal that changed after it was created.
///
/// @example
/// let hash = hash_agent_statements(&statements)?;
pub fn hash_agent_statements(statements: &[String]) -> Result<String> {
    let encoded = serde_json::to_vec(statements).context("Failed to encode statements")?;
    Ok(hex::encode(Sha256::digest(encoded)))
}

fn proposal_from_row(row: &Row<'_>) -> rusqlite::Result<(AgentProposal, String)> {
    let id: String = row.get(0)?;
    let connection_id: String = row.get(1)?;
    let statements_json: String = row.get(2)?;
    let risk: String = row.get(5)?;
    let status: String = row.get(6)?;
    let proposal = AgentProposal {
        id,
        connection_id: Uuid::parse_str(&connection_id).unwrap_or_else(|_| Uuid::nil()),
        statements: Vec::new(),
        statements_hash: row.get(3)?,
        summary: row.get(4)?,
        risk: if risk == "standard" {
            AgentProposalRisk::Standard
        } else {
            AgentProposalRisk::Destructive
        },
        status: AgentProposalStatus::parse(&status),
        agent_client: row.get(7)?,
        created_at: row.get(8)?,
        expires_at: row.get(9)?,
        decided_at: row.get(10)?,
        finished_at: row.get(11)?,
        affected_rows: row.get(12)?,
        error_message: row.get(13)?,
    };
    Ok((proposal, statements_json))
}

fn with_statements(
    (mut proposal, statements_json): (AgentProposal, String),
) -> Result<AgentProposal> {
    proposal.statements =
        serde_json::from_str(&statements_json).context("Failed to decode proposal statements")?;
    Ok(proposal)
}

impl Storage {
    pub fn agent_access_enabled(&self) -> Result<bool> {
        let conn = self.conn.lock().map_err(|_| lock_error())?;
        let enabled: i64 = conn
            .query_row(
                "SELECT enabled FROM agent_settings WHERE id = 1",
                [],
                |row| row.get(0),
            )
            .context("Failed to read agent settings")?;
        Ok(enabled == 1)
    }

    pub fn set_agent_access_enabled(&self, enabled: bool) -> Result<()> {
        let conn = self.conn.lock().map_err(|_| lock_error())?;
        conn.execute(
            "UPDATE agent_settings SET enabled = ?1, updated_at = ?2 WHERE id = 1",
            params![i64::from(enabled), now()],
        )
        .context("Failed to update agent settings")?;
        Ok(())
    }

    pub fn agent_grant(
        &self,
        connection_id: &Uuid,
        kind: AgentConnectionKind,
    ) -> Result<Option<AgentPermission>> {
        let conn = self.conn.lock().map_err(|_| lock_error())?;
        let permission: Option<String> = conn
            .query_row(
                "SELECT permission FROM agent_connection_grants WHERE connection_id = ?1 AND connection_kind = ?2",
                params![connection_id.to_string(), kind.as_str()],
                |row| row.get(0),
            )
            .optional()
            .context("Failed to read agent grant")?;
        Ok(permission.as_deref().and_then(AgentPermission::parse))
    }

    pub fn set_agent_grant(
        &self,
        connection_id: &Uuid,
        kind: AgentConnectionKind,
        permission: Option<AgentPermission>,
    ) -> Result<()> {
        let conn = self.conn.lock().map_err(|_| lock_error())?;
        match permission {
            Some(permission) => conn.execute(
                "INSERT INTO agent_connection_grants (connection_id, connection_kind, permission, updated_at)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(connection_id, connection_kind)
                 DO UPDATE SET permission = excluded.permission, updated_at = excluded.updated_at",
                params![connection_id.to_string(), kind.as_str(), permission.as_str(), now()],
            ),
            None => conn.execute(
                "DELETE FROM agent_connection_grants WHERE connection_id = ?1 AND connection_kind = ?2",
                params![connection_id.to_string(), kind.as_str()],
            ),
        }
        .context("Failed to update agent grant")?;
        Ok(())
    }

    /// @name privacy_mode_enabled
    /// @description Reads Privacy mode from the UI settings document. A document
    /// that cannot be parsed counts as enabled so agent reads fail closed.
    ///
    /// @example
    /// if storage.privacy_mode_enabled()? { return Err(refusal); }
    pub fn privacy_mode_enabled(&self) -> Result<bool> {
        let Some(document) = self.get_setting("ui_settings")? else {
            return Ok(false);
        };
        let Ok(value) = serde_json::from_str::<serde_json::Value>(&document) else {
            return Ok(true);
        };
        Ok(value
            .get("privacyMaskData")
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(false))
    }

    pub fn create_agent_proposal(
        &self,
        proposal: NewAgentProposal<'_>,
    ) -> Result<Option<AgentProposal>> {
        let statements_json =
            serde_json::to_string(proposal.statements).context("Failed to encode statements")?;
        let statements_hash = hash_agent_statements(proposal.statements)?;
        let id = Uuid::new_v4().to_string();
        let created_at = now();
        let expires_at = created_at + proposal.lifetime_seconds;

        let mut conn = self.conn.lock().map_err(|_| lock_error())?;
        let tx = conn.transaction().context("Failed to start proposal")?;
        tx.execute(
            "UPDATE agent_proposals SET status = 'expired', finished_at = ?1
             WHERE status = 'pending' AND expires_at <= ?1",
            [created_at],
        )
        .context("Failed to expire proposals")?;
        let pending: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM agent_proposals WHERE connection_id = ?1 AND status = 'pending'",
                [proposal.connection_id.to_string()],
                |row| row.get(0),
            )
            .context("Failed to count pending proposals")?;
        if pending >= proposal.max_pending {
            tx.commit().context("Failed to commit proposal expiry")?;
            return Ok(None);
        }
        tx.execute(
            "INSERT INTO agent_proposals
             (id, connection_id, statements_json, statements_hash, summary, risk, status, agent_client, created_at, expires_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending', ?7, ?8, ?9)",
            params![
                id,
                proposal.connection_id.to_string(),
                statements_json,
                statements_hash,
                proposal.summary,
                proposal.risk.as_str(),
                proposal.agent_client,
                created_at,
                expires_at
            ],
        )
        .context("Failed to save proposal")?;
        tx.commit().context("Failed to commit proposal")?;

        Ok(Some(AgentProposal {
            id,
            connection_id: proposal.connection_id,
            statements: proposal.statements.to_vec(),
            statements_hash,
            summary: proposal.summary.to_string(),
            risk: proposal.risk,
            status: AgentProposalStatus::Pending,
            agent_client: proposal.agent_client.map(str::to_string),
            created_at,
            expires_at,
            decided_at: None,
            finished_at: None,
            affected_rows: None,
            error_message: None,
        }))
    }

    pub fn expire_agent_proposals(&self) -> Result<()> {
        let conn = self.conn.lock().map_err(|_| lock_error())?;
        let timestamp = now();
        conn.execute(
            "UPDATE agent_proposals SET status = 'expired', finished_at = ?1
             WHERE status = 'pending' AND expires_at <= ?1",
            [timestamp],
        )
        .context("Failed to expire proposals")?;
        Ok(())
    }

    pub fn agent_proposal(&self, id: &str) -> Result<Option<AgentProposal>> {
        let row = {
            let conn = self.conn.lock().map_err(|_| lock_error())?;
            conn.query_row(
                &format!("SELECT {PROPOSAL_COLUMNS} FROM agent_proposals WHERE id = ?1"),
                [id],
                proposal_from_row,
            )
            .optional()
            .context("Failed to read proposal")?
        };
        row.map(with_statements).transpose()
    }

    pub fn list_agent_proposals(&self, limit: i64) -> Result<Vec<AgentProposal>> {
        self.expire_agent_proposals()?;
        let rows = {
            let conn = self.conn.lock().map_err(|_| lock_error())?;
            let mut stmt = conn
                .prepare(&format!(
                    "SELECT {PROPOSAL_COLUMNS} FROM agent_proposals
                     ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC
                     LIMIT ?1"
                ))
                .context("Failed to prepare proposals query")?;
            let mapped = stmt
                .query_map([limit], proposal_from_row)
                .context("Failed to list proposals")?;
            let mut rows = Vec::new();
            for row in mapped {
                rows.push(row.context("Failed to read proposal row")?);
            }
            rows
        };
        rows.into_iter().map(with_statements).collect()
    }

    /// @name transition_agent_proposal
    /// @description Moves a proposal between states with a compare-and-swap, so
    /// a proposal can only be claimed and run once.
    ///
    /// @example
    /// let claimed = storage.transition_agent_proposal(id, Pending, Approved)?;
    pub fn transition_agent_proposal(
        &self,
        id: &str,
        from: AgentProposalStatus,
        to: AgentProposalStatus,
    ) -> Result<bool> {
        let conn = self.conn.lock().map_err(|_| lock_error())?;
        let changed = conn
            .execute(
                "UPDATE agent_proposals
                 SET status = ?1, decided_at = COALESCE(decided_at, ?2)
                 WHERE id = ?3 AND status = ?4",
                params![to.as_str(), now(), id, from.as_str()],
            )
            .context("Failed to update proposal")?;
        Ok(changed == 1)
    }

    pub fn finish_agent_proposal(
        &self,
        id: &str,
        status: AgentProposalStatus,
        affected_rows: Option<i64>,
        error_message: Option<&str>,
    ) -> Result<()> {
        let conn = self.conn.lock().map_err(|_| lock_error())?;
        let changed = conn
            .execute(
                "UPDATE agent_proposals
                 SET status = ?1, finished_at = ?2, affected_rows = ?3, error_message = ?4
                 WHERE id = ?5
                   AND (status = 'running' OR (status = 'failed' AND error_message = ?6))",
                params![
                    status.as_str(),
                    now(),
                    affected_rows,
                    error_message,
                    id,
                    INTERRUPTED_PROPOSAL_MESSAGE
                ],
            )
            .context("Failed to finish proposal")?;
        if changed != 1 {
            return Err(Error::Internal(
                "The proposal outcome could not be recorded".into(),
            ));
        }
        Ok(())
    }

    pub fn recover_interrupted_agent_proposals(&self) -> Result<()> {
        let conn = self.conn.lock().map_err(|_| lock_error())?;
        let timestamp = now();
        conn.execute(
            "UPDATE agent_proposals
             SET status = 'failed', finished_at = ?1,
                 error_message = ?2
             WHERE status = 'running'",
            params![timestamp, INTERRUPTED_PROPOSAL_MESSAGE],
        )
        .context("Failed to recover running proposals")?;
        conn.execute(
            "UPDATE agent_proposals SET status = 'pending', decided_at = NULL WHERE status = 'approved'",
            [],
        )
        .context("Failed to reset approved proposals")?;
        Ok(())
    }

    pub fn save_agent_history(&self, entry: &NewAgentHistoryEntry<'_>) -> Result<()> {
        let conn = self.conn.lock().map_err(|_| lock_error())?;
        conn.execute(
            "INSERT INTO query_history
             (connection_id, query_text, executed_at, duration_ms, status, row_count, error_message, origin, agent_client, agent_proposal_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'agent', ?8, ?9)",
            params![
                entry.connection_id.to_string(),
                entry.query_text,
                now(),
                entry.duration_ms,
                entry.status,
                entry.row_count,
                entry.error_message,
                entry.agent_client,
                entry.agent_proposal_id
            ],
        )
        .context("Failed to save agent history")?;
        Ok(())
    }

    pub fn save_agent_kv_history(
        &self,
        connection_id: &Uuid,
        command_text: &str,
        duration_ms: Option<i64>,
        status: &str,
        error_message: Option<&str>,
        agent_client: Option<&str>,
    ) -> Result<()> {
        let conn = self.conn.lock().map_err(|_| lock_error())?;
        conn.execute(
            "INSERT INTO kv_command_history
             (connection_id, command_text, executed_at, duration_ms, status, error_message, origin, agent_client)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'agent', ?7)",
            params![
                connection_id.to_string(),
                command_text,
                now(),
                duration_ms,
                status,
                error_message,
                agent_client
            ],
        )
        .context("Failed to save agent key-value history")?;
        Ok(())
    }

    pub fn list_agent_activity(&self, limit: i64) -> Result<Vec<AgentActivityEntry>> {
        let conn = self.conn.lock().map_err(|_| lock_error())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, connection_id, query_text, executed_at, duration_ms, status, row_count, error_message, agent_client, agent_proposal_id
                 FROM query_history
                 WHERE origin = 'agent'
                 ORDER BY id DESC
                 LIMIT ?1",
            )
            .context("Failed to prepare agent activity query")?;
        let rows = stmt
            .query_map([limit], |row| {
                Ok(AgentActivityEntry {
                    id: row.get(0)?,
                    connection_id: row.get(1)?,
                    query_text: row.get(2)?,
                    executed_at: row.get(3)?,
                    duration_ms: row.get(4)?,
                    status: row.get(5)?,
                    row_count: row.get(6)?,
                    error_message: row.get(7)?,
                    agent_client: row.get(8)?,
                    agent_proposal_id: row.get(9)?,
                })
            })
            .context("Failed to list agent activity")?;
        let mut activity = Vec::new();
        for row in rows {
            activity.push(row.context("Failed to read agent activity")?);
        }
        Ok(activity)
    }
}
