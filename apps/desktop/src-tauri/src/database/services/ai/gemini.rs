use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc::UnboundedSender;

use super::{AIRequest, AIResponse, AiStreamEvent};
use crate::error::Error;
use crate::storage::Storage;

const GEMINI_BASE_URL: &str = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODELS_URL: &str = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL: &str = "gemini-2.5-flash";

#[derive(Debug, Serialize)]
struct GeminiRequest {
    contents: Vec<GeminiContent>,
    #[serde(rename = "generationConfig", skip_serializing_if = "Option::is_none")]
    generation_config: Option<GenerationConfig>,
}

#[derive(Debug, Serialize)]
struct GeminiContent {
    parts: Vec<GeminiPart>,
}

#[derive(Debug, Serialize)]
struct GeminiPart {
    text: String,
}

#[derive(Debug, Serialize)]
struct GenerationConfig {
    #[serde(rename = "maxOutputTokens", skip_serializing_if = "Option::is_none")]
    max_output_tokens: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct GeminiResponse {
    candidates: Option<Vec<GeminiCandidate>>,
    #[serde(rename = "usageMetadata")]
    usage_metadata: Option<UsageMetadata>,
}

#[derive(Debug, Deserialize)]
struct GeminiCandidate {
    content: GeminiContentResponse,
}

#[derive(Debug, Deserialize)]
struct GeminiContentResponse {
    parts: Vec<GeminiPartResponse>,
}

#[derive(Debug, Deserialize)]
struct GeminiPartResponse {
    text: String,
}

#[derive(Debug, Deserialize)]
struct UsageMetadata {
    #[serde(rename = "totalTokenCount")]
    total_token_count: Option<u32>,
}

pub struct GeminiClient {
    keys: Vec<String>,
    counter: AtomicUsize,
    model: String,
    client: reqwest::Client,
}

impl GeminiClient {
    pub fn from_env_and_storage(storage: &Storage) -> Result<Self, Error> {
        let mut keys = Self::collect_env_keys();
        let db_keys = storage.ai_keys_active_decrypted("gemini").unwrap_or_default();
        keys.extend(db_keys);
        let model = storage
            .get_setting("ai_model")?
            .filter(|value| !value.trim().is_empty())
            .or_else(|| std::env::var("GEMINI_MODEL").ok())
            .unwrap_or_else(|| DEFAULT_MODEL.to_string());
        Self::from_sources(keys, model)
    }

    fn collect_env_keys() -> Vec<String> {
        let mut keys = Vec::new();
        if let Ok(key) = std::env::var("GEMINI_API_KEY") {
            if !key.trim().is_empty() {
                keys.push(key.trim().to_string());
            }
        }
        keys
    }

    fn from_sources(keys: Vec<String>, model: String) -> Result<Self, Error> {
        if keys.is_empty() {
            return Err(Error::Any(anyhow::anyhow!("Gemini API key not configured")));
        }
        Ok(Self {
            keys,
            counter: AtomicUsize::new(0),
            model,
            client: reqwest::Client::new(),
        })
    }

    pub fn new(api_key: String, model: String) -> Result<Self, Error> {
        Self::from_sources(vec![api_key], model)
    }

    pub fn key_count(&self) -> usize {
        self.keys.len()
    }

    fn next_key(&self) -> &str {
        let index = self.counter.fetch_add(1, Ordering::Relaxed);
        &self.keys[index % self.keys.len()]
    }

    fn build_prompt(&self, request: &AIRequest) -> String {
        let (system, user) = super::prompts::build(request);
        format!("{system}\n\n## User request\n{user}")
    }

    fn generate_url(&self, stream: bool) -> String {
        let action = if stream {
            "streamGenerateContent"
        } else {
            "generateContent"
        };
        format!("{GEMINI_BASE_URL}/{}:{action}", self.model)
    }

    fn build_request(&self, prompt: String, max_tokens: Option<u32>) -> GeminiRequest {
        GeminiRequest {
            contents: vec![GeminiContent {
                parts: vec![GeminiPart { text: prompt }],
            }],
            generation_config: max_tokens.map(|max| GenerationConfig {
                max_output_tokens: Some(max),
            }),
        }
    }

