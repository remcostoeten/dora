//! One client for every OpenAI-compatible chat-completions API. A provider is
//! a [`CompatSpec`] (URLs + sampling defaults), not a new module: OpenAI and
//! Groq ship here today, and any future compatible endpoint is a spec entry.

use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc::UnboundedSender;

use super::client::{self, AiClient, SseOutcome};
use super::{AIProvider, AIRequest, AIResponse, AiStreamEvent, KeyPool};
use crate::error::Error;
use crate::storage::Storage;

pub struct CompatSpec {
    pub provider: AIProvider,
    pub chat_url: &'static str,
    pub models_url: &'static str,
    pub chat_temperature: f32,
}

pub const OPENAI_COMPAT: CompatSpec = CompatSpec {
    provider: AIProvider::Openai,
    chat_url: "https://api.openai.com/v1/chat/completions",
    models_url: "https://api.openai.com/v1/models",
    chat_temperature: 0.2,
};

// Groq chat replies read stiff at 0.2; SQL generation stays at 0.2 via the
// JSON path, free-form chat gets a slightly warmer 0.35.
pub const GROQ_COMPAT: CompatSpec = CompatSpec {
    provider: AIProvider::Groq,
    chat_url: "https://api.groq.com/openai/v1/chat/completions",
    models_url: "https://api.groq.com/openai/v1/models",
    chat_temperature: 0.35,
};

pub const DEEPSEEK_COMPAT: CompatSpec = CompatSpec {
    provider: AIProvider::Deepseek,
    chat_url: "https://api.deepseek.com/chat/completions",
    models_url: "https://api.deepseek.com/models",
    chat_temperature: 0.35,
};

pub const KIMI_COMPAT: CompatSpec = CompatSpec {
    provider: AIProvider::Kimi,
    chat_url: "https://api.moonshot.ai/v1/chat/completions",
    models_url: "https://api.moonshot.ai/v1/models",
    chat_temperature: 0.35,
};

pub const GLM_COMPAT: CompatSpec = CompatSpec {
    provider: AIProvider::Glm,
    chat_url: "https://api.z.ai/api/paas/v4/chat/completions",
    models_url: "https://api.z.ai/api/paas/v4/models",
    chat_temperature: 0.35,
};

pub const QWEN_COMPAT: CompatSpec = CompatSpec {
    provider: AIProvider::Qwen,
    chat_url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    models_url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models",
    chat_temperature: 0.35,
};

pub const OPENROUTER_COMPAT: CompatSpec = CompatSpec {
    provider: AIProvider::Openrouter,
    chat_url: "https://openrouter.ai/api/v1/chat/completions",
    models_url: "https://openrouter.ai/api/v1/models",
    chat_temperature: 0.35,
};

const JSON_TEMPERATURE: f32 = 0.2;

#[derive(Debug, Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
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
struct ChatResponse {
    choices: Vec<ChatChoice>,
    usage: Option<ChatUsage>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatResponseMessage,
}

#[derive(Debug, Deserialize)]
struct ChatResponseMessage {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ChatUsage {
    total_tokens: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct StreamChunk {
    choices: Vec<StreamChoice>,
}

#[derive(Debug, Deserialize)]
struct StreamChoice {
    delta: StreamDelta,
}

#[derive(Debug, Deserialize, Default)]
struct StreamDelta {
    #[serde(default)]
    content: Option<String>,
}

pub struct OpenAiCompatClient {
    spec: &'static CompatSpec,
    pool: KeyPool,
    model: String,
    client: reqwest::Client,
}

impl OpenAiCompatClient {
    pub fn from_env_and_storage(
        spec: &'static CompatSpec,
        storage: &Storage,
        model: String,
    ) -> Result<Self, Error> {
        Ok(Self {
            spec,
            pool: KeyPool::from_env_and_storage(spec.provider, storage)?,
            model,
            client: client::http_client(60),
        })
    }

    fn label(&self) -> &'static str {
        self.spec.provider.label()
    }

    pub async fn test_key(
        spec: &'static CompatSpec,
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
                4_u32,
            ),
        };

