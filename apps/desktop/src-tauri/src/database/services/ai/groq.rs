use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc::UnboundedSender;

use super::{AIRequest, AIResponse, AiStreamEvent};
use crate::error::Error;
use crate::storage::Storage;

const GROQ_API_URL: &str = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS_URL: &str = "https://api.groq.com/openai/v1/models";
const DEFAULT_MODEL: &str = "llama-3.3-70b-versatile";

#[derive(Debug, Serialize)]
struct GroqMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct GroqRequest {
    model: String,
    messages: Vec<GroqMessage>,
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
struct GroqResponse {
    choices: Vec<GroqChoice>,
    usage: Option<GroqUsage>,
}

#[derive(Debug, Deserialize)]
struct GroqChoice {
    message: GroqResponseMessage,
}

#[derive(Debug, Deserialize)]
struct GroqResponseMessage {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GroqUsage {
    total_tokens: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct GroqStreamChunk {
    choices: Vec<GroqStreamChoice>,
}

#[derive(Debug, Deserialize)]
struct GroqStreamChoice {
    delta: GroqStreamDelta,
}

#[derive(Debug, Deserialize, Default)]
struct GroqStreamDelta {
    #[serde(default)]
    content: Option<String>,
}

pub struct GroqClient {
    keys: Vec<String>,
    counter: AtomicUsize,
    model: String,
    client: reqwest::Client,
}

impl GroqClient {
    pub fn from_env() -> Result<Self, Error> {
        let model = std::env::var("GROQ_MODEL").unwrap_or_else(|_| DEFAULT_MODEL.to_string());
        Self::from_sources(Self::collect_env_keys(), model)
    }

    /// Build a client merging env keys + DB-stored keys for the given storage.
    pub fn from_env_and_storage(storage: &Storage) -> Result<Self, Error> {
        let mut keys = Self::collect_env_keys();
        let db_keys = storage.ai_keys_active_decrypted("groq").unwrap_or_default();
        keys.extend(db_keys);
        let model = storage
            .get_setting("ai_model")?
            .filter(|value| !value.trim().is_empty())
            .or_else(|| std::env::var("GROQ_MODEL").ok())
            .unwrap_or_else(|| DEFAULT_MODEL.to_string());
        Self::from_sources(keys, model)
    }

    fn collect_env_keys() -> Vec<String> {
        let mut keys = Vec::new();
        if let Ok(k) = std::env::var("GROQ_API_KEY") {
            if !k.is_empty() {
                keys.push(k);
            }
        }
        for i in 1..=10 {
            if let Ok(k) = std::env::var(format!("GROQ_API_KEY_{}", i)) {
                if !k.is_empty() {
                    keys.push(k);
                }
            }
        }
        keys
    }

