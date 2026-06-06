use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc::UnboundedSender;

use super::{AIRequest, AIResponse, AiStreamEvent};
use crate::error::Error;
use crate::storage::Storage;

const ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODELS_URL: &str = "https://api.anthropic.com/v1/models";
const ANTHROPIC_VERSION: &str = "2023-06-01";
const DEFAULT_MODEL: &str = "claude-sonnet-4-20250514";

#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    system: String,
    messages: Vec<AnthropicMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
}

#[derive(Debug, Serialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContentBlock>,
    usage: Option<AnthropicUsage>,
}

#[derive(Debug, Deserialize)]
struct AnthropicContentBlock {
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AnthropicUsage {
    input_tokens: Option<u32>,
    output_tokens: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct AnthropicStreamPayload {
    #[serde(rename = "type")]
    event_type: String,
    delta: Option<AnthropicStreamDelta>,
}

#[derive(Debug, Deserialize)]
struct AnthropicStreamDelta {
    text: Option<String>,
}

pub struct AnthropicClient {
    keys: Vec<String>,
    counter: AtomicUsize,
    model: String,
    client: reqwest::Client,
}

impl AnthropicClient {
    pub fn from_env_and_storage(storage: &Storage) -> Result<Self, Error> {
        let mut keys = Self::collect_env_keys();
        let db_keys = storage.ai_keys_active_decrypted("anthropic").unwrap_or_default();
        keys.extend(db_keys);
        let model = storage
            .get_setting("ai_model")?
            .filter(|value| !value.trim().is_empty())
            .or_else(|| std::env::var("ANTHROPIC_MODEL").ok())
            .unwrap_or_else(|| DEFAULT_MODEL.to_string());
        Self::from_sources(keys, model)
    }

    fn collect_env_keys() -> Vec<String> {
        let mut keys = Vec::new();
        if let Ok(key) = std::env::var("ANTHROPIC_API_KEY") {
            if !key.is_empty() {
                keys.push(key);
            }
        }
        for index in 1..=10 {
            if let Ok(key) = std::env::var(format!("ANTHROPIC_API_KEY_{index}")) {
                if !key.is_empty() {
                    keys.push(key);
                }
            }
        }
        keys
    }

    fn from_sources(keys: Vec<String>, model: String) -> Result<Self, Error> {
        let mut seen = std::collections::HashSet::new();
        let keys: Vec<String> = keys
            .into_iter()
            .filter(|key| !key.is_empty() && seen.insert(key.clone()))
            .collect();

        if keys.is_empty() {
            return Err(Error::InvalidInput(
                "No Anthropic API keys configured. Add one in Settings → AI Keys, or set ANTHROPIC_API_KEY in your environment.".into(),
            ));
        }

        Ok(Self {
            keys,
            counter: AtomicUsize::new(0),
            model,
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(60))
                .build()
                .unwrap_or_else(|_| reqwest::Client::new()),
        })
    }

    pub async fn test_key(
        api_key: &str,
        model: Option<&str>,
        prompt: Option<&str>,
    ) -> Result<String, Error> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(if prompt.is_some() { 30 } else { 15 }))
            .build()
            .map_err(|error| Error::Any(anyhow::anyhow!("client build failed: {error}")))?;

        let user_prompt = prompt.filter(|value| !value.trim().is_empty());
        let (system, user, max_tokens) = match user_prompt {
            Some(text) => (
                "Reply concisely in plain text.".to_string(),
                text.to_string(),
                256_u32,
            ),
            None => (
                "Reply with the word OK only.".to_string(),
                "ping".to_string(),
                8_u32,
            ),
        };

        let body = AnthropicRequest {
            model: model.unwrap_or(DEFAULT_MODEL).to_string(),
            max_tokens,
            system,
            messages: vec![AnthropicMessage {
                role: "user".into(),
                content: user,
            }],
            stream: None,
            temperature: Some(0.0),
        };

        let response = client
            .post(ANTHROPIC_API_URL)
            .header("x-api-key", api_key)
            .header("anthropic-version", ANTHROPIC_VERSION)
            .json(&body)
            .send()
            .await
            .map_err(|error| Error::Any(anyhow::anyhow!("request failed: {error}")))?;

