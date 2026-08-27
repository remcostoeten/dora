use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc::UnboundedSender;

use super::client::{self, AiClient, SseOutcome};
use super::{AIProvider, AIRequest, AIResponse, AiStreamEvent, KeyPool};
use crate::error::Error;
use crate::storage::Storage;

const GEMINI_BASE_URL: &str = "https://generativelanguage.googleapis.com/v1beta/models";

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

fn candidate_text(response: GeminiResponse) -> (String, Option<u32>) {
    let tokens = response
        .usage_metadata
        .and_then(|usage| usage.total_token_count);
    let text = response
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
    (text, tokens)
}

pub struct GeminiClient {
    pool: KeyPool,
    model: String,
    client: reqwest::Client,
}

impl GeminiClient {
    pub fn from_env_and_storage(storage: &Storage, model: String) -> Result<Self, Error> {
        Ok(Self {
            pool: KeyPool::from_env_and_storage(AIProvider::Gemini, storage)?,
            model,
            client: client::http_client(60),
        })
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

    fn build_request(prompt: String, max_tokens: Option<u32>) -> GeminiRequest {
        GeminiRequest {
            contents: vec![GeminiContent {
                parts: vec![GeminiPart { text: prompt }],
            }],
            generation_config: max_tokens.map(|max| GenerationConfig {
                max_output_tokens: Some(max),
            }),
        }
    }

    pub async fn test_key(
        api_key: &str,
        model: Option<&str>,
        prompt: Option<&str>,
    ) -> Result<String, Error> {
        let model = model.unwrap_or(AIProvider::Gemini.default_model());
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

        let body = Self::build_request(format!("{system}\n\n{user}"), Some(max_tokens));
        let http = client::http_client(if user_prompt.is_some() { 30 } else { 15 });

        let url = format!("{GEMINI_BASE_URL}/{model}:generateContent?key={api_key}");
        let response = http
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
        let (content, _) = candidate_text(parsed);
        let content = content.trim().to_string();

        if content.is_empty() {
            Ok(format!("ok ({})", status.as_u16()))
        } else {
            Ok(super::truncate_test_reply(&content))
        }
    }

    pub async fn fetch_model_ids(storage: &Storage) -> Result<Vec<String>, Error> {
        let pool = KeyPool::from_env_and_storage(AIProvider::Gemini, storage)?;
        let http = client::http_client(15);
        let url = format!("{GEMINI_BASE_URL}?key={}", pool.first());
        let response = http.get(&url).send().await.map_err(|error| {
            Error::Any(anyhow::anyhow!("Gemini models request failed: {error}"))
        })?;

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

#[async_trait]
impl AiClient for GeminiClient {
    async fn complete(&self, request: AIRequest) -> Result<AIResponse, Error> {
        let body = Self::build_request(self.build_prompt(&request), request.max_tokens);
        let url = self.generate_url(false);

        let response = client::send_with_rotation(&self.pool, "Gemini", &self.model, None, |key| {
            self.client.post(format!("{url}?key={key}")).json(&body)
        })
        .await?
        .ok_or(Error::Cancelled)?;

        let parsed: GeminiResponse = response.json().await.map_err(|error| {
            Error::Any(anyhow::anyhow!("Failed to parse Gemini response: {error}"))
        })?;

        let (content, tokens_used) = candidate_text(parsed);

        Ok(AIResponse {
            content,
            suggested_queries: None,
            tokens_used,
            provider: "gemini".to_string(),
        })
    }

    async fn complete_stream(
        &self,
        request: AIRequest,
        sender: UnboundedSender<AiStreamEvent>,
        cancel: Arc<AtomicBool>,
    ) -> Result<(), Error> {
        let body = Self::build_request(self.build_prompt(&request), request.max_tokens);
        let url = self.generate_url(true);

        let Some(response) =
            client::send_with_rotation(&self.pool, "Gemini", &self.model, Some(&cancel), |key| {
                self.client
                    .post(format!("{url}?alt=sse&key={key}"))
                    .json(&body)
            })
            .await?
        else {
            return Ok(());
        };

        let mut full_content = String::new();
        let outcome = client::read_sse("Gemini", response, &cancel, |data| {
            if data == "[DONE]" {
                return false;
            }
            match serde_json::from_str::<GeminiResponse>(data) {
                Ok(parsed) => {
                    let (text, _) = candidate_text(parsed);
                    if !text.is_empty() {
                        full_content.push_str(&text);
                        let _ = sender.send(AiStreamEvent::Token { text });
                    }
                }
                Err(error) => {
                    tracing::debug!("Gemini stream chunk parse error: {error}");
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
