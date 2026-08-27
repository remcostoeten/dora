mod anthropic;
mod client;
mod compat;
mod errors;
mod gemini;
mod key_pool;
mod models;
mod ollama;
mod prompts;
mod usage;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::Error;
use crate::storage::Storage;

pub use client::{test_configured_key, test_key, AiClient};
pub use key_pool::KeyPool;
pub use ollama::{OllamaCatalogEntry, OllamaClient, OllamaPullEvent, OllamaStatus};
pub use usage::{record_usage, usage_source, AiUsageCapture};

pub(crate) fn truncate_test_reply(text: &str) -> String {
    const LIMIT: usize = 160;
    let trimmed = text.trim();
    if trimmed.chars().count() <= LIMIT {
        return trimmed.to_string();
    }
    let shortened: String = trimmed.chars().take(LIMIT).collect();
    format!("{shortened}…")
}

#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct AiUsageEntry {
    pub id: i64,
    pub provider: String,
    pub model: String,
    pub source: String,
    pub input_tokens: Option<u32>,
    pub output_tokens: Option<u32>,
    pub total_tokens: Option<u32>,
    pub estimated_cost_usd: Option<f64>,
    pub estimated: bool,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct AiUsageProviderSummary {
    pub provider: String,
    pub request_count: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub total_tokens: u64,
    pub estimated_cost_usd: f64,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct AiUsageSummary {
    pub total_requests: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub total_tokens: u64,
    pub estimated_cost_usd: f64,
    pub providers: Vec<AiUsageProviderSummary>,
    pub recent: Vec<AiUsageEntry>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub enum AIProvider {
    #[default]
    Groq,
    Gemini,
    Ollama,
    Openai,
    Anthropic,
    Deepseek,
    Kimi,
    Glm,
    Qwen,
    Openrouter,
    Mock,
}

impl AIProvider {
    pub const ALL: [AIProvider; 11] = [
        Self::Groq,
        Self::Gemini,
        Self::Ollama,
        Self::Openai,
        Self::Anthropic,
        Self::Deepseek,
        Self::Kimi,
        Self::Glm,
        Self::Qwen,
        Self::Openrouter,
        Self::Mock,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Groq => "groq",
            Self::Gemini => "gemini",
            Self::Ollama => "ollama",
            Self::Openai => "openai",
            Self::Anthropic => "anthropic",
            Self::Deepseek => "deepseek",
            Self::Kimi => "kimi",
            Self::Glm => "glm",
            Self::Qwen => "qwen",
            Self::Openrouter => "openrouter",
            Self::Mock => "mock",
        }
    }

    pub fn parse(value: &str) -> Result<Self, Error> {
        match value.trim().to_lowercase().as_str() {
            "groq" => Ok(Self::Groq),
            "gemini" => Ok(Self::Gemini),
            "ollama" => Ok(Self::Ollama),
            "openai" => Ok(Self::Openai),
            "anthropic" => Ok(Self::Anthropic),
            "deepseek" => Ok(Self::Deepseek),
            "kimi" => Ok(Self::Kimi),
            "glm" => Ok(Self::Glm),
            "qwen" => Ok(Self::Qwen),
            "openrouter" => Ok(Self::Openrouter),
            "mock" => Ok(Self::Mock),
            _ => Err(Error::InvalidInput(format!("Invalid AI provider: {value}"))),
        }
    }

    pub fn default_model(self) -> &'static str {
        match self {
            Self::Groq => "llama-3.3-70b-versatile",
            Self::Gemini => "gemini-2.5-flash",
            Self::Ollama => "llama3.2",
            Self::Openai => "gpt-5.5",
            Self::Anthropic => "claude-sonnet-4-6",
            Self::Deepseek => "deepseek-chat",
            Self::Kimi => "kimi-latest",
            Self::Glm => "glm-5.3-flash",
            Self::Qwen => "qwen-plus",
            Self::Openrouter => "openrouter/auto",
            Self::Mock => "mock",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::Groq => "Groq",
            Self::Gemini => "Gemini",
            Self::Ollama => "Ollama",
            Self::Openai => "OpenAI",
            Self::Anthropic => "Anthropic",
            Self::Deepseek => "DeepSeek",
            Self::Kimi => "Kimi",
            Self::Glm => "GLM",
            Self::Qwen => "Qwen",
            Self::Openrouter => "OpenRouter",
            Self::Mock => "Mock",
        }
    }

    pub fn env_key_prefix(self) -> Option<&'static str> {
        match self {
            Self::Groq => Some("GROQ"),
            Self::Gemini => Some("GEMINI"),
            Self::Openai => Some("OPENAI"),
            Self::Anthropic => Some("ANTHROPIC"),
            Self::Deepseek => Some("DEEPSEEK"),
            Self::Kimi => Some("KIMI"),
            Self::Glm => Some("GLM"),
            Self::Qwen => Some("QWEN"),
            Self::Openrouter => Some("OPENROUTER"),
            Self::Ollama | Self::Mock => None,
        }
    }

    pub fn model_setting_key(self) -> String {
        match self {
            Self::Ollama => "ollama_model".to_string(),
            _ => format!("ai_model.{}", self.as_str()),
        }
    }
}

