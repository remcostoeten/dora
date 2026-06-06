use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc::UnboundedSender;

use super::{AIRequest, AIResponse, AiStreamEvent};
use crate::error::Error;

const RECOMMENDED_MODELS: [(&str, &str, &str); 3] = [
    (
        "llama3.2",
        "Llama 3.2",
        "General-purpose local model with a good speed/quality balance.",
    ),
    (
        "qwen2.5-coder:7b",
        "Qwen 2.5 Coder",
        "Strong SQL and code generation for database work.",
    ),
    (
        "deepseek-r1:7b",
        "DeepSeek R1",
        "Reasoning-focused model for complex query planning.",
    ),
];

#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct OllamaStatus {
    pub running: bool,
    pub endpoint: String,
    pub version: Option<String>,
    pub installed_count: usize,
    pub managed: bool,
    pub install_path: Option<String>,
    pub binary_ready: bool,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct OllamaCatalogEntry {
    pub name: String,
    pub label: String,
    pub description: String,
    pub installed: bool,
    pub size_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum OllamaPullEvent {
    Status { message: String },
    Progress {
        completed: u64,
        total: u64,
        percent: f32,
        eta_seconds: Option<u32>,
    },
    Done { model: String },
    Error { message: String },
}

#[derive(Debug, Serialize)]
struct OllamaChatRequest {
    model: String,
    messages: Vec<OllamaChatMessage>,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    options: Option<OllamaOptions>,
}

#[derive(Debug, Serialize, Deserialize)]
struct OllamaChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct OllamaOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    num_predict: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct OllamaChatResponse {
    message: OllamaChatMessage,
    #[serde(rename = "eval_count")]
    eval_count: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct OllamaChatStreamChunk {
    message: Option<OllamaChatMessage>,
    #[serde(default)]
    done: bool,
}

#[derive(Debug, Deserialize)]
struct OllamaModel {
    name: String,
    #[serde(default)]
    size: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct OllamaModelsResponse {
    models: Vec<OllamaModel>,
}

#[derive(Debug, Deserialize)]
struct OllamaVersionResponse {
    version: String,
}

#[derive(Debug, Deserialize)]
struct OllamaPullLine {
    status: Option<String>,
    #[serde(default)]
    total: Option<u64>,
    #[serde(default)]
    completed: Option<u64>,
    #[serde(default)]
    digest: Option<String>,
}

pub struct OllamaClient {
    endpoint: String,
    model: String,
    client: reqwest::Client,
    pull_client: reqwest::Client,
}

impl OllamaClient {
    pub fn new(endpoint: String, model: String) -> Self {
        Self {
            endpoint,
            model,
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(120))
                .build()
                .unwrap_or_else(|_| reqwest::Client::new()),
            pull_client: reqwest::Client::builder()
                .timeout(Duration::from_secs(60 * 30))
                .build()
                .unwrap_or_else(|_| reqwest::Client::new()),
        }
    }

    pub fn endpoint(&self) -> &str {
        &self.endpoint
    }

    fn normalize_endpoint(endpoint: &str) -> String {
        endpoint.trim().trim_end_matches('/').to_string()
    }

    pub async fn get_status(&self) -> OllamaStatus {
        let endpoint = self.endpoint.clone();
        match self.fetch_version().await {
            Ok(version) => {
                let installed_count = self.list_installed_models().await.map(|m| m.len()).unwrap_or(0);
                OllamaStatus {
                    running: true,
                    endpoint,
                    version: Some(version),
                    installed_count,
                    managed: false,
                    install_path: None,
                    binary_ready: false,
                }
            }
            Err(_) => OllamaStatus {
                running: false,
                endpoint,
                version: None,
                installed_count: 0,
                managed: false,
                install_path: None,
                binary_ready: false,
            },
        }
    }

    async fn fetch_version(&self) -> Result<String, Error> {
        let url = format!("{}/api/version", self.endpoint);
        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|error| Error::Any(anyhow::anyhow!("Ollama unreachable: {error}")))?;

        if !response.status().is_success() {
            return Err(Error::Any(anyhow::anyhow!(
                "Ollama version check failed ({})",
                response.status()
            )));
        }

        let parsed: OllamaVersionResponse = response
            .json()
            .await
            .map_err(|error| Error::Any(anyhow::anyhow!("Failed to parse Ollama version: {error}")))?;

        Ok(parsed.version)
    }

    async fn list_installed_models(&self) -> Result<Vec<OllamaModel>, Error> {
        let url = format!("{}/api/tags", self.endpoint);
        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|error| Error::Any(anyhow::anyhow!("Failed to list Ollama models: {error}")))?;

        if !response.status().is_success() {
            return Err(Error::Any(anyhow::anyhow!("Failed to list Ollama models")));
        }

        let models_response: OllamaModelsResponse = response.json().await.map_err(|error| {
            Error::Any(anyhow::anyhow!("Failed to parse Ollama models: {error}"))
        })?;

        Ok(models_response.models)
    }

    fn models_match(requested: &str, installed_name: &str) -> bool {
        if requested == installed_name {
            return true;
        }
        let requested_base = requested.split(':').next().unwrap_or(requested);
        let installed_base = installed_name.split(':').next().unwrap_or(installed_name);
        requested_base == installed_base
    }

    fn model_installed(name: &str, installed: &[OllamaModel]) -> bool {
        installed
            .iter()
            .any(|model| Self::models_match(name, &model.name))
    }

    fn installed_size(name: &str, installed: &[OllamaModel]) -> Option<u64> {
        installed
            .iter()
            .find(|model| Self::models_match(name, &model.name))
            .and_then(|model| model.size)
    }

    pub async fn list_catalog(&self) -> Result<Vec<OllamaCatalogEntry>, Error> {
        let installed = self.list_installed_models().await.unwrap_or_default();
        let mut catalog = Vec::new();
        let mut seen = std::collections::HashSet::new();

        for (name, label, description) in RECOMMENDED_MODELS {
            seen.insert(name.to_string());
            catalog.push(OllamaCatalogEntry {
                name: (*name).to_string(),
                label: (*label).to_string(),
                description: (*description).to_string(),
                installed: Self::model_installed(name, &installed),
                size_bytes: Self::installed_size(name, &installed),
            });
        }

        for model in installed {
            let base = model.name.split(':').next().unwrap_or(&model.name).to_string();
            if seen.insert(model.name.clone()) {
                catalog.push(OllamaCatalogEntry {
                    name: model.name.clone(),
                    label: base.clone(),
                    description: "Installed local model".into(),
                    installed: true,
                    size_bytes: model.size,
                });
            }
        }

        Ok(catalog)
    }

    pub async fn list_models(&self) -> Result<Vec<String>, Error> {
        Ok(self
            .list_installed_models()
            .await?
            .into_iter()
            .map(|model| model.name)
            .collect())
    }

    pub async fn delete_model(&self, model: &str) -> Result<(), Error> {
        let url = format!("{}/api/delete", self.endpoint);
        let response = self
            .client
            .delete(&url)
            .json(&serde_json::json!({ "name": model }))
            .send()
            .await
            .map_err(|error| Error::Any(anyhow::anyhow!("Failed to delete Ollama model: {error}")))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Any(anyhow::anyhow!(
                "Ollama delete failed ({status}): {body}"
            )));
        }

        Ok(())
    }

    pub async fn pull_model(
        &self,
        model: &str,
        sender: UnboundedSender<OllamaPullEvent>,
        cancel: Arc<AtomicBool>,
    ) -> Result<(), Error> {
        let url = format!("{}/api/pull", self.endpoint);
        let response = self
            .pull_client
            .post(&url)
            .json(&serde_json::json!({ "name": model, "stream": true }))
            .send()
            .await
            .map_err(|error| Error::Any(anyhow::anyhow!("Ollama pull failed: {error}")))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            let message = format!("Ollama pull failed ({status}): {body}");
            let _ = sender.send(OllamaPullEvent::Error {
                message: message.clone(),
            });
            return Err(Error::Any(anyhow::anyhow!(message)));
        }

        let mut stream = response.bytes_stream();
        let mut buffer = String::new();
        let mut last_progress_at = Instant::now();
        let mut last_completed = 0u64;

        while let Some(chunk_result) = stream.next().await {
            if cancel.load(Ordering::Relaxed) {
                return Ok(());
            }

            let chunk = chunk_result
                .map_err(|error| Error::Any(anyhow::anyhow!("Ollama pull stream error: {error}")))?;
            buffer.push_str(&String::from_utf8_lossy(&chunk));

            while let Some(newline_idx) = buffer.find('\n') {
                let line = buffer[..newline_idx].trim().to_string();
                buffer = buffer[newline_idx + 1..].to_string();
                if line.is_empty() {
                    continue;
                }

                let parsed: OllamaPullLine = match serde_json::from_str(&line) {
                    Ok(value) => value,
                    Err(_) => continue,
                };

                if let Some(status) = parsed.status.as_deref() {
                    if status == "success" {
                        let _ = sender.send(OllamaPullEvent::Done {
                            model: model.to_string(),
                        });
                        return Ok(());
                    }

                    if let (Some(total), Some(completed)) = (parsed.total, parsed.completed) {
                        if total > 0 {
                            let percent = ((completed as f64 / total as f64) * 100.0) as f32;
                            let elapsed = last_progress_at.elapsed().as_secs_f64().max(0.001);
                            let delta = completed.saturating_sub(last_completed);
                            let rate = delta as f64 / elapsed;
                            let eta_seconds = if rate > 0.0 {
                                Some(((total.saturating_sub(completed)) as f64 / rate).round() as u32)
                            } else {
                                None
                            };
                            last_completed = completed;
                            last_progress_at = Instant::now();
                            let _ = sender.send(OllamaPullEvent::Progress {
                                completed,
                                total,
                                percent,
                                eta_seconds,
                            });
                        }
                    }

                    let message = if let Some(digest) = parsed.digest {
                        format!("{status} {digest}")
                    } else {
                        status.to_string()
                    };
                    let _ = sender.send(OllamaPullEvent::Status { message });
                }
            }
        }

        let _ = sender.send(OllamaPullEvent::Done {
            model: model.to_string(),
        });
        Ok(())
    }

    fn build_messages(&self, request: &AIRequest) -> Vec<OllamaChatMessage> {
        let (system, user) = super::prompts::build(request);
        vec![
            OllamaChatMessage {
                role: "system".into(),
                content: system,
            },
            OllamaChatMessage {
                role: "user".into(),
                content: user,
            },
        ]
    }

    pub async fn complete(&self, request: AIRequest) -> Result<AIResponse, Error> {
        let chat_request = OllamaChatRequest {
            model: self.model.clone(),
            messages: self.build_messages(&request),
            stream: false,
            options: request.max_tokens.map(|max| OllamaOptions {
                num_predict: Some(max),
            }),
        };

        let url = format!("{}/api/chat", self.endpoint);
        let response = self
            .client
            .post(&url)
            .json(&chat_request)
            .send()
            .await
            .map_err(|error| {
                Error::Any(anyhow::anyhow!(
                    "Ollama request failed: {error}. Is Ollama running?"
                ))
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Any(anyhow::anyhow!(
                "Ollama API error ({status}): {body}"
            )));
        }

        let parsed: OllamaChatResponse = response.json().await.map_err(|error| {
            Error::Any(anyhow::anyhow!("Failed to parse Ollama response: {error}"))
        })?;

        Ok(AIResponse {
            content: parsed.message.content,
            suggested_queries: None,
            tokens_used: parsed.eval_count,
            provider: "ollama".to_string(),
        })
    }

    pub async fn complete_stream(
        &self,
        request: AIRequest,
        sender: UnboundedSender<AiStreamEvent>,
        cancel: Arc<AtomicBool>,
    ) -> Result<(), Error> {
        let chat_request = OllamaChatRequest {
            model: self.model.clone(),
            messages: self.build_messages(&request),
            stream: true,
            options: request.max_tokens.map(|max| OllamaOptions {
                num_predict: Some(max),
            }),
        };

        let url = format!("{}/api/chat", self.endpoint);
        let response = self
            .client
            .post(&url)
            .json(&chat_request)
            .send()
            .await
            .map_err(|error| Error::Any(anyhow::anyhow!("Ollama request failed: {error}")))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Any(anyhow::anyhow!(
                "Ollama API error ({status}): {body}"
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
                .map_err(|error| Error::Any(anyhow::anyhow!("Ollama stream error: {error}")))?;
            buffer.push_str(&String::from_utf8_lossy(&chunk));

            while let Some(newline_idx) = buffer.find('\n') {
                let line = buffer[..newline_idx].trim().to_string();
                buffer = buffer[newline_idx + 1..].to_string();
                if line.is_empty() {
                    continue;
                }

                let parsed: OllamaChatStreamChunk = match serde_json::from_str(&line) {
                    Ok(value) => value,
                    Err(_) => continue,
                };

                if let Some(content) = parsed
                    .message
                    .and_then(|message| Some(message.content))
                    .filter(|text| !text.is_empty())
                {
                    full_content.push_str(&content);
                    let _ = sender.send(AiStreamEvent::Token { text: content });
                }

                if parsed.done {
                    let _ = sender.send(AiStreamEvent::Final {
                        content: full_content.clone(),
                    });
                    return Ok(());
                }
            }
        }

        let _ = sender.send(AiStreamEvent::Final {
            content: full_content,
        });
        Ok(())
    }

    pub fn with_endpoint(endpoint: String) -> Self {
        Self::new(Self::normalize_endpoint(&endpoint), String::new())
    }
}
