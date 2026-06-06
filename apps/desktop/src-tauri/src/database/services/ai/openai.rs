use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc::UnboundedSender;

use super::{AIRequest, AIResponse, AiStreamEvent};
use crate::error::Error;
use crate::storage::Storage;

const OPENAI_API_URL: &str = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODELS_URL: &str = "https://api.openai.com/v1/models";
const DEFAULT_MODEL: &str = "gpt-4.1";

#[derive(Debug, Serialize)]
struct OpenAiMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct OpenAiRequest {
    model: String,
    messages: Vec<OpenAiMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    response_format: Option<ResponseFormat>,
}

#[derive(Debug, Serialize)]
struct ResponseFormat {
    #[serde(rename = "type")]
    kind: String,
}

#[derive(Debug, Deserialize)]
struct OpenAiResponse {
    choices: Vec<OpenAiChoice>,
    usage: Option<OpenAiUsage>,
}

#[derive(Debug, Deserialize)]
struct OpenAiChoice {
    message: OpenAiResponseMessage,
}

#[derive(Debug, Deserialize)]
struct OpenAiResponseMessage {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAiUsage {
    total_tokens: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct OpenAiStreamChunk {
    choices: Vec<OpenAiStreamChoice>,
}

#[derive(Debug, Deserialize)]
struct OpenAiStreamChoice {
    delta: OpenAiStreamDelta,
}

#[derive(Debug, Deserialize, Default)]
struct OpenAiStreamDelta {
    #[serde(default)]
    content: Option<String>,
}

pub struct OpenAiClient {
    keys: Vec<String>,
    counter: AtomicUsize,
    model: String,
    client: reqwest::Client,
}

impl OpenAiClient {
    pub fn from_env_and_storage(storage: &Storage) -> Result<Self, Error> {
        let mut keys = Self::collect_env_keys();
        let db_keys = storage.ai_keys_active_decrypted("openai").unwrap_or_default();
        keys.extend(db_keys);
        let model = storage
            .get_setting("ai_model")?
            .filter(|value| !value.trim().is_empty())
            .or_else(|| std::env::var("OPENAI_MODEL").ok())
            .unwrap_or_else(|| DEFAULT_MODEL.to_string());
        Self::from_sources(keys, model)
    }

    fn collect_env_keys() -> Vec<String> {
        let mut keys = Vec::new();
        if let Ok(key) = std::env::var("OPENAI_API_KEY") {
            if !key.is_empty() {
                keys.push(key);
            }
        }
        for index in 1..=10 {
            if let Ok(key) = std::env::var(format!("OPENAI_API_KEY_{index}")) {
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
                "No OpenAI API keys configured. Add one in Settings → AI Keys, or set OPENAI_API_KEY in your environment.".into(),
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
                4_u32,
            ),
        };

        let body = serde_json::json!({
            "model": model.unwrap_or(DEFAULT_MODEL),
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user}
            ],
            "max_tokens": max_tokens,
            "temperature": 0.0,
        });

        let response = client
            .post(OPENAI_API_URL)
            .bearer_auth(api_key)
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
            struct TestChatResponse {
                choices: Vec<TestChoice>,
            }
            #[derive(Deserialize)]
            struct TestChoice {
                message: TestMessage,
            }
            #[derive(Deserialize)]
            struct TestMessage {
                content: String,
            }

            let payload: TestChatResponse = response
                .json()
                .await
                .map_err(|error| Error::Any(anyhow::anyhow!("invalid response: {error}")))?;
            let content = payload
                .choices
                .first()
                .map(|choice| choice.message.content.trim())
                .filter(|text| !text.is_empty())
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
        use_json_format: bool,
    ) -> OpenAiRequest {
        OpenAiRequest {
            model: self.model.clone(),
            messages: vec![
                OpenAiMessage {
                    role: "system".into(),
                    content: system,
                },
                OpenAiMessage {
                    role: "user".into(),
                    content: user,
                },
            ],
            max_tokens,
            stream,
            temperature: Some(0.2),
            response_format: use_json_format.then(|| ResponseFormat {
                kind: "json_object".into(),
            }),
        }
    }

    fn uses_json_format(request: &AIRequest) -> bool {
        request.prompt_mode.as_deref() != Some("chat")
    }

    fn should_rotate(status: reqwest::StatusCode) -> bool {
        status == reqwest::StatusCode::TOO_MANY_REQUESTS
            || status == reqwest::StatusCode::UNAUTHORIZED
            || status == reqwest::StatusCode::FORBIDDEN
            || status.is_server_error()
    }