/// Resolve the model to use for a provider: its own saved setting, then the
/// provider's `{PREFIX}_MODEL` env var, then the built-in default.
pub fn resolve_model(provider: AIProvider, storage: &Storage) -> Result<String, Error> {
    fn non_empty(value: Option<String>) -> Option<String> {
        value
            .map(|entry| entry.trim().to_string())
            .filter(|entry| !entry.is_empty())
    }

    if let Some(saved) = non_empty(storage.get_setting(&provider.model_setting_key())?) {
        return Ok(saved);
    }

    if let Some(prefix) = provider.env_key_prefix() {
        if let Some(value) = non_empty(std::env::var(format!("{prefix}_MODEL")).ok()) {
            return Ok(value);
        }
    }

    Ok(provider.default_model().to_string())
}

pub fn ollama_endpoint(storage: &Storage) -> String {
    storage
        .get_setting("ollama_endpoint")
        .ok()
        .flatten()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "http://127.0.0.1:11434".to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct AiServiceConfig {
    pub provider: String,
    pub model: String,
    pub ollama_endpoint: String,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct AiModelOption {
    pub id: String,
    pub label: String,
    pub tier: String,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct AiProviderReadiness {
    pub provider: String,
    pub ready: bool,
    pub detail: Option<String>,
    pub key_count: Option<usize>,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct AiStatus {
    pub active_provider: String,
    pub active_model: String,
    pub ready: bool,
    pub providers: Vec<AiProviderReadiness>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct SchemaContext {
    pub engine: String,
    pub tables: Vec<TableContext>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct TableContext {
    pub name: String,
    pub schema: String,
    pub columns: Vec<ColumnContext>,
    pub primary_keys: Vec<String>,
    pub foreign_keys: Vec<ForeignKeyContext>,
    pub indexes: Vec<IndexContext>,
    pub row_count_estimate: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct IndexContext {
    pub name: String,
    pub column_names: Vec<String>,
    pub is_unique: bool,
    pub is_primary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct ColumnContext {
    pub name: String,
    pub data_type: String,
    pub is_nullable: bool,
    pub is_primary_key: bool,
    pub is_auto_increment: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct ForeignKeyContext {
    pub column: String,
    pub referenced_table: String,
    pub referenced_column: String,
    pub referenced_schema: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct AIRequest {
    pub prompt: String,
    pub context: Option<SchemaContext>,
    pub connection_id: Option<Uuid>,
    pub max_tokens: Option<u32>,
    /// Prompt style selector. `Some("chat")` → free-form markdown assistant.
    /// `None` or any other value → legacy JSON-only SQL generation.
    #[serde(default)]
    pub prompt_mode: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct AIResponse {
    pub content: String,
    pub suggested_queries: Option<Vec<String>>,
    pub tokens_used: Option<u32>,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AiStreamEvent {
    Token { text: String },
    Final { content: String },
    Error { message: String },
}

#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct GroqStatus {
    pub available: bool,
    pub key_count: usize,
}

pub struct AIService<'a> {
    pub storage: &'a Storage,
}

impl<'a> AIService<'a> {
    pub fn get_provider(&self) -> Result<AIProvider, Error> {
        match self.storage.get_setting("ai_provider")? {
            Some(p) => AIProvider::parse(&p),
            None => Ok(AIProvider::default()),
        }
    }

    pub fn set_provider(&self, provider: AIProvider) -> Result<(), Error> {
        self.storage.set_setting("ai_provider", provider.as_str())?;
        Ok(())
    }

    pub fn get_config(&self) -> Result<AiServiceConfig, Error> {
        let provider = self.get_provider()?;
        Ok(AiServiceConfig {
            provider: provider.as_str().to_string(),
            model: resolve_model(provider, self.storage)?,
            ollama_endpoint: ollama_endpoint(self.storage),
        })
    }

    pub fn set_config(&self, config: AiServiceConfig) -> Result<(), Error> {
        let provider = AIProvider::parse(&config.provider)?;
        self.set_provider(provider)?;

        let model = config.model.trim();
        if model.is_empty() {
            return Err(Error::InvalidInput("Model cannot be empty".into()));
        }

        self.storage
            .set_setting(&provider.model_setting_key(), model)?;
        if provider == AIProvider::Ollama {
            self.storage
                .set_setting("ollama_endpoint", config.ollama_endpoint.trim())?;
        }

        Ok(())
    }

    pub async fn list_provider_models(
        &self,
        provider: AIProvider,
    ) -> Result<Vec<AiModelOption>, Error> {
        match provider {
            AIProvider::Openai => models::list_openai_models(self.storage).await,
            AIProvider::Anthropic => models::list_anthropic_models(self.storage).await,
            AIProvider::Groq => models::list_groq_models(self.storage).await,
            AIProvider::Gemini => models::list_gemini_models(self.storage).await,
            AIProvider::Deepseek => models::list_deepseek_models(self.storage).await,
            AIProvider::Kimi => models::list_kimi_models(self.storage).await,
            AIProvider::Glm => models::list_glm_models(self.storage).await,
            AIProvider::Qwen => models::list_qwen_models(self.storage).await,
            AIProvider::Openrouter => models::list_openrouter_models(self.storage).await,
            AIProvider::Ollama => models::list_ollama_models(&ollama_endpoint(self.storage)).await,
            AIProvider::Mock => Ok(models::curated_only(&[(
                "demo-assistant",
                "Demo assistant",
                "flagship",
            )])),
        }
    }

    fn key_provider_readiness(&self, provider: AIProvider) -> AiProviderReadiness {
        match KeyPool::from_env_and_storage(provider, self.storage) {
            Ok(pool) => AiProviderReadiness {
                provider: provider.as_str().to_string(),
                ready: true,
                detail: None,
                key_count: Some(pool.key_count()),
            },
            Err(_) => {
                let keys = self
                    .storage
                    .ai_keys_list(provider.as_str())
                    .unwrap_or_default();
                let active_count = keys.iter().filter(|key| key.is_active).count();
                let label = provider.label();
                AiProviderReadiness {
                    provider: provider.as_str().to_string(),
                    ready: active_count > 0,
                    detail: if active_count > 0 {
                        None
                    } else if keys.is_empty() {
                        Some(format!(
                            "Add {} {label} API key in Settings → AI Keys",
                            article(label)
                        ))
                    } else {
                        Some("Enable an API key in Settings".into())
                    },
                    key_count: Some(keys.len()),
                }
            }
        }
    }

    async fn ollama_readiness(&self, endpoint: &str) -> AiProviderReadiness {
        let client = OllamaClient::new(endpoint.to_string(), String::new());
        match client.list_models().await {
            Ok(models) => {
                let ready = !models.is_empty();
                AiProviderReadiness {
                    provider: AIProvider::Ollama.as_str().to_string(),
                    ready,
                    detail: if ready {
                        None
                    } else {
                        Some("Ollama is running but no models are installed yet".into())
                    },
                    key_count: None,
                }
            }
            Err(error) => AiProviderReadiness {
                provider: AIProvider::Ollama.as_str().to_string(),
                ready: false,
                detail: Some(format!("Ollama unreachable at {endpoint} ({error})")),
                key_count: None,
            },
        }
    }

    pub async fn get_status(&self) -> Result<AiStatus, Error> {
        let config = self.get_config()?;
        let mut providers = Vec::with_capacity(AIProvider::ALL.len());

        for provider in AIProvider::ALL {
            providers.push(match provider {
                AIProvider::Ollama => self.ollama_readiness(&config.ollama_endpoint).await,
                AIProvider::Mock => AiProviderReadiness {
                    provider: provider.as_str().to_string(),
                    ready: false,
                    detail: Some("Web demo only".into()),
                    key_count: None,
                },
                _ => self.key_provider_readiness(provider),
            });
        }

        let ready = providers
            .iter()
            .find(|entry| entry.provider == config.provider)
            .is_some_and(|entry| entry.ready);

        Ok(AiStatus {
            active_provider: config.provider,
            active_model: config.model,
            ready,
            providers,
        })
    }

    pub async fn complete(&self, request: AIRequest) -> Result<AIResponse, Error> {
        client::build_client(self.get_provider()?, self.storage)?
            .complete(request)
            .await
    }

    /// Streaming completion for cloud and local providers.
    pub async fn complete_stream(
        &self,
        request: AIRequest,
        sender: tokio::sync::mpsc::UnboundedSender<AiStreamEvent>,
        cancel: std::sync::Arc<std::sync::atomic::AtomicBool>,
    ) -> Result<(), Error> {
        client::build_client(self.get_provider()?, self.storage)?
            .complete_stream(request, sender, cancel)
            .await
    }
}

fn article(label: &str) -> &'static str {
    match label.chars().next().map(|c| c.to_ascii_lowercase()) {
        Some('a' | 'e' | 'i' | 'o' | 'u') => "an",
        _ => "a",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn article_picks_an_for_vowel_labels() {
        assert_eq!(article("OpenAI"), "an");
        assert_eq!(article("Anthropic"), "an");
        assert_eq!(article("Groq"), "a");
        assert_eq!(article("Gemini"), "a");
    }

    #[test]
    fn model_setting_keys_are_per_provider() {
        assert_eq!(AIProvider::Groq.model_setting_key(), "ai_model.groq");
        assert_eq!(AIProvider::Openai.model_setting_key(), "ai_model.openai");
        assert_eq!(AIProvider::Ollama.model_setting_key(), "ollama_model");
    }

    #[test]
    fn all_covers_every_provider_once() {
        for provider in AIProvider::ALL {
            assert_eq!(
                AIProvider::parse(provider.as_str()).expect("round-trip"),
                provider
            );
        }
        let mut ids: Vec<&str> = AIProvider::ALL.iter().map(|p| p.as_str()).collect();
        ids.sort_unstable();
        ids.dedup();
        assert_eq!(ids.len(), AIProvider::ALL.len());
    }
}
