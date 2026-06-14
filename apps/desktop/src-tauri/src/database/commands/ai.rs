use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use tauri::State;
use uuid::Uuid;

use crate::{
    database::{
        services::ai::{
            record_usage, usage_source, AIProvider, AIRequest, AIResponse, AIService,
            AiModelOption, AiServiceConfig, AiStatus, AiStreamEvent, AiUsageCapture, AiUsageEntry,
            AiUsageProviderSummary, AiUsageSummary, AnthropicClient, ColumnContext,
            ForeignKeyContext, GeminiClient, GroqClient, GroqStatus, IndexContext,
            OllamaCatalogEntry, OllamaClient, OllamaPullEvent, OllamaStatus, OpenAiClient,
            SchemaContext, TableContext,
        },
        types::DatabaseSchema,
    },
    error::Error,
    storage::{AiApiKeyRecord, AiUsageRow},
    AppState,
};

fn map_usage_row(row: AiUsageRow) -> AiUsageEntry {
    AiUsageEntry {
        id: row.id,
        provider: row.provider,
        model: row.model,
        source: row.source,
        input_tokens: row.input_tokens,
        output_tokens: row.output_tokens,
        total_tokens: row.total_tokens,
        estimated_cost_usd: row.estimated_cost_usd,
        estimated: row.estimated,
        created_at: row.created_at,
    }
}

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
            indexes: t
                .indexes
                .iter()
                .map(|index| IndexContext {
                    name: index.name.clone(),
                    column_names: index.column_names.clone(),
                    is_unique: index.is_unique,
                    is_primary: index.is_primary,
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
            Database::Postgres {
                dialect: crate::database::dialect::PgDialect::CockroachDb,
                ..
            } => "cockroach",
            Database::Postgres { .. } => "postgres",
            Database::MySQL {
                dialect: crate::database::dialect::MySqlDialect::MariaDb,
                ..
            } => "mariadb",
            Database::MySQL { .. } => "mysql",
            Database::SQLite { .. } => "sqlite",
            Database::DuckDB { .. } => "duckdb",
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
        prompt_mode: None,
    };

    let svc = AIService {
        storage: &state.storage,
    };
    let config = svc.get_config()?;
    let response = svc.complete(request).await?;
    if let Some(total) = response.tokens_used {
        let capture = AiUsageCapture {
            provider: response.provider.clone(),
            model: config.model,
            source: "complete".to_string(),
            input_tokens: None,
            output_tokens: None,
            total_tokens: Some(total),
            estimated: false,
        };
        let _ = record_usage(&state.storage, capture);
    }
    Ok(response)
}

#[tauri::command]
#[specta::specta]
pub async fn ai_complete_stream(
    request_id: String,
    prompt: String,
    connection_id: Option<Uuid>,
    max_tokens: Option<u32>,
    prompt_mode: Option<String>,
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
        prompt: prompt.clone(),
        context,
        connection_id,
        max_tokens,
        prompt_mode: prompt_mode.clone(),
    };

    let cancel = Arc::new(AtomicBool::new(false));
    state
        .ai_cancel_flags
        .insert(request_id.clone(), cancel.clone());

    let svc = AIService {
        storage: &state.storage,
    };
    let config = svc.get_config()?;
    let provider = config.provider.clone();
    let model = config.model.clone();
    let source = usage_source(prompt_mode.as_deref()).to_string();

    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<AiStreamEvent>();

    let forward_handle = tokio::spawn(async move {
        let mut final_content: Option<String> = None;
        while let Some(event) = rx.recv().await {
            if let AiStreamEvent::Final { content } = &event {
                final_content = Some(content.clone());
            }
            let _ = on_event.send(event);
        }
        final_content
    });

    let result = svc.complete_stream(request, tx, cancel).await;

    let final_content = forward_handle
        .await
        .map_err(|error| Error::Any(anyhow::anyhow!("usage forward task failed: {error}")))?;

    state.ai_cancel_flags.remove(&request_id);

    if result.is_ok() {
        if let Some(content) = final_content {
            let capture =
                AiUsageCapture::estimated_from_text(&provider, &model, &source, &prompt, &content);
            let _ = record_usage(&state.storage, capture);
        }
    } else if let Err(ref error) = result {
        tracing::warn!("ai_complete_stream error: {}", error);
    }

    result
}

