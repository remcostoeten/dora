//! Query execution for libSQL databases
//!
//! This module handles executing SQL statements against libSQL/Turso databases.

use std::sync::Arc;
use std::time::Instant;

use serde_json::value::RawValue;

use crate::{
    database::{
        parser::ParsedStatement,
        types::{ExecSender, Page, QueryExecEvent},
    },
    Error,
};

const PAGE_SIZE: usize = 500;

/// Execute a parsed statement on a libSQL connection
pub async fn execute_query(
    conn: &Arc<libsql::Connection>,
    stmt: ParsedStatement,
    sender: &ExecSender,
) -> Result<(), Error> {
    let start = Instant::now();

    if stmt.returns_values {
        execute_query_with_results(conn, stmt, sender, start).await
    } else {
        execute_modification_query(conn, stmt, sender, start).await
    }
}

/// Execute a query that returns results (SELECT, etc.)
async fn execute_query_with_results(
    conn: &Arc<libsql::Connection>,
    stmt: ParsedStatement,
    sender: &ExecSender,
    start: Instant,
) -> Result<(), Error> {
    let mut rows = conn
        .query(&stmt.statement, ())
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("LibSQL query failed: {}", e)))?;

    // Get column names
    let column_count = rows.column_count();
    let mut column_names = Vec::with_capacity(column_count as usize);
    for i in 0..column_count {
        let name = rows.column_name(i as i32).unwrap_or("?");
        column_names.push(name.to_string());
    }

    // Send column types
    let columns_json = serde_json::to_string(&column_names)?;
    let columns_raw = RawValue::from_string(columns_json)?;
    sender.send(QueryExecEvent::TypesResolved {
        columns: columns_raw,
    })?;

    // Collect rows into pages
    let mut current_page: Vec<Vec<serde_json::Value>> = Vec::with_capacity(PAGE_SIZE);
    let mut page_count = 0;

    while let Some(row) = rows
        .next()
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("LibSQL row fetch failed: {}", e)))?
    {
        let mut row_data = Vec::with_capacity(column_count as usize);

        for i in 0..column_count {
            let value = row_to_json_value(&row, i as i32)?;
            row_data.push(value);
        }

        current_page.push(row_data);

        if current_page.len() >= PAGE_SIZE {
            send_page(sender, &current_page, page_count)?;
            page_count += 1;
            current_page.clear();
        }
    }

    // Send remaining rows
    if !current_page.is_empty() {
        send_page(sender, &current_page, page_count)?;
    }

    let elapsed_ms = start.elapsed().as_millis() as u64;
    sender.send(QueryExecEvent::Finished {
        elapsed_ms,
        affected_rows: 0,
        error: None,
    })?;

    Ok(())
}

/// Execute a modification query (INSERT, UPDATE, DELETE, etc.)
async fn execute_modification_query(
    conn: &Arc<libsql::Connection>,
    stmt: ParsedStatement,
    sender: &ExecSender,
    start: Instant,
) -> Result<(), Error> {
    let affected_rows = conn
        .execute(&stmt.statement, ())
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("LibSQL execute failed: {}", e)))?;

    let elapsed_ms = start.elapsed().as_millis() as u64;
    sender.send(QueryExecEvent::Finished {
        elapsed_ms,
        affected_rows: affected_rows as usize,
        error: None,
    })?;

    Ok(())
}

/// Convert a libSQL row value to JSON
fn row_to_json_value(row: &libsql::Row, idx: i32) -> Result<serde_json::Value, Error> {
    use libsql::Value;

    let value = row.get_value(idx).map_err(|e| {
        Error::Any(anyhow::anyhow!(
            "Failed to get value at index {}: {}",
            idx,
            e
        ))
    })?;

    Ok(match value {
        Value::Null => serde_json::Value::Null,
        Value::Integer(i) => serde_json::Value::from(i),
        Value::Real(f) => serde_json::Value::from(f),
        Value::Text(s) => serde_json::Value::from(s),
        Value::Blob(b) => {
            use base64::Engine;
            serde_json::Value::from(base64::engine::general_purpose::STANDARD.encode(&b))
        }
    })
}

/// Send a page of results
fn send_page(
    sender: &ExecSender,
    rows: &[Vec<serde_json::Value>],
    page_index: usize,
) -> Result<(), Error> {
    let page_json = serde_json::to_string(rows)?;
    let page: Page = RawValue::from_string(page_json)?;

    sender.send(QueryExecEvent::Page {
        page_amount: page_index + 1,
        page,
    })?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::types::channel;

    #[tokio::test]
    async fn test_basic_query() {
        let db = libsql::Builder::new_local(":memory:")
            .build()
            .await
            .unwrap();
        let conn = Arc::new(db.connect().unwrap());

        // Create table
        conn.execute("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)", ())
            .await
            .unwrap();
        conn.execute("INSERT INTO test (id, name) VALUES (1, 'Alice')", ())
            .await
            .unwrap();

        let (sender, mut receiver) = channel();
        let stmt = ParsedStatement {
            statement: "SELECT * FROM test".to_string(),
            returns_values: true,
            is_read_only: true,
        };

        execute_query(&conn, stmt, &sender).await.unwrap();

        // Should receive TypesResolved, Page, and Finished
        let event1 = receiver.recv().await.unwrap();
        assert!(matches!(event1, QueryExecEvent::TypesResolved { .. }));

        let event2 = receiver.recv().await.unwrap();
        assert!(matches!(event2, QueryExecEvent::Page { .. }));

        let event3 = receiver.recv().await.unwrap();
        assert!(matches!(
            event3,
            QueryExecEvent::Finished { error: None, .. }
        ));
    }
}
