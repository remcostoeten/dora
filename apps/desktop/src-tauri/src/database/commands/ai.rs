use tauri::State;
use uuid::Uuid;

use crate::{
    database::services::ai::{
        AIProvider, AIRequest, AIResponse, AIService, OllamaClient, SchemaContext, TableContext,
    },
    error::Error,
    AppState,
};

#[tauri::command]
#[specta::specta]
pub async fn ai_complete(
    prompt: String,
    connection_id: Option<Uuid>,
    max_tokens: Option<u32>,
    state: State<'_, AppState>,
) -> Result<AIResponse, Error> {
    let context = if let Some(conn_id) = connection_id {
        state.schemas.get(&conn_id).map(|schema| SchemaContext {
            tables: schema
                .tables
                .iter()
                .map(|t| TableContext {
                    name: t.name.clone(),
                    columns: t.columns.iter().map(|c| c.name.clone()).collect(),
                })
                .collect(),
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
pub async fn ai_set_provider(provider: String, state: State<'_, AppState>) -> Result<(), Error> {
    let ai_provider = match provider.to_lowercase().as_str() {
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