#[tauri::command]
#[specta::specta]
pub async fn ai_abort_stream(
    request_id: String,
    state: State<'_, AppState>,
) -> Result<bool, Error> {
    if let Some(flag) = state.ai_cancel_flags.get(&request_id) {
        flag.store(true, Ordering::Relaxed);
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
#[specta::specta]
pub async fn ai_set_provider(provider: String, state: State<'_, AppState>) -> Result<(), Error> {
    let ai_provider = AIProvider::parse(&provider)?;

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
    Ok(svc.get_provider()?.as_str().to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn ai_get_config(state: State<'_, AppState>) -> Result<AiServiceConfig, Error> {
    let svc = AIService {
        storage: &state.storage,
    };
    svc.get_config()
}

#[tauri::command]
#[specta::specta]
pub async fn ai_set_config(
    config: AiServiceConfig,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    let svc = AIService {
        storage: &state.storage,
    };
    svc.set_config(config)
}

#[tauri::command]
#[specta::specta]
pub async fn ai_list_provider_models(
    provider: String,
    state: State<'_, AppState>,
) -> Result<Vec<AiModelOption>, Error> {
    let ai_provider = AIProvider::parse(&provider)?;
    let svc = AIService {
        storage: &state.storage,
    };
    svc.list_provider_models(ai_provider).await
}

#[tauri::command]
#[specta::specta]
pub async fn ai_get_usage_summary(
    limit: Option<u32>,
    state: State<'_, AppState>,
) -> Result<AiUsageSummary, Error> {
    let limit = limit.unwrap_or(25).clamp(1, 200);
    let totals = state
        .storage
        .ai_usage_totals()
        .map_err(|error| Error::Any(error.into()))?;
    let providers = state
        .storage
        .ai_usage_totals_by_provider()
        .map_err(|error| Error::Any(error.into()))?;
    let recent = state
        .storage
        .ai_usage_list(limit)
        .map_err(|error| Error::Any(error.into()))?
        .into_iter()
        .map(map_usage_row)
        .collect();

    Ok(AiUsageSummary {
        total_requests: totals.request_count,
        input_tokens: totals.input_tokens,
        output_tokens: totals.output_tokens,
        total_tokens: totals.total_tokens,
        estimated_cost_usd: totals.estimated_cost_usd,
        providers: providers
            .into_iter()
            .map(|entry| AiUsageProviderSummary {
                provider: entry.provider,
                request_count: entry.request_count,
                input_tokens: entry.input_tokens,
                output_tokens: entry.output_tokens,
                total_tokens: entry.total_tokens,
                estimated_cost_usd: entry.estimated_cost_usd,
            })
            .collect(),
        recent,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn ai_get_status(state: State<'_, AppState>) -> Result<AiStatus, Error> {
    let svc = AIService {
        storage: &state.storage,
    };
    svc.get_status().await
}

#[tauri::command]
#[specta::specta]
pub async fn ai_set_gemini_key(api_key: String, state: State<'_, AppState>) -> Result<(), Error> {
    if api_key.trim().is_empty() {
        return Err(Error::InvalidInput("API key cannot be empty".into()));
    }
    state
        .storage
        .ai_keys_add("gemini", "default", api_key.trim())?;
    let _ = state.storage.delete_setting("gemini_api_key");
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

fn ollama_endpoint(state: &AppState) -> String {
    state
        .storage
        .get_setting("ollama_endpoint")
        .ok()
        .flatten()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "http://127.0.0.1:11434".to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn ai_get_ollama_status(state: State<'_, AppState>) -> Result<OllamaStatus, Error> {
    let endpoint = ollama_endpoint(&state);
    let client = OllamaClient::with_endpoint(endpoint.clone());
    let mut status = client.get_status().await;
    let install = crate::ollama_installer::get_install_status(&endpoint).await;
    status.managed = install.managed;
    status.install_path = install.install_path;
    status.binary_ready = install.binary_ready;
    if status.running && status.version.is_none() {
        status.version = install.version;
    }
    Ok(status)
}

#[tauri::command]
#[specta::specta]
pub async fn ai_list_ollama_catalog(
    state: State<'_, AppState>,
) -> Result<Vec<OllamaCatalogEntry>, Error> {
    let endpoint = ollama_endpoint(&state);
    let client = OllamaClient::with_endpoint(endpoint);
    client.list_catalog().await
}

#[tauri::command]
#[specta::specta]
pub async fn ai_pull_ollama_model(
    request_id: String,
    model: String,
    on_event: tauri::ipc::Channel<OllamaPullEvent>,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    let model = model.trim().to_string();
    if model.is_empty() {
        return Err(Error::InvalidInput("Model name cannot be empty".into()));
    }

    let cancel = Arc::new(AtomicBool::new(false));
    state
        .ollama_cancel_flags
        .insert(request_id.clone(), cancel.clone());

    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<OllamaPullEvent>();
    let forward_handle = tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            let _ = on_event.send(event);
        }
    });

    let endpoint = ollama_endpoint(&state);
    let client = OllamaClient::with_endpoint(endpoint);
    let result = client.pull_model(&model, tx, cancel).await;

    let _ = forward_handle.await;
    state.ollama_cancel_flags.remove(&request_id);

    result
}

#[tauri::command]
#[specta::specta]
pub async fn ai_cancel_ollama_pull(
    request_id: String,
    state: State<'_, AppState>,
) -> Result<bool, Error> {
    if let Some(flag) = state.ollama_cancel_flags.get(&request_id) {
        flag.store(true, Ordering::Relaxed);
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
#[specta::specta]
pub async fn ai_delete_ollama_model(
    model: String,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    let model = model.trim().to_string();
    if model.is_empty() {
        return Err(Error::InvalidInput("Model name cannot be empty".into()));
    }

    let endpoint = ollama_endpoint(&state);
    let client = OllamaClient::with_endpoint(endpoint);
    client.delete_model(&model).await
}

#[tauri::command]
#[specta::specta]
pub async fn ai_list_ollama_models(state: State<'_, AppState>) -> Result<Vec<String>, Error> {
    let endpoint = ollama_endpoint(&state);
    let client = OllamaClient::with_endpoint(endpoint);
    client.list_models().await
}

#[tauri::command]
#[specta::specta]
pub async fn ai_install_ollama(
    request_id: String,
    on_event: tauri::ipc::Channel<crate::ollama_installer::OllamaInstallEvent>,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    let cancel = Arc::new(AtomicBool::new(false));
    state
        .ollama_install_cancel_flags
        .insert(request_id.clone(), cancel.clone());

    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
    let forward = tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            let _ = on_event.send(event);
        }
    });

    let result = crate::ollama_installer::install_managed(tx, cancel).await;
    let _ = forward.await;
    state.ollama_install_cancel_flags.remove(&request_id);
    result
}

#[tauri::command]
#[specta::specta]
pub async fn ai_cancel_ollama_install(
    request_id: String,
    state: State<'_, AppState>,
) -> Result<bool, Error> {
    if let Some(flag) = state.ollama_install_cancel_flags.get(&request_id) {
        flag.store(true, Ordering::Relaxed);
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
#[specta::specta]
pub async fn ai_start_ollama(state: State<'_, AppState>) -> Result<OllamaStatus, Error> {
    crate::ollama_installer::start_managed_server().await?;
    ai_get_ollama_status(state).await
}

/// Check whether Groq provider is usable (env or DB keys present).
/// Returns key count detected. Never exposes the key values.
#[tauri::command]
#[specta::specta]
pub async fn ai_groq_status(state: State<'_, AppState>) -> Result<GroqStatus, Error> {
    match GroqClient::from_env_and_storage(&state.storage) {
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

#[tauri::command]
#[specta::specta]
pub async fn ai_keys_list(
    provider: String,
    state: State<'_, AppState>,
) -> Result<Vec<AiApiKeyRecord>, Error> {
    state.storage.ai_keys_list(&provider)
}

#[tauri::command]
#[specta::specta]
pub async fn ai_keys_add(
    provider: String,
    label: String,
    api_key: String,
    state: State<'_, AppState>,
) -> Result<i64, Error> {
    if api_key.trim().is_empty() {
        return Err(Error::InvalidInput("API key cannot be empty".into()));
    }
    state.storage.ai_keys_add(&provider, &label, api_key.trim())
}

#[tauri::command]
#[specta::specta]
pub async fn ai_keys_delete(id: i64, state: State<'_, AppState>) -> Result<(), Error> {
    state.storage.ai_keys_delete(id)
}

#[tauri::command]
#[specta::specta]
pub async fn ai_keys_set_active(
    id: i64,
    active: bool,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    state.storage.ai_keys_set_active(id, active)
}

#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct AiKeyTestResult {
    pub ok: bool,
    pub message: String,
}

async fn test_ai_key_for_provider(
    provider: &str,
    api_key: &str,
    model: Option<String>,
    prompt: Option<String>,
) -> Result<String, Error> {
    let model_ref = model.as_deref();
    let prompt_ref = prompt.as_deref();
    match provider {
        "groq" => GroqClient::test_key(api_key, model_ref, prompt_ref).await,
        "openai" => OpenAiClient::test_key(api_key, model_ref, prompt_ref).await,
        "anthropic" => AnthropicClient::test_key(api_key, model_ref, prompt_ref).await,
        "gemini" => GeminiClient::test_key(api_key, model_ref, prompt_ref).await,
        other => Err(Error::InvalidInput(format!(
            "Key testing is not supported for provider: {other}"
        ))),
    }
}

async fn test_configured_ai_key_for_provider(
    provider: &str,
    model: Option<String>,
    prompt: Option<String>,
    storage: &crate::storage::Storage,
) -> Result<String, Error> {
    let model_ref = model.as_deref();
    let prompt_ref = prompt.as_deref();
    match provider {
        "groq" => GroqClient::test_configured_key(storage, model_ref, prompt_ref).await,
        "openai" => OpenAiClient::test_configured_key(storage, model_ref, prompt_ref).await,
        "anthropic" => AnthropicClient::test_configured_key(storage, model_ref, prompt_ref).await,
        "gemini" => GeminiClient::test_configured_key(storage, model_ref, prompt_ref).await,
        other => Err(Error::InvalidInput(format!(
            "Key testing is not supported for provider: {other}"
        ))),
    }
}

fn resolve_test_model(
    provider: &str,
    model: Option<String>,
    storage: &crate::storage::Storage,
) -> Result<Option<String>, Error> {
    if let Some(value) = model.filter(|entry| !entry.trim().is_empty()) {
        return Ok(Some(value));
    }

    if let Some(saved) = storage.get_setting("ai_model")? {
        if !saved.trim().is_empty() {
            return Ok(Some(saved));
        }
    }

    Ok(AIProvider::parse(provider)
        .ok()
        .map(|entry| entry.default_model().to_string()))
}

#[tauri::command]
#[specta::specta]
pub async fn ai_keys_test(
    id: i64,
    model: Option<String>,
    prompt: Option<String>,
    state: State<'_, AppState>,
) -> Result<AiKeyTestResult, Error> {
    let record = state
        .storage
        .ai_keys_get(id)?
        .ok_or_else(|| Error::InvalidInput(format!("No AI key with id {id}")))?;
    let plaintext = state
        .storage
        .ai_keys_get_decrypted(id)?
        .ok_or_else(|| Error::InvalidInput(format!("No AI key with id {id}")))?;
    let resolved_model = resolve_test_model(&record.provider, model, &state.storage)?;

    let result = test_ai_key_for_provider(
        &record.provider,
        &plaintext,
        resolved_model.clone(),
        prompt.clone(),
    )
    .await;
    let (ok, message) = match &result {
        Ok(msg) => (true, msg.clone()),
        Err(error) => (false, error.to_string()),
    };
    let _ = state.storage.ai_keys_record_test(id, ok, &message);
    if ok {
        if let Some(model_id) = resolved_model {
            let input = prompt
                .as_deref()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or("ping");
            let output = if input == "ping" {
                "OK"
            } else {
                message.as_str()
            };
            let capture = AiUsageCapture::estimated_from_text(
                &record.provider,
                &model_id,
                "key_test",
                input,
                output,
            );
            let _ = record_usage(&state.storage, capture);
        }
    }
    Ok(AiKeyTestResult { ok, message })
}

/// Test the configured provider key source (environment keys plus active saved keys).
#[tauri::command]
#[specta::specta]
pub async fn ai_keys_test_provider(
    provider: String,
    model: Option<String>,
    prompt: Option<String>,
    state: State<'_, AppState>,
) -> Result<AiKeyTestResult, Error> {
    let provider = AIProvider::parse(&provider)?.as_str().to_string();
    let resolved_model = resolve_test_model(&provider, model, &state.storage)?;
    let result = test_configured_ai_key_for_provider(
        &provider,
        resolved_model.clone(),
        prompt.clone(),
        &state.storage,
    )
    .await;
    let outcome = match result {
        Ok(msg) => {
            if let Some(model_id) = resolved_model {
                let input = prompt
                    .as_deref()
                    .filter(|value| !value.trim().is_empty())
                    .unwrap_or("ping");
                let output = if input == "ping" { "OK" } else { msg.as_str() };
                let capture = AiUsageCapture::estimated_from_text(
                    &provider, &model_id, "key_test", input, output,
                );
                let _ = record_usage(&state.storage, capture);
            }
            AiKeyTestResult {
                ok: true,
                message: msg,
            }
        }
        Err(error) => AiKeyTestResult {
            ok: false,
            message: error.to_string(),
        },
    };
    Ok(outcome)
}

/// Test an unsaved key (used by the "Test before save" button).
#[tauri::command]
#[specta::specta]
pub async fn ai_keys_test_raw(
    provider: String,
    api_key: String,
    model: Option<String>,
    prompt: Option<String>,
    state: State<'_, AppState>,
) -> Result<AiKeyTestResult, Error> {
    AIProvider::parse(&provider)?;
    let resolved_model = resolve_test_model(provider.trim(), model, &state.storage)?;
    let result = test_ai_key_for_provider(
        provider.trim(),
        api_key.trim(),
        resolved_model.clone(),
        prompt.clone(),
    )
    .await;
    let outcome = match result {
        Ok(msg) => {
            if let Some(model_id) = resolved_model {
                let input = prompt
                    .as_deref()
                    .filter(|value| !value.trim().is_empty())
                    .unwrap_or("ping");
                let output = if input == "ping" { "OK" } else { msg.as_str() };
                let capture = AiUsageCapture::estimated_from_text(
                    provider.trim(),
                    &model_id,
                    "key_test",
                    input,
                    output,
                );
                let _ = record_usage(&state.storage, capture);
            }
            AiKeyTestResult {
                ok: true,
                message: msg,
            }
        }
        Err(error) => AiKeyTestResult {
            ok: false,
            message: error.to_string(),
        },
    };
    Ok(outcome)
}
