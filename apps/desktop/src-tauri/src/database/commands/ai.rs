use tauri::State;
use uuid::Uuid;

use crate::{
    database::{
        services::ai::{
            AIProvider, AIRequest, AIResponse, AIService, AiStreamEvent, ColumnContext,
            ForeignKeyContext, GroqClient, GroqStatus, OllamaClient, SchemaContext, TableContext,
        },
        types::DatabaseSchema,
    },
    error::Error,
    AppState,
};

fn build_schema_context(schema: &DatabaseSchema, engine: &str) -> SchemaContext {
    let tables = schema
        .tables
        .iter()
        .map(|t| TableContext {
            name: t.name.clone(),
            schema: t.schema.clone(),
            columns: t
                .columns
                .iter()
                .map(|c| ColumnContext {
                    name: c.name.clone(),
                    data_type: c.data_type.clone(),
                    is_nullable: c.is_nullable,
                    is_primary_key: c.is_primary_key,
                    is_auto_increment: c.is_auto_increment,
                })
                .collect(),
            primary_keys: t.primary_key_columns.clone(),
            foreign_keys: t
                .columns
                .iter()
                .filter_map(|c| {
                    c.foreign_key.as_ref().map(|fk| ForeignKeyContext {
                        column: c.name.clone(),
                        referenced_table: fk.referenced_table.clone(),
                        referenced_column: fk.referenced_column.clone(),
                        referenced_schema: fk.referenced_schema.clone(),
                    })
                })
                .collect(),
            row_count_estimate: t.row_count_estimate,
        })
        .collect();

    SchemaContext {
        engine: engine.to_string(),
        tables,
    }
}

fn engine_for_connection(state: &AppState, conn_id: Uuid) -> String {
    use crate::database::types::Database;
    state
        .connections
        .get(&conn_id)
        .map(|entry| match entry.value().database {
            Database::Postgres { .. } => "postgres",
            Database::MySQL { .. } => "mysql",
            Database::SQLite { .. } => "sqlite",
            Database::LibSQL { .. } => "libsql",
        })
        .unwrap_or("sql")
        .to_string()
}

#[tauri::command]
#[specta::specta]
pub async fn ai_complete(
    prompt: String,
    connection_id: Option<Uuid>,
    max_tokens: Option<u32>,
    state: State<'_, AppState>,
) -> Result<AIResponse, Error> {
    let context = if let Some(conn_id) = connection_id {
        state.schemas.get(&conn_id).map(|schema| {
            let engine = engine_for_connection(&state, conn_id);
            build_schema_context(&schema, &engine)
        })
    } else {
        None
    };

    let request = AIRequest {
        prompt,
        context,
        connection_id,
        max_tokens,
    };

    let svc = AIService {
        storage: &state.storage,
    };
    svc.complete(request).await
}

#[tauri::command]
#[specta::specta]
pub async fn ai_complete_stream(
    prompt: String,
    connection_id: Option<Uuid>,
    max_tokens: Option<u32>,
    on_event: tauri::ipc::Channel<AiStreamEvent>,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    let context = if let Some(conn_id) = connection_id {
        state.schemas.get(&conn_id).map(|schema| {
            let engine = engine_for_connection(&state, conn_id);
            build_schema_context(&schema, &engine)
        })
    } else {
        None
    };

    let request = AIRequest {
        prompt,
        context,
        connection_id,
        max_tokens,
    };

    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<AiStreamEvent>();

    // Forward internal channel to Tauri IPC channel
    let forward_handle = tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            let _ = on_event.send(event);
        }
    });

    let svc = AIService {
        storage: &state.storage,
    };
    let result = svc.complete_stream(request, tx).await;

    // Wait for forwarder to drain
    let _ = forward_handle.await;

    if let Err(ref e) = result {
        // Best-effort: errors are surfaced through the command return value,
        // not through the channel (which has already been dropped).
        tracing::warn!("ai_complete_stream error: {}", e);
    }

    result
}

#[tauri::command]
#[specta::specta]
pub async fn ai_set_provider(provider: String, state: State<'_, AppState>) -> Result<(), Error> {
    let ai_provider = match provider.to_lowercase().as_str() {
        "groq" => AIProvider::Groq,
        "gemini" => AIProvider::Gemini,
        "ollama" => AIProvider::Ollama,
        _ => return Err(Error::Any(anyhow::anyhow!("Invalid provider: {}", provider))),
    };

    let svc = AIService {
        storage: &state.storage,
    };
    svc.set_provider(ai_provider)
}

#[tauri::command]
#[specta::specta]
pub async fn ai_get_provider(state: State<'_, AppState>) -> Result<String, Error> {
    let svc = AIService {
        storage: &state.storage,
    };
    let provider = svc.get_provider()?;
    Ok(match provider {
        AIProvider::Groq => "groq".to_string(),
        AIProvider::Gemini => "gemini".to_string(),
        AIProvider::Ollama => "ollama".to_string(),
    })
}

#[tauri::command]
#[specta::specta]
pub async fn ai_set_gemini_key(api_key: String, state: State<'_, AppState>) -> Result<(), Error> {
    state.storage.set_setting("gemini_api_key", &api_key)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn ai_configure_ollama(
    endpoint: Option<String>,
    model: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    if let Some(ep) = endpoint {
        state.storage.set_setting("ollama_endpoint", &ep)?;
    }
    if let Some(m) = model {
        state.storage.set_setting("ollama_model", &m)?;
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn ai_list_ollama_models(state: State<'_, AppState>) -> Result<Vec<String>, Error> {
    let endpoint = state
        .storage
        .get_setting("ollama_endpoint")?
        .unwrap_or_else(|| "http://localhost:11434".to_string());

    let client = OllamaClient::new(endpoint, String::new());
    client.list_models().await
}

/// Check whether Groq provider is usable (env keys present).
/// Returns key count detected. Never exposes the key values.
#[tauri::command]
#[specta::specta]
pub async fn ai_groq_status() -> Result<GroqStatus, Error> {
    match GroqClient::from_env() {
        Ok(client) => Ok(GroqStatus {
            available: true,
            key_count: client.key_count(),
        }),
        Err(_) => Ok(GroqStatus {
            available: false,
            key_count: 0,
        }),
    }
}
