//! Provider-agnostic client contract plus the shared HTTP plumbing every cloud
//! provider needs: key rotation with retry, SSE line parsing, and the factory
//! that turns an [`AIProvider`] into a ready-to-use client.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use futures_util::StreamExt;
use tokio::sync::mpsc::UnboundedSender;

use super::anthropic::AnthropicClient;
use super::compat::{
    CompatSpec, OpenAiCompatClient, DEEPSEEK_COMPAT, GLM_COMPAT, GROQ_COMPAT, KIMI_COMPAT,
    OPENAI_COMPAT, OPENROUTER_COMPAT, QWEN_COMPAT,
};
use super::gemini::GeminiClient;
use super::ollama::OllamaClient;
use super::{AIProvider, AIRequest, AIResponse, AiStreamEvent, KeyPool};
use crate::error::Error;
use crate::storage::Storage;

#[async_trait]
pub trait AiClient: Send + Sync {
    async fn complete(&self, request: AIRequest) -> Result<AIResponse, Error>;

    async fn complete_stream(
        &self,
        request: AIRequest,
        sender: UnboundedSender<AiStreamEvent>,
        cancel: Arc<AtomicBool>,
    ) -> Result<(), Error>;
}

fn compat_spec(provider: AIProvider) -> Option<&'static CompatSpec> {
    match provider {
        AIProvider::Groq => Some(&GROQ_COMPAT),
        AIProvider::Openai => Some(&OPENAI_COMPAT),
        AIProvider::Deepseek => Some(&DEEPSEEK_COMPAT),
        AIProvider::Kimi => Some(&KIMI_COMPAT),
        AIProvider::Glm => Some(&GLM_COMPAT),
        AIProvider::Qwen => Some(&QWEN_COMPAT),
        AIProvider::Openrouter => Some(&OPENROUTER_COMPAT),
        _ => None,
    }
}

/// Build the client for a provider, resolving its model and credentials.
pub fn build_client(provider: AIProvider, storage: &Storage) -> Result<Box<dyn AiClient>, Error> {
    let model = super::resolve_model(provider, storage)?;
    if let Some(spec) = compat_spec(provider) {
        return Ok(Box::new(OpenAiCompatClient::from_env_and_storage(
            spec, storage, model,
        )?));
    }
    Ok(match provider {
        AIProvider::Anthropic => Box::new(AnthropicClient::from_env_and_storage(storage, model)?),
        AIProvider::Gemini => Box::new(GeminiClient::from_env_and_storage(storage, model)?),
        AIProvider::Ollama => Box::new(OllamaClient::new(super::ollama_endpoint(storage), model)),
        AIProvider::Mock => Box::new(MockClient),
        _ => unreachable!("compat providers handled above"),
    })
}

/// Validate a single unsaved key against the provider's API.
pub async fn test_key(
    provider: AIProvider,
    api_key: &str,
    model: Option<&str>,
    prompt: Option<&str>,
) -> Result<String, Error> {
    if let Some(spec) = compat_spec(provider) {
        return OpenAiCompatClient::test_key(spec, api_key, model, prompt).await;
    }
    match provider {
        AIProvider::Anthropic => AnthropicClient::test_key(api_key, model, prompt).await,
        AIProvider::Gemini => GeminiClient::test_key(api_key, model, prompt).await,
        _ => Err(Error::InvalidInput(format!(
            "Key testing is not supported for provider: {}",
            provider.as_str()
        ))),
    }
}

/// Validate the provider's configured key source (environment plus active saved keys).
pub async fn test_configured_key(
    provider: AIProvider,
    storage: &Storage,
    model: Option<&str>,
    prompt: Option<&str>,
) -> Result<String, Error> {
    if provider.env_key_prefix().is_none() {
        return Err(Error::InvalidInput(format!(
            "Key testing is not supported for provider: {}",
            provider.as_str()
        )));
    }
    let pool = KeyPool::from_env_and_storage(provider, storage)?;
    test_key(provider, pool.first(), model, prompt).await
}

pub struct MockClient;

const MOCK_UNAVAILABLE: &str = "Mock provider is only available in the web demo.";

#[async_trait]
impl AiClient for MockClient {
    async fn complete(&self, _request: AIRequest) -> Result<AIResponse, Error> {
        Err(Error::Any(anyhow::anyhow!(MOCK_UNAVAILABLE)))
    }

    async fn complete_stream(
        &self,
        _request: AIRequest,
        sender: UnboundedSender<AiStreamEvent>,
        _cancel: Arc<AtomicBool>,
    ) -> Result<(), Error> {
        let _ = sender.send(AiStreamEvent::Error {
            message: MOCK_UNAVAILABLE.to_string(),
        });
        Ok(())
    }
}

pub(super) fn http_client(timeout_secs: u64) -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

pub(super) fn should_rotate(status: reqwest::StatusCode) -> bool {
    status == reqwest::StatusCode::TOO_MANY_REQUESTS
        || status == reqwest::StatusCode::UNAUTHORIZED
        || status == reqwest::StatusCode::FORBIDDEN
        || status.is_server_error()
}

/// Send a request with round-robin key rotation, retrying once per key on
/// transport errors and rotate-worthy statuses (429/401/403/5xx).
///
/// Returns `Ok(None)` when `cancel` was flagged before a request went out.
pub(super) async fn send_with_rotation<F>(
    pool: &KeyPool,
    label: &str,
    model: &str,
    cancel: Option<&Arc<AtomicBool>>,
    build: F,
) -> Result<Option<reqwest::Response>, Error>
where
    F: Fn(&str) -> reqwest::RequestBuilder,
{
    let attempts = pool.key_count().max(1);
    let mut last_err: Option<Error> = None;

    for _ in 0..attempts {
        if let Some(flag) = cancel {
            if flag.load(Ordering::Relaxed) {
                return Ok(None);
            }
        }

        let key = pool.next().to_string();
        let response = match build(&key).send().await {
            Ok(response) => response,
            Err(error) => {
                last_err = Some(super::errors::request_error(label, &error));
                continue;
            }
        };

        let status = response.status();
        if should_rotate(status) {
            let body = response.text().await.unwrap_or_default();
            last_err = Some(super::errors::http_error(label, model, status, &body));
            continue;
        }

        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(super::errors::http_error(label, model, status, &body));
        }

        return Ok(Some(response));
    }

    Err(last_err.unwrap_or_else(|| Error::Any(anyhow::anyhow!("All {label} keys exhausted"))))
}

pub(super) enum SseOutcome {
    Cancelled,
    Finished,
}

/// Drain an SSE response line by line, handing each `data: ` payload to
/// `on_data`. `on_data` returns `false` to stop early (e.g. on `[DONE]`).
pub(super) async fn read_sse<F>(
    label: &str,
    response: reqwest::Response,
    cancel: &Arc<AtomicBool>,
    mut on_data: F,
) -> Result<SseOutcome, Error>
where
    F: FnMut(&str) -> bool,
{
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk_result) = stream.next().await {
        if cancel.load(Ordering::Relaxed) {
            return Ok(SseOutcome::Cancelled);
        }
        let chunk = chunk_result
            .map_err(|error| Error::Any(anyhow::anyhow!("{label} stream error: {error}")))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(newline_idx) = buffer.find('\n') {
            let line = buffer[..newline_idx].trim().to_string();
            buffer = buffer[newline_idx + 1..].to_string();

            let Some(data) = line.strip_prefix("data: ") else {
                continue;
            };
            if data.is_empty() {
                continue;
            }
            if !on_data(data) {
                return Ok(SseOutcome::Finished);
            }
        }
    }

    Ok(SseOutcome::Finished)
}
