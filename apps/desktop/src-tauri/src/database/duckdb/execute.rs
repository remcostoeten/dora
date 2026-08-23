use std::time::Instant;

use duckdb::Connection;

use crate::{
    database::{
        duckdb::row_writer::RowWriter, parser::ParsedStatement, types::ExecSender, QueryExecEvent,
    },
    utils::serialize_as_json_array,
    Error,
};

/// Make sure to run this on a task where blocking is allowed.
pub fn execute_query(
    client: &Connection,
    stmt: ParsedStatement,
    sender: &ExecSender,
) -> Result<(), Error> {
    let start = std::time::Instant::now();

    if stmt.returns_values {
        execute_query_with_results(client, &stmt.statement, sender, start)?;
    } else {
        execute_modification_query(client, &stmt.statement, sender, start)?;
    }

    Ok(())
}

fn execute_query_with_results(
    client: &Connection,
    query: &str,
    sender: &ExecSender,
    started_at: Instant,
) -> Result<(), Error> {
    log::info!("Starting DuckDB query: {}", query);

    let mut stmt = match client.prepare(query) {
        Ok(stmt) => stmt,
        Err(e) => {
            log::error!("DuckDB statement preparation failed: {:?}", e);
            let error_msg = format!("Query failed: {}", e);

            sender.send(QueryExecEvent::Finished {
                elapsed_ms: started_at.elapsed().as_millis() as u64,
                affected_rows: 0,
                error: Some(error_msg.clone()),
            })?;

            return Err(Error::Any(anyhow::anyhow!(error_msg)));
        }
    };

    let mut rows = match stmt.query([]) {
        Ok(rows) => rows,
        Err(e) => {
            log::error!("DuckDB query execution failed: {:?}", e);
            let error_msg = format!("Query failed: {}", e);

            sender.send(QueryExecEvent::Finished {
                elapsed_ms: started_at.elapsed().as_millis() as u64,
                affected_rows: 0,
                error: Some(error_msg.clone()),
            })?;

            return Err(Error::Any(anyhow::anyhow!(error_msg)));
        }
    };

    // DuckDB exposes column metadata only after execution, hence post-`query`.
    let (column_names, column_count) = {
        let stmt_ref = rows
            .as_ref()
            .ok_or_else(|| Error::Any(anyhow::anyhow!("DuckDB statement unavailable")))?;
        (stmt_ref.column_names(), stmt_ref.column_count())
    };
    let columns = serialize_as_json_array(column_names.iter().map(String::as_str))?;
    sender.send(QueryExecEvent::TypesResolved { columns })?;

    let mut total_rows = 0;
    let batch_size = 500;
    let mut writer = RowWriter::new(column_count);

    loop {
        match rows.next() {
            Ok(Some(row)) => {
                writer.add_row(row)?;
                total_rows += 1;

                if writer.len() >= batch_size {
                    sender.send(QueryExecEvent::Page {
                        page_amount: writer.len(),
                        page: writer.finish(),
                    })?;
                }
            }
            Ok(None) => break,
            Err(e) => {
                log::error!("Error processing DuckDB row: {}", e);
                let error_msg = format!("Query failed: {}", e);

                sender.send(QueryExecEvent::Finished {
                    elapsed_ms: started_at.elapsed().as_millis() as u64,
                    affected_rows: 0,
                    error: Some(error_msg),
                })?;

                return Ok(());
            }
        }
    }

    if !writer.is_empty() {
        sender.send(QueryExecEvent::Page {
            page_amount: writer.len(),
            page: writer.finish(),
        })?;
    }

    let duration = started_at.elapsed().as_millis() as u64;
    log::info!(
        "DuckDB query completed: {} rows in {}ms",
        total_rows,
        duration
    );

    sender.send(QueryExecEvent::Finished {
        elapsed_ms: duration,
        affected_rows: 0,
        error: None,
    })?;

    Ok(())
}

fn execute_modification_query(
    client: &Connection,
    query: &str,
    sender: &ExecSender,
    started_at: Instant,
) -> Result<(), Error> {
    log::info!("Executing DuckDB modification query: {}", query);

    match client.execute(query, []) {
        Ok(rows_affected) => {
            sender.send(QueryExecEvent::Finished {
                elapsed_ms: started_at.elapsed().as_millis() as u64,
                affected_rows: rows_affected,
                error: None,
            })?;
            Ok(())
        }
        Err(e) => {
            log::error!("DuckDB modification query failed: {:?}", e);
            let error_msg = format!("Query failed: {}", e);

            sender.send(QueryExecEvent::Finished {
                elapsed_ms: started_at.elapsed().as_millis() as u64,
                affected_rows: 0,
                error: Some(error_msg.clone()),
            })?;

            Err(Error::Any(anyhow::anyhow!(error_msg)))
        }
    }
}

#[cfg(test)]
mod tests {
    use std::ops::Not;
    use std::sync::{Arc, Mutex};

    use duckdb::Connection;

