use std::sync::Arc;
use std::time::Instant;

use futures_util::TryStreamExt;
use mysql_async::prelude::Queryable;
use mysql_async::{Pool, Row, Value as MysqlValue};
use serde_json::value::RawValue;

use crate::{
    database::{
        parser::ParsedStatement,
        types::{ExecSender, Page, QueryExecEvent},
    },
    Error,
};

const PAGE_SIZE: usize = 500;

pub async fn execute_query(pool: &Arc<Pool>, stmt: ParsedStatement, sender: &ExecSender) -> Result<(), Error> {
    let start = Instant::now();

    if stmt.returns_values {
        execute_query_with_results(pool, stmt, sender, start).await
    } else {
        execute_modification_query(pool, stmt, sender, start).await
    }
}

async fn execute_query_with_results(
    pool: &Arc<Pool>,
    stmt: ParsedStatement,
    sender: &ExecSender,
    start: Instant,
) -> Result<(), Error> {
    let mut conn = pool
        .get_conn()
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("MySQL connect failed: {}", e)))?;

    let mut result = conn
        .query_iter(stmt.statement.clone())
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("MySQL query failed: {}", e)))?;

    let column_names: Vec<String> = result
        .columns_ref()
        .iter()
        .map(|c| c.name_str().to_string())
        .collect();

    let columns_json = serde_json::to_string(&column_names)?;
    let columns_raw = RawValue::from_string(columns_json)?;
    sender.send(QueryExecEvent::TypesResolved { columns: columns_raw })?;

    let mut current_page: Vec<Vec<serde_json::Value>> = Vec::with_capacity(PAGE_SIZE);
    let mut page_count = 0;

    let stream_opt = result
        .stream::<Row>()
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("MySQL stream setup failed: {}", e)))?;

    let Some(mut stream) = stream_opt else {
        let elapsed_ms = start.elapsed().as_millis() as u64;
        sender.send(QueryExecEvent::Finished {
            elapsed_ms,
            affected_rows: 0,
            error: None,
        })?;
        return Ok(());
    };

    while let Some(row) = stream
        .try_next()
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("MySQL row fetch failed: {}", e)))?
    {
        let mut row_data = Vec::with_capacity(column_names.len());
        for value in row.unwrap().into_iter() {
            row_data.push(mysql_value_to_json(value));
        }
        current_page.push(row_data);

        if current_page.len() >= PAGE_SIZE {
            send_page(sender, &current_page, page_count)?;
            page_count += 1;
            current_page.clear();
        }
    }

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

async fn execute_modification_query(
    pool: &Arc<Pool>,
    stmt: ParsedStatement,
    sender: &ExecSender,
    start: Instant,
) -> Result<(), Error> {
    let mut conn = pool
        .get_conn()
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("MySQL connect failed: {}", e)))?;

    let result = conn
        .query_iter(stmt.statement)
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("MySQL execute failed: {}", e)))?;

    let affected = result.affected_rows() as usize;
    result
        .drop_result()
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("MySQL result drop failed: {}", e)))?;
    let elapsed_ms = start.elapsed().as_millis() as u64;

    sender.send(QueryExecEvent::Finished {
        elapsed_ms,
        affected_rows: affected,
        error: None,
    })?;

    Ok(())
}

fn mysql_value_to_json(value: MysqlValue) -> serde_json::Value {
    match value {
        MysqlValue::NULL => serde_json::Value::Null,
        MysqlValue::Bytes(bytes) => match String::from_utf8(bytes) {
            Ok(s) => serde_json::Value::from(s),
            Err(e) => serde_json::Value::from(e.into_bytes()),
        },
        MysqlValue::Int(i) => serde_json::Value::from(i),
        MysqlValue::UInt(u) => serde_json::Value::from(u),
        MysqlValue::Float(f) => serde_json::Value::from(f),
        MysqlValue::Double(d) => serde_json::Value::from(d),
        MysqlValue::Date(y, m, d, hh, mm, ss, micros) => serde_json::Value::from(format!(
            "{:04}-{:02}-{:02} {:02}:{:02}:{:02}.{:06}",
            y, m, d, hh, mm, ss, micros
        )),
        MysqlValue::Time(neg, days, hours, minutes, seconds, micros) => {
            serde_json::Value::from(format!(
                "{}{} {:02}:{:02}:{:02}.{:06}",
                if neg { "-" } else { "" },
                days,
                hours,
                minutes,
                seconds,
                micros
            ))
        }
    }
}

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
