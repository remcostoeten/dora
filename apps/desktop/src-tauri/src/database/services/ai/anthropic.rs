use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc::UnboundedSender;

use super::client::{self, AiClient, SseOutcome};
use super::{AIProvider, AIRequest, AIResponse, AiStreamEvent, KeyPool};
use crate::error::Error;
use crate::storage::Storage;

const ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODELS_URL: &str = "https://api.anthropic.com/v1/models";
const ANTHROPIC_VERSION: &str = "2023-06-01";

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
    pool: KeyPool,
    model: String,
    client: reqwest::Client,
}

fn auth_headers(builder: reqwest::RequestBuilder, key: &str) -> reqwest::RequestBuilder {
    builder
        .header("x-api-key", key)
        .header("anthropic-version", ANTHROPIC_VERSION)
}

impl AnthropicClient {
    pub fn from_env_and_storage(storage: &Storage, model: String) -> Result<Self, Error> {
        Ok(Self {
            pool: KeyPool::from_env_and_storage(AIProvider::Anthropic, storage)?,
            model,
            client: client::http_client(60),
        })
    }

    pub async fn test_key(
        api_key: &str,
        model: Option<&str>,
        prompt: Option<&str>,
    ) -> Result<String, Error> {
        let http = client::http_client(if prompt.is_some() { 30 } else { 15 });

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
            model: model
                .unwrap_or(AIProvider::Anthropic.default_model())
                .to_string(),
            max_tokens,
            system,
            messages: vec![AnthropicMessage {
                role: "user".into(),
                content: user,
            }],
            stream: None,
            temperature: Some(0.0),
        };

        let response = auth_headers(http.post(ANTHROPIC_API_URL).json(&body), api_key)
            .send()
            .await
            .map_err(|error| Error::Any(anyhow::anyhow!("request failed: {error}")))?;

        let status = response.status();
        if !status.is_success() {
            let text = response.text().await.unwrap_or_default();
            return Err(Error::Any(anyhow::anyhow!("{status}: {text}")));
        }

        if user_prompt.is_some() {
            let payload: AnthropicResponse = response
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

    pub async fn fetch_model_ids(storage: &Storage) -> Result<Vec<String>, Error> {
        let pool = KeyPool::from_env_and_storage(AIProvider::Anthropic, storage)?;
        let http = client::http_client(15);

        let response = auth_headers(http.get(ANTHROPIC_MODELS_URL), pool.first())
            .send()
            .await
            .map_err(|error| {
                Error::Any(anyhow::anyhow!("Anthropic models request failed: {error}"))
            })?;

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

    fn build_request(&self, request: &AIRequest, stream: bool) -> AnthropicRequest {
        let (system, user) = super::prompts::build(request);
        AnthropicRequest {
            model: self.model.clone(),
            max_tokens: request.max_tokens.unwrap_or(2048),
            system,
            messages: vec![AnthropicMessage {
                role: "user".into(),
                content: user,
            }],
            stream: stream.then_some(true),
            temperature: Some(0.2),
        }
    }
}

#[async_trait]
impl AiClient for AnthropicClient {
    async fn complete(&self, request: AIRequest) -> Result<AIResponse, Error> {
        let body = self.build_request(&request, false);

        let response =
            client::send_with_rotation(&self.pool, "Anthropic", &self.model, None, |key| {
                auth_headers(self.client.post(ANTHROPIC_API_URL).json(&body), key)
            })
            .await?
            .ok_or(Error::Cancelled)?;

        let parsed: AnthropicResponse = response.json().await.map_err(|error| {
            Error::Any(anyhow::anyhow!(
                "Failed to parse Anthropic response: {error}"
            ))
        })?;

        let content = parsed
            .content
            .into_iter()
            .filter_map(|block| block.text)
            .collect::<Vec<_>>()
            .join("");

        let tokens_used = parsed
            .usage
            .map(|usage| usage.input_tokens.unwrap_or(0) + usage.output_tokens.unwrap_or(0));

        Ok(AIResponse {
            content,
            suggested_queries: None,
            tokens_used,
            provider: "anthropic".to_string(),
        })
    }

    async fn complete_stream(
        &self,
        request: AIRequest,
        sender: UnboundedSender<AiStreamEvent>,
        cancel: Arc<AtomicBool>,
    ) -> Result<(), Error> {
        let body = self.build_request(&request, true);

        let Some(response) = client::send_with_rotation(
            &self.pool,
            "Anthropic",
            &self.model,
            Some(&cancel),
            |key| auth_headers(self.client.post(ANTHROPIC_API_URL).json(&body), key),
        )
        .await?
        else {
            return Ok(());
        };

        let mut full_content = String::new();
        let outcome = client::read_sse("Anthropic", response, &cancel, |data| {
            if let Ok(parsed) = serde_json::from_str::<AnthropicStreamPayload>(data) {
                if parsed.event_type == "content_block_delta" {
                    if let Some(text) = parsed.delta.and_then(|delta| delta.text) {
                        full_content.push_str(&text);
                        let _ = sender.send(AiStreamEvent::Token { text });
                    }
                }
            }
            true
        })
        .await?;

        if matches!(outcome, SseOutcome::Finished) {
            let _ = sender.send(AiStreamEvent::Final {
                content: full_content,
            });
        }
        Ok(())
    }
}
