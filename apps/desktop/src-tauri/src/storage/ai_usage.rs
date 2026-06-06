use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::Context;
use rusqlite::{params, Row};

use crate::Result;

#[derive(Debug, Clone)]
pub struct AiUsageInsert {
    pub provider: String,
    pub model: String,
    pub source: String,
    pub input_tokens: Option<u32>,
    pub output_tokens: Option<u32>,
    pub total_tokens: Option<u32>,
    pub estimated_cost_usd: Option<f64>,
    pub estimated: bool,
}

#[derive(Debug, Clone)]
pub struct AiUsageRow {
    pub id: i64,
    pub provider: String,
    pub model: String,
    pub source: String,
    pub input_tokens: Option<u32>,
    pub output_tokens: Option<u32>,
    pub total_tokens: Option<u32>,
    pub estimated_cost_usd: Option<f64>,
    pub estimated: bool,
    pub created_at: i64,
}

#[derive(Debug, Clone, Default)]
pub struct AiUsageProviderTotals {
    pub provider: String,
    pub request_count: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub total_tokens: u64,
    pub estimated_cost_usd: f64,
}

#[derive(Debug, Clone, Default)]
pub struct AiUsageTotals {
    pub request_count: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub total_tokens: u64,
    pub estimated_cost_usd: f64,
}

impl super::Storage {
    pub fn ai_usage_record(&self, entry: AiUsageInsert) -> Result<i64> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .context("system time before unix epoch")?
            .as_secs() as i64;

        let conn = self.get_sqlite_connection()?;
        conn.execute(
            "INSERT INTO ai_usage
                (provider, model, source, input_tokens, output_tokens, total_tokens, estimated_cost_usd, estimated, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                entry.provider,
                entry.model,
                entry.source,
                entry.input_tokens,
                entry.output_tokens,
                entry.total_tokens,
                entry.estimated_cost_usd,
                i32::from(entry.estimated),
                now,
            ],
        )
        .context("Failed to insert ai_usage row")?;

        Ok(conn.last_insert_rowid())
    }

    pub fn ai_usage_list(&self, limit: u32) -> Result<Vec<AiUsageRow>> {
        let conn = self.get_sqlite_connection()?;
        let mut stmt = conn
            .prepare(
                "SELECT id, provider, model, source, input_tokens, output_tokens, total_tokens,
                        estimated_cost_usd, estimated, created_at
                 FROM ai_usage
                 ORDER BY created_at DESC, id DESC
                 LIMIT ?1",
            )
            .context("Failed to prepare ai_usage_list statement")?;

        let rows = stmt
            .query_map([limit], map_ai_usage_row)
            .context("Failed to query ai_usage rows")?
            .collect::<rusqlite::Result<Vec<_>>>()
            .context("Failed to collect ai_usage rows")?;

        Ok(rows)
    }

    pub fn ai_usage_totals(&self) -> Result<AiUsageTotals> {
        let conn = self.get_sqlite_connection()?;
        Ok(conn
            .query_row(
                "SELECT
                COUNT(*),
                COALESCE(SUM(input_tokens), 0),
                COALESCE(SUM(output_tokens), 0),
                COALESCE(SUM(total_tokens), 0),
                COALESCE(SUM(estimated_cost_usd), 0.0)
             FROM ai_usage",
                [],
                |row| {
                    Ok(AiUsageTotals {
                        request_count: row.get(0)?,
                        input_tokens: row.get(1)?,
                        output_tokens: row.get(2)?,
                        total_tokens: row.get(3)?,
                        estimated_cost_usd: row.get(4)?,
                    })
                },
            )
            .context("Failed to query ai_usage totals")?)
    }

    pub fn ai_usage_totals_by_provider(&self) -> Result<Vec<AiUsageProviderTotals>> {
        let conn = self.get_sqlite_connection()?;
        let mut stmt = conn
            .prepare(
                "SELECT
                    provider,
                    COUNT(*),
                    COALESCE(SUM(input_tokens), 0),
                    COALESCE(SUM(output_tokens), 0),
                    COALESCE(SUM(total_tokens), 0),
                    COALESCE(SUM(estimated_cost_usd), 0.0)
                 FROM ai_usage
                 GROUP BY provider
                 ORDER BY estimated_cost_usd DESC, total_tokens DESC, provider ASC",
            )
            .context("Failed to prepare ai_usage totals by provider statement")?;

        let rows = stmt
            .query_map([], |row| {
                Ok(AiUsageProviderTotals {
                    provider: row.get(0)?,
                    request_count: row.get(1)?,
                    input_tokens: row.get(2)?,
                    output_tokens: row.get(3)?,
                    total_tokens: row.get(4)?,
                    estimated_cost_usd: row.get(5)?,
                })
            })
            .context("Failed to query ai_usage totals by provider")?
            .collect::<rusqlite::Result<Vec<_>>>()
            .context("Failed to collect ai_usage totals by provider")?;

        Ok(rows)
    }
}

fn map_ai_usage_row(row: &Row<'_>) -> rusqlite::Result<AiUsageRow> {
    Ok(AiUsageRow {
        id: row.get(0)?,
        provider: row.get(1)?,
        model: row.get(2)?,
        source: row.get(3)?,
        input_tokens: row.get(4)?,
        output_tokens: row.get(5)?,
        total_tokens: row.get(6)?,
        estimated_cost_usd: row.get(7)?,
        estimated: row.get::<_, i32>(8)? != 0,
        created_at: row.get(9)?,
    })
}
