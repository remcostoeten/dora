//! Serving side of the DuckDB helper transport.
//!
//! Runs inside the helper process: owns the real DuckDB connections and answers
//! framed [`Request`]s from the main app over stdin/stdout. Each request is
//! handled on its own task so a long streaming query never blocks unrelated
//! work; all responses share one stdout guarded by a mutex (framing is atomic
//! per frame). Today it drives [`InProcessDuckDbConn`] — the exact in-process
//! engine code — so there are no behavioural differences from running it in the
//! main process.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use dashmap::DashMap;
use tokio::io::{stdin, stdout, BufReader, Stdout};
use tokio::sync::Mutex;

use crate::database::{
    duckdb_backend::{open_in_process, BoxedDuckDbConn},
    types::{self, QueryExecEvent},
};

use super::framing::{read_frame, write_frame};
use super::proto::{
    ConnId, Request, RequestFrame, RespPayload, ResponseFrame, ResponseMsg, WireError,
};

struct HelperState {
    conns: DashMap<ConnId, BoxedDuckDbConn>,
    next_id: AtomicU64,
}

type SharedOut = Arc<Mutex<Stdout>>;

/// Entry point for the helper binary. Reads framed requests from stdin until
/// the parent closes the pipe, then returns.
pub async fn run() {
    let state = Arc::new(HelperState {
        conns: DashMap::new(),
        next_id: AtomicU64::new(1),
    });
    let out: SharedOut = Arc::new(Mutex::new(stdout()));
    let mut reader = BufReader::new(stdin());

    loop {
        match read_frame::<_, RequestFrame>(&mut reader).await {
            Ok(Some(frame)) => {
                let state = state.clone();
                let out = out.clone();
                tokio::spawn(async move {
                    handle(frame, state, out).await;
                });
            }
            Ok(None) => break,
            Err(e) => {
                eprintln!("duckdb-helper: stdin read error: {e}");
                break;
            }
        }
    }
}

async fn send_done(out: &SharedOut, id: u64, payload: Result<RespPayload, WireError>) {
    let frame = ResponseFrame {
        id,
        msg: ResponseMsg::Done(payload),
    };
    let mut guard = out.lock().await;
    if let Err(e) = write_frame(&mut *guard, &frame).await {
        eprintln!("duckdb-helper: stdout write error: {e}");
    }
}

async fn send_event(out: &SharedOut, id: u64, ev: QueryExecEvent) {
    let frame = ResponseFrame {
        id,
        msg: ResponseMsg::Event(ev.into()),
    };
    let mut guard = out.lock().await;
    if let Err(e) = write_frame(&mut *guard, &frame).await {
        eprintln!("duckdb-helper: stdout write error: {e}");
    }
}

fn lookup(state: &HelperState, conn_id: ConnId) -> Result<BoxedDuckDbConn, WireError> {
    state
        .conns
        .get(&conn_id)
        .map(|c| c.clone())
        .ok_or_else(|| WireError {
            message: format!("unknown DuckDB connection id {conn_id}"),
        })
}

async fn handle(frame: RequestFrame, state: Arc<HelperState>, out: SharedOut) {
    let id = frame.id;

    if let Request::ExecuteQuery { conn_id, stmt } = frame.req {
        let conn = match lookup(&state, conn_id) {
            Ok(c) => c,
            Err(e) => return send_done(&out, id, Err(e)).await,
        };
        let (tx, mut rx) = types::channel();
        let exec = async move {
            let r = conn.execute_query(stmt, &tx).await;
            drop(tx);
            r
        };
        let drain = async {
            while let Some(ev) = rx.recv().await {
                send_event(&out, id, ev).await;
            }
        };
        let (res, ()) = tokio::join!(exec, drain);
        let done = res
            .map(|_| RespPayload::Unit)
            .map_err(|e| WireError::from(&e));
        send_done(&out, id, done).await;
        return;
    }

    let payload = dispatch(frame.req, &state).await;
    send_done(&out, id, payload).await;
}