    fn should_rotate(status: reqwest::StatusCode) -> bool {
        status == reqwest::StatusCode::TOO_MANY_REQUESTS
            || status == reqwest::StatusCode::UNAUTHORIZED
            || status == reqwest::StatusCode::FORBIDDEN
            || status.is_server_error()
    }

    pub async fn test_key(
        api_key: &str,
        model: Option<&str>,
        prompt: Option<&str>,
    ) -> Result<String, Error> {
        let model = model.unwrap_or(DEFAULT_MODEL);
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

        let body = Self::from_sources(vec![api_key.to_string()], model.to_string())?
            .build_request(format!("{system}\n\n{user}"), Some(max_tokens));

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(if user_prompt.is_some() {
                30
            } else {
                15
            }))
            .build()
            .map_err(|error| Error::Any(anyhow::anyhow!("client build failed: {error}")))?;

        let url = format!(
            "{GEMINI_BASE_URL}/{model}:generateContent?key={api_key}"
        );
        let response = client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|error| Error::Any(anyhow::anyhow!("Gemini test failed: {error}")))?;

        let status = response.status();
        if !status.is_success() {
            let body_text = response.text().await.unwrap_or_default();
            return Err(Error::Any(anyhow::anyhow!(
                "Gemini test failed ({status}): {body_text}"
            )));
        }

        let parsed: GeminiResponse = response
            .json()
            .await
            .map_err(|error| Error::Any(anyhow::anyhow!("invalid response: {error}")))?;
        let content = parsed
            .candidates
            .and_then(|candidates| candidates.into_iter().next())
            .map(|candidate| {
                candidate
                    .content
                    .parts
                    .into_iter()
                    .map(|part| part.text)
                    .collect::<Vec<_>>()
                    .join("")
            })
            .unwrap_or_default()
            .trim()
            .to_string();