    pub async fn complete(&self, request: AIRequest) -> Result<AIResponse, Error> {
        let (system, user) = super::prompts::build(&request);
        let body = self.build_request(
            system,
            user,
            request.max_tokens,
            false,
            Self::uses_json_format(&request),
        );

        let max_retries = self.keys.len().max(1);
        let mut last_err: Option<Error> = None;

        for _ in 0..max_retries {
            let key = self.next_key().to_string();
            let response = match self
                .client
                .post(OPENAI_API_URL)
                .bearer_auth(&key)
                .json(&body)
                .send()
                .await
            {
                Ok(response) => response,
                Err(error) => {
                    last_err = Some(Error::Any(anyhow::anyhow!("OpenAI request failed: {error}")));
                    continue;
                }
            };

            let status = response.status();
            if Self::should_rotate(status) {
                let body_text = response.text().await.unwrap_or_default();
                last_err = Some(Error::Any(anyhow::anyhow!(
                    "OpenAI key/provider error (status {status}): {body_text}"
                )));
                continue;
            }

            if !status.is_success() {
                let body_text = response.text().await.unwrap_or_default();
                return Err(Error::Any(anyhow::anyhow!(
                    "OpenAI API error ({status}): {body_text}"
                )));
            }

            let parsed: OpenAiResponse = response.json().await.map_err(|error| {
                Error::Any(anyhow::anyhow!("Failed to parse OpenAI response: {error}"))
            })?;

            let content = parsed
                .choices
                .into_iter()
                .next()
                .and_then(|choice| choice.message.content)
                .unwrap_or_default();

            return Ok(AIResponse {
                content,
                suggested_queries: None,
                tokens_used: parsed.usage.and_then(|usage| usage.total_tokens),
                provider: "openai".to_string(),
            });
        }

        Err(last_err.unwrap_or_else(|| Error::Any(anyhow::anyhow!("All OpenAI keys exhausted"))))
    }

    pub async fn complete_stream(
        &self,
        request: AIRequest,
        sender: UnboundedSender<AiStreamEvent>,
        cancel: Arc<AtomicBool>,
    ) -> Result<(), Error> {
        let (system, user) = super::prompts::build(&request);
        let body = self.build_request(
            system,
            user,
            request.max_tokens,
            true,
            Self::uses_json_format(&request),
        );

        let max_retries = self.keys.len().max(1);
        let mut last_err: Option<Error> = None;

        for _ in 0..max_retries {
            if cancel.load(Ordering::Relaxed) {
                return Ok(());
            }

            let key = self.next_key().to_string();
            let response = match self
                .client
                .post(OPENAI_API_URL)
                .bearer_auth(&key)
                .json(&body)
                .send()
                .await
            {
                Ok(response) => response,
                Err(error) => {
                    last_err = Some(Error::Any(anyhow::anyhow!("OpenAI request failed: {error}")));
                    continue;
                }
            };

            let status = response.status();
            if Self::should_rotate(status) {
                let body_text = response.text().await.unwrap_or_default();
                last_err = Some(Error::Any(anyhow::anyhow!(
                    "OpenAI key/provider error (status {status}): {body_text}"
                )));
                continue;
            }

            if !status.is_success() {
                let body_text = response.text().await.unwrap_or_default();
                return Err(Error::Any(anyhow::anyhow!(
                    "OpenAI API error ({status}): {body_text}"
                )));
            }

            let mut stream = response.bytes_stream();
            let mut buffer = String::new();
            let mut full_content = String::new();

            while let Some(chunk_result) = stream.next().await {
                if cancel.load(Ordering::Relaxed) {
                    return Ok(());
                }
                let chunk = chunk_result
                    .map_err(|error| Error::Any(anyhow::anyhow!("OpenAI stream error: {error}")))?;
                buffer.push_str(&String::from_utf8_lossy(&chunk));

                while let Some(newline_idx) = buffer.find('\n') {
                    let line = buffer[..newline_idx].trim().to_string();
                    buffer = buffer[newline_idx + 1..].to_string();

                    if line.is_empty() {
                        continue;
                    }
                    let data = if let Some(rest) = line.strip_prefix("data: ") {
                        rest
                    } else {
                        continue;
                    };

                    if data == "[DONE]" {
                        let _ = sender.send(AiStreamEvent::Final {
                            content: full_content.clone(),
                        });
                        return Ok(());
                    }

                    if let Ok(parsed) = serde_json::from_str::<OpenAiStreamChunk>(data) {
                        if let Some(delta_text) = parsed
                            .choices
                            .into_iter()
                            .next()
                            .and_then(|choice| choice.delta.content)
                        {
                            full_content.push_str(&delta_text);
                            let _ = sender.send(AiStreamEvent::Token { text: delta_text });
                        }
                    }
                }
            }

            let _ = sender.send(AiStreamEvent::Final {
                content: full_content,
            });
            return Ok(());
        }

        Err(last_err.unwrap_or_else(|| Error::Any(anyhow::anyhow!("All OpenAI keys exhausted"))))
    }

    pub async fn fetch_model_ids(storage: &Storage) -> Result<Vec<String>, Error> {
        let client = Self::from_env_and_storage(storage)?;
        let api_key = client
            .keys
            .first()
            .ok_or_else(|| Error::InvalidInput("No OpenAI API keys configured".into()))?;

        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .map_err(|error| Error::Any(anyhow::anyhow!("client build failed: {error}")))?;

        let response = http
            .get(OPENAI_MODELS_URL)
            .bearer_auth(api_key)
            .send()
            .await
            .map_err(|error| Error::Any(anyhow::anyhow!("OpenAI models request failed: {error}")))?;

        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Any(anyhow::anyhow!(
                "OpenAI models request failed: {body}"
            )));
        }

        #[derive(Debug, Deserialize)]
        struct OpenAiModelsResponse {
            data: Vec<OpenAiModelEntry>,
        }

        #[derive(Debug, Deserialize)]
        struct OpenAiModelEntry {
            id: String,
        }

        let parsed: OpenAiModelsResponse = response.json().await.map_err(|error| {
            Error::Any(anyhow::anyhow!("Failed to parse OpenAI models: {error}"))
        })?;

        Ok(parsed.data.into_iter().map(|entry| entry.id).collect())
    }
}