/// Handle every non-streaming request, producing its terminal payload.
async fn dispatch(req: Request, state: &HelperState) -> Result<RespPayload, WireError> {
    match req {
        Request::Open {
            db_path,
            file_sources,
        } => {
            let (handle, entries) =
                open_in_process(&db_path, &file_sources).map_err(|e| WireError::from(&e))?;
            let conn_id = state.next_id.fetch_add(1, Ordering::Relaxed);
            state.conns.insert(conn_id, handle);
            Ok(RespPayload::Opened { conn_id, entries })
        }
        Request::Close { conn_id } => {
            state.conns.remove(&conn_id);
            Ok(RespPayload::Unit)
        }
        Request::ExecuteQuery { .. } => unreachable!("streaming handled in handle()"),
        Request::GetSchema { conn_id } => {
            let conn = lookup(state, conn_id)?;
            conn.get_schema()
                .await
                .map(RespPayload::Schema)
                .map_err(wire)
        }
        Request::IsConnected { conn_id } => {
            let connected = state
                .conns
                .get(&conn_id)
                .map(|c| c.is_connected())
                .unwrap_or(false);
            Ok(RespPayload::Bool(connected))
        }
        Request::QueryRaw { conn_id, sql } => {
            let conn = lookup(state, conn_id)?;
            conn.query_raw(sql)
                .await
                .map(|(columns, rows)| RespPayload::QueryRaw { columns, rows })
                .map_err(wire)
        }
        Request::ExecRaw { conn_id, sql } => {
            let conn = lookup(state, conn_id)?;
            conn.execute_raw(sql)
                .await
                .map(|affected| RespPayload::ExecRaw { affected })
                .map_err(wire)
        }
        Request::InsertRow {
            conn_id,
            table,
            schema,
            row_data,
        } => {
            let conn = lookup(state, conn_id)?;
            conn.insert_row(table, schema, row_data)
                .await
                .map(RespPayload::Mutation)
                .map_err(wire)
        }
        Request::UpdateCell {
            conn_id,
            table,
            schema,
            pk_column,
            pk_value,
            column,
            new_value,
        } => {
            let conn = lookup(state, conn_id)?;
            conn.update_cell(table, schema, pk_column, pk_value, column, new_value)
                .await
                .map(RespPayload::Mutation)
                .map_err(wire)
        }
        Request::DeleteRows {
            conn_id,
            table,
            schema,
            pk_column,
            pk_values,
        } => {
            let conn = lookup(state, conn_id)?;
            conn.delete_rows(table, schema, pk_column, pk_values)
                .await
                .map(RespPayload::Mutation)
                .map_err(wire)
        }
        Request::DuplicateRow {
            conn_id,
            table,
            schema,
            pk_column,
            pk_value,
        } => {
            let conn = lookup(state, conn_id)?;
            conn.duplicate_row(table, schema, pk_column, pk_value)
                .await
                .map(RespPayload::Mutation)
                .map_err(wire)
        }
        Request::TruncateTable {
            conn_id,
            table,
            schema,
            cascade,
        } => {
            let conn = lookup(state, conn_id)?;
            conn.truncate_table(table, schema, cascade)
                .await
                .map(RespPayload::Truncate)
                .map_err(wire)
        }
        Request::TruncateDatabase {
            conn_id,
            schema,
            confirm,
        } => {
            let conn = lookup(state, conn_id)?;
            conn.truncate_database(schema, confirm)
                .await
                .map(RespPayload::Truncate)
                .map_err(wire)
        }
        Request::SoftDeleteRows {
            conn_id,
            table,
            schema,
            pk_column,
            pk_values,
            soft_delete_column,
        } => {
            let conn = lookup(state, conn_id)?;
            conn.soft_delete_rows(table, schema, pk_column, pk_values, soft_delete_column)
                .await
                .map(RespPayload::SoftDelete)
                .map_err(wire)
        }
        Request::UndoSoftDelete {
            conn_id,
            table,
            schema,
            pk_column,
            pk_values,
            soft_delete_column,
        } => {
            let conn = lookup(state, conn_id)?;
            conn.undo_soft_delete(table, schema, pk_column, pk_values, soft_delete_column)
                .await
                .map(RespPayload::Mutation)
                .map_err(wire)
        }
        Request::DumpDatabase {
            conn_id,
            output_path,
        } => {
            let conn = lookup(state, conn_id)?;
            conn.dump_database(output_path)
                .await
                .map(RespPayload::Dump)
                .map_err(wire)
        }
        Request::ExecuteBatch {
            conn_id,
            statements,
        } => {
            let conn = lookup(state, conn_id)?;
            conn.execute_batch(statements)
                .await
                .map(RespPayload::Mutation)
                .map_err(wire)
        }
        Request::GetBlobBytes {
            conn_id,
            table,
            schema,
            pk_column,
            pk_value,
            column,
        } => {
            let conn = lookup(state, conn_id)?;
            conn.get_blob_bytes(table, schema, pk_column, pk_value, column)
                .await
                .map(RespPayload::Blob)
                .map_err(wire)
        }
        Request::PollTableHash {
            conn_id,
            table,
            schema,
        } => {
            let conn = lookup(state, conn_id)?;
            conn.poll_table_hash(table, schema)
                .await
                .map(RespPayload::Hash)
                .map_err(wire)
        }
        Request::GetCounts { conn_id } => {
            let conn = lookup(state, conn_id)?;
            conn.get_counts()
                .await
                .map(|(tables, rows)| RespPayload::Counts { tables, rows })
                .map_err(wire)
        }
        Request::RegisterSources { conn_id, sources } => {
            let conn = lookup(state, conn_id)?;
            conn.register_sources(sources)
                .await
                .map(RespPayload::Sources)
                .map_err(wire)
        }
        Request::ImportFiles {
            conn_id,
            file_paths,
        } => {
            let conn = lookup(state, conn_id)?;
            conn.import_files(file_paths)
                .await
                .map(RespPayload::Import)
                .map_err(wire)
        }
        Request::MaterializeDataFileSession {
            conn_id,
            entries,
            destination_path,
            overwrite,
        } => {
            let conn = lookup(state, conn_id)?;
            conn.materialize_data_file_session(entries, destination_path, overwrite)
                .await
                .map(RespPayload::Materialize)
                .map_err(wire)
        }
    }
}

fn wire(e: crate::Error) -> WireError {
    WireError::from(&e)
}