    use super::execute_query;
    use crate::database::{duckdb::parser::parse_statements, types::channel, QueryExecEvent};

    async fn run_query(
        conn: Arc<Mutex<Connection>>,
        query: &str,
    ) -> anyhow::Result<Vec<QueryExecEvent>> {
        let mut parsed_stmt = parse_statements(query).unwrap();
        assert_eq!(parsed_stmt.len(), 1);
        assert!(parsed_stmt[0].returns_values);
        let stmt = parsed_stmt.pop().unwrap();

        let (sender, mut recv) = channel();

        tokio::task::spawn_blocking(move || {
            let conn = conn.lock().unwrap();
            execute_query(&conn, stmt, &sender).unwrap();
        });

        let mut events = Vec::new();
        while let Some(event) = recv.recv().await {
            events.push(event);
        }

        Ok(events)
    }

    async fn run_modification_query(
        conn: Arc<Mutex<Connection>>,
        query: &str,
    ) -> anyhow::Result<usize> {
        let mut parsed_stmt = parse_statements(query).unwrap();
        assert_eq!(parsed_stmt.len(), 1);
        assert!(parsed_stmt[0].returns_values.not());
        let stmt = parsed_stmt.pop().unwrap();

        let (sender, mut recv) = channel();

        tokio::task::spawn_blocking(move || {
            let conn = conn.lock().unwrap();
            execute_query(&conn, stmt, &sender).unwrap();
        });

        let event = recv
            .recv()
            .await
            .ok_or(anyhow::anyhow!("Channel unexpectedly closed"))?;
        match event {
            QueryExecEvent::Finished {
                affected_rows,
                error,
                ..
            } => {
                assert!(error.is_none());
                Ok(affected_rows)
            }
            other => Err(anyhow::anyhow!("Expected Finished event, got {:?}", other)),
        }
    }

    #[tokio::test]
    async fn test_mixed_queries() -> anyhow::Result<()> {
        let conn = Connection::open_in_memory().unwrap();
        let conn = Arc::new(Mutex::new(conn));

        run_modification_query(
            conn.clone(),
            "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER);",
        )
        .await?;

        let affected = run_modification_query(
            conn.clone(),
            "INSERT INTO users VALUES (1, 'Alice', 25), (2, 'Bob', 30), (3, 'Charlie', 35);",
        )
        .await?;
        assert_eq!(affected, 3);

        let affected = run_modification_query(
            conn.clone(),
            "UPDATE users SET age = age + 1 WHERE name = 'Alice';",
        )
        .await?;
        assert_eq!(affected, 1);

        let affected =
            run_modification_query(conn.clone(), "DELETE FROM users WHERE name = 'Bob';").await?;
        assert_eq!(affected, 1);

        let mut events = run_query(conn.clone(), "SELECT * FROM users ORDER BY id")
            .await?
            .into_iter();

        match events.next().unwrap() {
            QueryExecEvent::TypesResolved { columns } => {
                assert_eq!(
                    serde_json::to_string(&columns).unwrap(),
                    r#"["id","name","age"]"#
                );
            }
            other => return Err(anyhow::anyhow!("Expected TypesResolved, got {:?}", other)),
        }

        match events.next().unwrap() {
            QueryExecEvent::Page { page_amount, page } => {
                assert_eq!(page_amount, 2);
                assert_eq!(
                    serde_json::to_string(&page).unwrap(),
                    r#"[[1,"Alice",26],[3,"Charlie",35]]"#
                );
            }
            other => return Err(anyhow::anyhow!("Expected Page, got {:?}", other)),
        }

        match events.next().unwrap() {
            QueryExecEvent::Finished { error, .. } => assert!(error.is_none()),
            other => return Err(anyhow::anyhow!("Expected Finished, got {:?}", other)),
        }

        Ok(())
    }

    #[tokio::test]
    async fn test_query_with_many_rows() -> anyhow::Result<()> {
        let conn = Connection::open_in_memory().unwrap();
        let conn = Arc::new(Mutex::new(conn));

        let events = run_query(conn.clone(), "SELECT * FROM range(155)").await?;

        let pages: Vec<_> = events
            .iter()
            .filter(|e| matches!(e, QueryExecEvent::Page { .. }))
            .collect();
        assert_eq!(pages.len(), 1, "155 rows should arrive in one page of <=500");

        Ok(())
    }

    #[tokio::test]
    async fn test_error_reporting() -> anyhow::Result<()> {
        let conn = Connection::open_in_memory().unwrap();

        let mut parsed = parse_statements("SELECT * FROM does_not_exist").unwrap();
        let stmt = parsed.pop().unwrap();
        let (sender, mut recv) = channel();

        tokio::task::spawn_blocking(move || {
            let _ = execute_query(&conn, stmt, &sender);
        });

        let event = recv.recv().await.unwrap();
        match event {
            QueryExecEvent::Finished { error, .. } => assert!(error.is_some()),
            other => return Err(anyhow::anyhow!("Expected Finished, got {:?}", other)),
        }

        Ok(())
    }
}