        let body = serde_json::json!({
            "model": model.unwrap_or(spec.provider.default_model()),
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user}
            ],
            "max_tokens": max_tokens,
            "temperature": 0.0,
        });

        let response = http
            .post(spec.chat_url)
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
            let payload: ChatResponse = response
                .json()
                .await
                .map_err(|error| Error::Any(anyhow::anyhow!("invalid response: {error}")))?;
            let content = payload
                .choices
                .first()
                .and_then(|choice| choice.message.content.as_deref())
                .map(str::trim)
                .filter(|text| !text.is_empty())
                .unwrap_or("(empty response)");
            return Ok(super::truncate_test_reply(content));
        }

        Ok(format!("ok ({})", status.as_u16()))
    }

    pub async fn fetch_model_ids(
        spec: &'static CompatSpec,
        storage: &Storage,
    ) -> Result<Vec<String>, Error> {
        let label = spec.provider.label();
        let pool = KeyPool::from_env_and_storage(spec.provider, storage)?;
        let http = client::http_client(15);

        let response = http
            .get(spec.models_url)
            .bearer_auth(pool.first())
            .send()
            .await
            .map_err(|error| {
                Error::Any(anyhow::anyhow!("{label} models request failed: {error}"))
            })?;

        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Any(anyhow::anyhow!(
                "{label} models request failed: {body}"
            )));
        }

        #[derive(Debug, Deserialize)]
        struct ModelsResponse {
            data: Vec<ModelEntry>,
        }

        #[derive(Debug, Deserialize)]
        struct ModelEntry {
            id: String,
        }

        let parsed: ModelsResponse = response.json().await.map_err(|error| {
            Error::Any(anyhow::anyhow!("Failed to parse {label} models: {error}"))
        })?;

        Ok(parsed.data.into_iter().map(|entry| entry.id).collect())
    }

    fn build_request(&self, request: &AIRequest, stream: bool) -> ChatRequest {
        let (system, user) = super::prompts::build(request);
        let use_json_format = request.prompt_mode.as_deref() != Some("chat");
        let temperature = if use_json_format {
            JSON_TEMPERATURE
        } else {
            self.spec.chat_temperature
        };

        ChatRequest {
            model: self.model.clone(),
            messages: vec![
                ChatMessage {
                    role: "system".into(),
                    content: system,
                },
                ChatMessage {
                    role: "user".into(),
                    content: user,
                },
            ],
            max_tokens: request.max_tokens,
            stream,
            temperature: Some(temperature),
            response_format: use_json_format.then(|| ResponseFormat {
                kind: "json_object".into(),
            }),
        }
    }
}

#[async_trait]
impl AiClient for OpenAiCompatClient {
    async fn complete(&self, request: AIRequest) -> Result<AIResponse, Error> {
        let body = self.build_request(&request, false);

        let response =
            client::send_with_rotation(&self.pool, self.label(), &self.model, None, |key| {
                self.client
                    .post(self.spec.chat_url)
                    .bearer_auth(key)
                    .json(&body)
            })
            .await?
            .ok_or(Error::Cancelled)?;

        let parsed: ChatResponse = response.json().await.map_err(|error| {
            Error::Any(anyhow::anyhow!(
                "Failed to parse {} response: {error}",
                self.label()
            ))
        })?;

        let content = parsed
            .choices
            .into_iter()
            .next()
            .and_then(|choice| choice.message.content)
            .unwrap_or_default();

        Ok(AIResponse {
            content,
            suggested_queries: None,
            tokens_used: parsed.usage.and_then(|usage| usage.total_tokens),
            provider: self.spec.provider.as_str().to_string(),
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
            self.label(),
            &self.model,
            Some(&cancel),
            |key| {
                self.client
                    .post(self.spec.chat_url)
                    .bearer_auth(key)
                    .json(&body)
            },
        )
        .await?
        else {
            return Ok(());
        };

        let mut full_content = String::new();
        let outcome = client::read_sse(self.label(), response, &cancel, |data| {
            if data == "[DONE]" {
                return false;
            }
            if let Ok(parsed) = serde_json::from_str::<StreamChunk>(data) {
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