        let status = response.status();
        if !status.is_success() {
            let text = response.text().await.unwrap_or_default();
            return Err(Error::Any(anyhow::anyhow!("{status}: {text}")));
        }

        if user_prompt.is_some() {
            #[derive(Deserialize)]
            struct AnthropicTestResponse {
                content: Vec<AnthropicContentBlock>,
            }
            #[derive(Deserialize)]
            struct AnthropicContentBlock {
                text: Option<String>,
            }

            let payload: AnthropicTestResponse = response
                .json()
                .await
                .map_err(|error| Error::Any(anyhow::anyhow!("invalid response: {error}")))?;
            let content = payload
                .content
                .iter()
                .filter_map(|block| block.text.as_deref())
                .map(str::trim)
                .find(|text| !text.is_empty())
                .unwrap_or("(empty response)");
            return Ok(super::truncate_test_reply(content));
        }

        Ok(format!("ok ({})", status.as_u16()))
    }

    pub fn key_count(&self) -> usize {
        self.keys.len()
    }

    fn next_key(&self) -> &str {
        let index = self.counter.fetch_add(1, Ordering::Relaxed);
        &self.keys[index % self.keys.len()]
    }

    fn build_request(
        &self,
        system: String,
        user: String,
        max_tokens: Option<u32>,
        stream: bool,
    ) -> AnthropicRequest {
        AnthropicRequest {
            model: self.model.clone(),
            max_tokens: max_tokens.unwrap_or(2048),
            system,
            messages: vec![AnthropicMessage {
                role: "user".into(),
                content: user,
            }],
            stream: stream.then_some(true),
            temperature: Some(0.2),
        }
    }

    fn should_rotate(status: reqwest::StatusCode) -> bool {
        status == reqwest::StatusCode::TOO_MANY_REQUESTS
            || status == reqwest::StatusCode::UNAUTHORIZED
            || status == reqwest::StatusCode::FORBIDDEN
            || status.is_server_error()
    }

    fn auth_headers(
        builder: reqwest::RequestBuilder,
        key: &str,
    ) -> reqwest::RequestBuilder {
        builder
            .header("x-api-key", key)
            .header("anthropic-version", ANTHROPIC_VERSION)
    }

    pub async fn complete(&self, request: AIRequest) -> Result<AIResponse, Error> {
        let (system, user) = super::prompts::build(&request);
        let body = self.build_request(system, user, request.max_tokens, false);

        let max_retries = self.keys.len().max(1);
        let mut last_err: Option<Error> = None;

        for _ in 0..max_retries {
            let key = self.next_key().to_string();
            let response = match Self::auth_headers(
                self.client.post(ANTHROPIC_API_URL).json(&body),
                &key,
            )
            .send()
            .await
            {
                Ok(response) => response,
                Err(error) => {
                    last_err =
                        Some(Error::Any(anyhow::anyhow!("Anthropic request failed: {error}")));
                    continue;
                }
            };

            let status = response.status();
            if Self::should_rotate(status) {
                let body_text = response.text().await.unwrap_or_default();
                last_err = Some(Error::Any(anyhow::anyhow!(
                    "Anthropic key/provider error (status {status}): {body_text}"
                )));
                continue;
            }

            if !status.is_success() {
                let body_text = response.text().await.unwrap_or_default();
                return Err(Error::Any(anyhow::anyhow!(
                    "Anthropic API error ({status}): {body_text}"
                )));
            }

            let parsed: AnthropicResponse = response.json().await.map_err(|error| {
                Error::Any(anyhow::anyhow!("Failed to parse Anthropic response: {error}"))
            })?;

            let content = parsed
                .content
                .into_iter()
                .filter_map(|block| block.text)
                .collect::<Vec<_>>()
                .join("");

            let tokens_used = parsed.usage.map(|usage| {
                usage.input_tokens.unwrap_or(0) + usage.output_tokens.unwrap_or(0)
            });

            return Ok(AIResponse {
                content,
                suggested_queries: None,
                tokens_used,
                provider: "anthropic".to_string(),
            });
        }

        Err(last_err.unwrap_or_else(|| Error::Any(anyhow::anyhow!("All Anthropic keys exhausted"))))
    }

    pub async fn complete_stream(
        &self,
        request: AIRequest,
        sender: UnboundedSender<AiStreamEvent>,
        cancel: Arc<AtomicBool>,
    ) -> Result<(), Error> {
        let (system, user) = super::prompts::build(&request);
        let body = self.build_request(system, user, request.max_tokens, true);

        let max_retries = self.keys.len().max(1);
        let mut last_err: Option<Error> = None;

        for _ in 0..max_retries {
            if cancel.load(Ordering::Relaxed) {
                return Ok(());
            }

            let key = self.next_key().to_string();
            let response = match Self::auth_headers(
                self.client.post(ANTHROPIC_API_URL).json(&body),
                &key,
            )
            .send()
            .await
            {
                Ok(response) => response,
                Err(error) => {
                    last_err =
                        Some(Error::Any(anyhow::anyhow!("Anthropic request failed: {error}")));
                    continue;
                }
            };

            let status = response.status();
            if Self::should_rotate(status) {
                let body_text = response.text().await.unwrap_or_default();
                last_err = Some(Error::Any(anyhow::anyhow!(
                    "Anthropic key/provider error (status {status}): {body_text}"
                )));
                continue;
            }

            if !status.is_success() {
                let body_text = response.text().await.unwrap_or_default();
                return Err(Error::Any(anyhow::anyhow!(
                    "Anthropic API error ({status}): {body_text}"
                )));
            }

            let mut stream = response.bytes_stream();
            let mut buffer = String::new();
            let mut full_content = String::new();

            while let Some(chunk_result) = stream.next().await {
                if cancel.load(Ordering::Relaxed) {
                    return Ok(());
                }
                let chunk = chunk_result.map_err(|error| {
                    Error::Any(anyhow::anyhow!("Anthropic stream error: {error}"))
                })?;
                buffer.push_str(&String::from_utf8_lossy(&chunk));

                while let Some(newline_idx) = buffer.find('\n') {
                    let line = buffer[..newline_idx].trim().to_string();
                    buffer = buffer[newline_idx + 1..].to_string();

                    if !line.starts_with("data: ") {
                        continue;
                    }

                    let data = &line[6..];
                    if data.is_empty() {
                        continue;
                    }

                    if let Ok(parsed) = serde_json::from_str::<AnthropicStreamPayload>(data) {
                        if parsed.event_type == "content_block_delta" {
                            if let Some(text) = parsed.delta.and_then(|delta| delta.text) {
                                full_content.push_str(&text);
                                let _ = sender.send(AiStreamEvent::Token { text });
                            }
                        }
                    }
                }
            }

            let _ = sender.send(AiStreamEvent::Final {
                content: full_content,
            });
            return Ok(());
        }

        Err(last_err.unwrap_or_else(|| Error::Any(anyhow::anyhow!("All Anthropic keys exhausted"))))
    }

    pub async fn fetch_model_ids(storage: &Storage) -> Result<Vec<String>, Error> {
        let client = Self::from_env_and_storage(storage)?;
        let api_key = client
            .keys
            .first()
            .ok_or_else(|| Error::InvalidInput("No Anthropic API keys configured".into()))?;

        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .map_err(|error| Error::Any(anyhow::anyhow!("client build failed: {error}")))?;

        let response = Self::auth_headers(http.get(ANTHROPIC_MODELS_URL), api_key)
            .send()
            .await
            .map_err(|error| Error::Any(anyhow::anyhow!("Anthropic models request failed: {error}")))?;

        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Any(anyhow::anyhow!(
                "Anthropic models request failed: {body}"
            )));
        }

        #[derive(Debug, Deserialize)]
        struct AnthropicModelsResponse {
            data: Vec<AnthropicModelEntry>,
        }

        #[derive(Debug, Deserialize)]
        struct AnthropicModelEntry {
            id: String,
        }

        let parsed: AnthropicModelsResponse = response.json().await.map_err(|error| {
            Error::Any(anyhow::anyhow!("Failed to parse Anthropic models: {error}"))
        })?;

        Ok(parsed.data.into_iter().map(|entry| entry.id).collect())
    }
}
