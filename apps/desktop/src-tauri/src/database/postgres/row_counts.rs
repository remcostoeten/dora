use anyhow::Context;
use tokio_postgres::Client;

use crate::database::ident::quote_ansi as quote_identifier;
use crate::Error;

/// Batch size for the UNION ALL count query. Keeps a single statement from
/// growing unbounded on schemas with hundreds of never-analyzed tables.
const ROW_COUNT_BATCH_SIZE: usize = 50;

/// Exact `COUNT(*)` for the given `(schema, table)` pairs, batched into as few
/// round-trips as possible. Issuing one query per table serializes a network
/// RTT per table, which costs seconds against a remote database (Neon,
/// Supabase, RDS). Returns counts positionally, `None` where the count could
/// not be read. Runs on the background row-count refresher, never on the
/// introspection critical path.
pub(crate) async fn exact_row_counts(
    client: &Client,
    tables: &[(String, String)],
) -> Result<Vec<Option<u64>>, Error> {
    let mut counts: Vec<Option<u64>> = Vec::with_capacity(tables.len());

    for batch in tables.chunks(ROW_COUNT_BATCH_SIZE) {
        let selects: Vec<String> = batch
            .iter()
            .enumerate()
            .map(|(index, (schema, table))| {
                format!(
                    "SELECT {} AS idx, COUNT(*)::text AS count FROM {}.{}",
                    index,
                    quote_identifier(schema),
                    quote_identifier(table)
                )
            })
            .collect();

        let query = selects.join(" UNION ALL ");
        let messages = match client.simple_query(&query).await {
            Ok(messages) => messages,
            // One unreadable relation fails the whole batch, so fall back to
            // counting this batch table-by-table and keep what we can get.
            Err(err) => {
                log::debug!("Batched row count failed, falling back per table: {}", err);
                for (schema, table) in batch {
                    counts.push(exact_row_count(client, schema, table).await.ok());
                }
                continue;
            }
        };

        let mut batch_counts: Vec<Option<u64>> = vec![None; batch.len()];
        for message in messages {
            if let tokio_postgres::SimpleQueryMessage::Row(row) = message {
                let index = match row.try_get("idx")?.and_then(|v| v.parse::<usize>().ok()) {
                    Some(index) if index < batch_counts.len() => index,
                    _ => continue,
                };
                batch_counts[index] = row.try_get("count")?.and_then(|v| v.parse::<u64>().ok());
            }
        }

        counts.extend(batch_counts);
    }

    Ok(counts)
}

async fn exact_row_count(client: &Client, schema: &str, table: &str) -> Result<u64, Error> {
    let query = format!(
        "SELECT COUNT(*)::text AS count FROM {}.{}",
        quote_identifier(schema),
        quote_identifier(table)
    );

    let rows = client
        .simple_query(&query)
        .await
        .context("Failed to query exact row count")?;

    for message in rows {
        if let tokio_postgres::SimpleQueryMessage::Row(row) = message {
            let count = row
                .try_get("count")?
                .unwrap_or("0")
                .parse::<u64>()
                .context("Failed to parse exact row count")?;
            return Ok(count);
        }
    }

    Ok(0)
}