    fn from_sources(keys: Vec<String>, model: String) -> Result<Self, Error> {
        // Dedupe while preserving order
        let mut seen = std::collections::HashSet::new();
        let keys: Vec<String> = keys
            .into_iter()
            .filter(|k| !k.is_empty() && seen.insert(k.clone()))
            .collect();

        if keys.is_empty() {
            return Err(Error::InvalidInput(
                "No Groq API keys configured. Add one in Settings → AI Keys, or set GROQ_API_KEY[ _1..10 ] in your environment.".into(),
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

    /// Validate a single key without persisting anything. Returns Ok on 2xx, Err otherwise.
    pub async fn test_key(
        api_key: &str,
        model: Option<&str>,
        prompt: Option<&str>,
    ) -> Result<String, Error> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(if prompt.is_some() { 30 } else { 15 }))
            .build()
            .map_err(|e| Error::Any(anyhow::anyhow!("client build failed: {}", e)))?;

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
            .post(GROQ_API_URL)
            .bearer_auth(api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| Error::Any(anyhow::anyhow!("request failed: {}", e)))?;

        let status = response.status();
        if !status.is_success() {
            let text = response.text().await.unwrap_or_default();
            return Err(Error::Any(anyhow::anyhow!("{}: {}", status, text)));
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
        let idx = self.counter.fetch_add(1, Ordering::Relaxed);
        &self.keys[idx % self.keys.len()]
    }

    fn build_request(
        &self,
        system: String,
        user: String,
        max_tokens: Option<u32>,
        stream: bool,
        use_json_format: bool,
    ) -> GroqRequest {
        // Groq requires the word "json" somewhere in messages when using json_object format,
        // and chat mode expects markdown — so only enable JSON mode for SQL generation.
        GroqRequest {
            model: self.model.clone(),
            messages: vec![
                GroqMessage {
                    role: "system".into(),
                    content: system,
                },
                GroqMessage {
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

    /// Non-streaming completion with key rotation on 429/5xx/auth errors.
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
                .post(GROQ_API_URL)
                .bearer_auth(&key)
                .json(&body)
                .send()
                .await
            {
                Ok(r) => r,
                Err(e) => {
                    last_err = Some(Error::Any(anyhow::anyhow!("Groq request failed: {}", e)));
                    continue;
                }
            };

            let status = response.status();
            if Self::should_rotate(status) {
                let body_text = response.text().await.unwrap_or_default();
                last_err = Some(Error::Any(anyhow::anyhow!(
                    "Groq key/provider error (status {}): {}",
                    status,
                    body_text
                )));
                continue;
            }

            if !status.is_success() {
                let body_text = response.text().await.unwrap_or_default();
                return Err(Error::Any(anyhow::anyhow!(
                    "Groq API error ({}): {}",
                    status,
                    body_text
                )));
            }

            let parsed: GroqResponse = response
                .json()
                .await
                .map_err(|e| Error::Any(anyhow::anyhow!("Failed to parse Groq response: {}", e)))?;

            let content = parsed
                .choices
                .into_iter()
                .next()
                .and_then(|c| c.message.content)
                .unwrap_or_default();

            let tokens_used = parsed.usage.and_then(|u| u.total_tokens);

            return Ok(AIResponse {
                content,
                suggested_queries: None,
                tokens_used,
                provider: "groq".to_string(),
            });
        }

        Err(last_err.unwrap_or_else(|| Error::Any(anyhow::anyhow!("All Groq keys exhausted"))))
    }

    /// Streaming completion. Emits AiStreamEvent via sender. Honors `cancel` flag and
    /// rotates keys on 429/5xx/auth errors before any tokens are streamed.
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
                .post(GROQ_API_URL)
                .bearer_auth(&key)
                .json(&body)
                .send()
                .await
            {
                Ok(r) => r,
                Err(e) => {
                    last_err = Some(Error::Any(anyhow::anyhow!("Groq request failed: {}", e)));
                    continue;
                }
            };

            let status = response.status();
            if Self::should_rotate(status) {
                let body_text = response.text().await.unwrap_or_default();
                last_err = Some(Error::Any(anyhow::anyhow!(
                    "Groq key/provider error (status {}): {}",
                    status,
                    body_text
                )));
                continue;
            }

            if !status.is_success() {
                let body_text = response.text().await.unwrap_or_default();
                return Err(Error::Any(anyhow::anyhow!(
                    "Groq API error ({}): {}",
                    status,
                    body_text
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
                    .map_err(|e| Error::Any(anyhow::anyhow!("Groq stream error: {}", e)))?;
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

                    match serde_json::from_str::<GroqStreamChunk>(data) {
                        Ok(parsed) => {
                            if let Some(delta_text) = parsed
                                .choices
                                .into_iter()
                                .next()
                                .and_then(|c| c.delta.content)
                            {
                                full_content.push_str(&delta_text);
                                let _ = sender.send(AiStreamEvent::Token { text: delta_text });
                            }
                        }
                        Err(_) => {
                            // Skip malformed chunks quietly
                        }
                    }
                }
            }

            let _ = sender.send(AiStreamEvent::Final {
                content: full_content,
            });
            return Ok(());
        }

        Err(last_err.unwrap_or_else(|| Error::Any(anyhow::anyhow!("All Groq keys exhausted"))))
    }

    pub async fn fetch_model_ids(storage: &Storage) -> Result<Vec<String>, Error> {
        let client = Self::from_env_and_storage(storage)?;
        let api_key = client
            .keys
            .first()
            .ok_or_else(|| Error::InvalidInput("No Groq API keys configured".into()))?;

        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .map_err(|error| Error::Any(anyhow::anyhow!("client build failed: {error}")))?;

        let response = http
            .get(GROQ_MODELS_URL)
            .bearer_auth(api_key)
            .send()
            .await
            .map_err(|error| Error::Any(anyhow::anyhow!("Groq models request failed: {error}")))?;

        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Any(anyhow::anyhow!("Groq models request failed: {body}")));
        }

        #[derive(Debug, Deserialize)]
        struct GroqModelsResponse {
            data: Vec<GroqModelEntry>,
        }

        #[derive(Debug, Deserialize)]
        struct GroqModelEntry {
            id: String,
        }

        let parsed: GroqModelsResponse = response.json().await.map_err(|error| {
            Error::Any(anyhow::anyhow!("Failed to parse Groq models: {error}"))
        })?;

        Ok(parsed.data.into_iter().map(|entry| entry.id).collect())
    }
}