        if content.is_empty() {
            Ok(format!("ok ({})", status.as_u16()))
        } else {
            Ok(super::truncate_test_reply(&content))
        }
    }

    pub async fn complete(&self, request: AIRequest) -> Result<AIResponse, Error> {
        let prompt = self.build_prompt(&request);
        let body = self.build_request(prompt, request.max_tokens);
        let max_retries = self.keys.len().max(1);
        let mut last_err: Option<Error> = None;

        for _ in 0..max_retries {
            let key = self.next_key().to_string();
            let url = format!("{}?key={key}", self.generate_url(false));
            let response = match self.client.post(&url).json(&body).send().await {
                Ok(response) => response,
                Err(error) => {
                    last_err = Some(Error::Any(anyhow::anyhow!("Gemini request failed: {error}")));
                    continue;
                }
            };

            let status = response.status();
            if Self::should_rotate(status) {
                let body_text = response.text().await.unwrap_or_default();
                last_err = Some(Error::Any(anyhow::anyhow!(
                    "Gemini key/provider error (status {status}): {body_text}"
                )));
                continue;
            }

            if !status.is_success() {
                let body_text = response.text().await.unwrap_or_default();
                return Err(Error::Any(anyhow::anyhow!(
                    "Gemini API error ({status}): {body_text}"
                )));
            }

            let gemini_response: GeminiResponse = response.json().await.map_err(|error| {
                Error::Any(anyhow::anyhow!("Failed to parse Gemini response: {error}"))
            })?;

            let content = gemini_response
                .candidates
                .and_then(|candidates| candidates.into_iter().next())
                .map(|candidate| {
                    candidate
                        .content
                        .parts
                        .into_iter()
                        .map(|part| part.text)
                        .collect::<Vec<_>>()
                        .join("")
                })
                .unwrap_or_default();

            let tokens_used = gemini_response
                .usage_metadata
                .and_then(|usage| usage.total_token_count);

            return Ok(AIResponse {
                content,
                suggested_queries: None,
                tokens_used,
                provider: "gemini".to_string(),
            });
        }

        Err(last_err.unwrap_or_else(|| Error::Any(anyhow::anyhow!("All Gemini keys exhausted"))))
    }

    pub async fn complete_stream(
        &self,
        request: AIRequest,
        sender: UnboundedSender<AiStreamEvent>,
        cancel: Arc<AtomicBool>,
    ) -> Result<(), Error> {
        let prompt = self.build_prompt(&request);
        let body = self.build_request(prompt, request.max_tokens);
        let max_retries = self.keys.len().max(1);
        let mut last_err: Option<Error> = None;

        for _ in 0..max_retries {
            if cancel.load(Ordering::Relaxed) {
                return Ok(());
            }

            let key = self.next_key().to_string();
            let url = format!("{}?alt=sse&key={key}", self.generate_url(true));
            let response = match self.client.post(&url).json(&body).send().await {
                Ok(response) => response,
                Err(error) => {
                    last_err = Some(Error::Any(anyhow::anyhow!("Gemini request failed: {error}")));
                    continue;
                }
            };

            let status = response.status();
            if Self::should_rotate(status) {
                let body_text = response.text().await.unwrap_or_default();
                last_err = Some(Error::Any(anyhow::anyhow!(
                    "Gemini key/provider error (status {status}): {body_text}"
                )));
                continue;
            }

            if !status.is_success() {
                let body_text = response.text().await.unwrap_or_default();
                return Err(Error::Any(anyhow::anyhow!(
                    "Gemini API error ({status}): {body_text}"
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
                    .map_err(|error| Error::Any(anyhow::anyhow!("Gemini stream error: {error}")))?;
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

                    match serde_json::from_str::<GeminiResponse>(data) {
                        Ok(parsed) => {
                            if let Some(text) = parsed
                                .candidates
                                .and_then(|candidates| candidates.into_iter().next())
                                .map(|candidate| {
                                    candidate
                                        .content
                                        .parts
                                        .into_iter()
                                        .map(|part| part.text)
                                        .collect::<Vec<_>>()
                                        .join("")
                                })
                                .filter(|text| !text.is_empty())
                            {
                                full_content.push_str(&text);
                                let _ = sender.send(AiStreamEvent::Token { text });
                            }
                        }
                        Err(error) => {
                            tracing::debug!("Gemini stream chunk parse error: {error}");
                        }
                    }
                }
            }

            let _ = sender.send(AiStreamEvent::Final {
                content: full_content.clone(),
            });
            return Ok(());
        }

        Err(last_err.unwrap_or_else(|| Error::Any(anyhow::anyhow!("All Gemini keys exhausted"))))
    }

    pub async fn fetch_model_ids(storage: &Storage) -> Result<Vec<String>, Error> {
        let client = Self::from_env_and_storage(storage)?;
        let key = client.next_key();
        let url = format!("{GEMINI_MODELS_URL}?key={key}");
        let response = client
            .client
            .get(&url)
            .send()
            .await
            .map_err(|error| Error::Any(anyhow::anyhow!("Gemini models request failed: {error}")))?;

        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Any(anyhow::anyhow!(
                "Gemini models request failed: {body}"
            )));
        }

        #[derive(Debug, Deserialize)]
        struct GeminiModelsResponse {
            models: Vec<GeminiModelEntry>,
        }

        #[derive(Debug, Deserialize)]
        struct GeminiModelEntry {
            name: String,
            #[serde(rename = "supportedGenerationMethods", default)]
            supported_generation_methods: Vec<String>,
        }

        let parsed: GeminiModelsResponse = response.json().await.map_err(|error| {
            Error::Any(anyhow::anyhow!("Failed to parse Gemini models: {error}"))
        })?;

        Ok(parsed
            .models
            .into_iter()
            .filter(|entry| {
                entry.supported_generation_methods.is_empty()
                    || entry
                        .supported_generation_methods
                        .iter()
                        .any(|method| method == "generateContent")
            })
            .filter_map(|entry| entry.name.strip_prefix("models/").map(str::to_string))
            .collect())
    }
}
