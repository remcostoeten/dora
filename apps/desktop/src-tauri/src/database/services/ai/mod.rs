mod gemini;
mod groq;
mod ollama;
mod prompts;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::Error;
use crate::storage::Storage;

pub use gemini::GeminiClient;
pub use groq::GroqClient;
pub use ollama::OllamaClient;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub enum AIProvider {
    Groq,
    Gemini,
    Ollama,
    Openai,
    Anthropic,
    Mock,
}

impl Default for AIProvider {
    fn default() -> Self {
        Self::Groq
    }
}

impl AIProvider {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Groq => "groq",
            Self::Gemini => "gemini",
            Self::Ollama => "ollama",
            Self::Openai => "openai",
            Self::Anthropic => "anthropic",
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
            "mock" => Ok(Self::Mock),
            _ => Err(Error::InvalidInput(format!("Invalid AI provider: {value}"))),
        }
    }

    pub fn default_model(self) -> &'static str {
        match self {
            Self::Groq => "llama-3.3-70b-versatile",
            Self::Gemini => "gemini-2.0-flash",
            Self::Ollama => "llama3.2",
            Self::Openai => "gpt-4o-mini",
            Self::Anthropic => "claude-3-5-haiku-20241022",
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
            Self::Mock => "Mock",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct AiServiceConfig {
    pub provider: String,
    pub model: String,
    pub ollama_endpoint: String,
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
    pub row_count_estimate: Option<u64>,
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
        self.storage
            .set_setting("ai_provider", provider.as_str())?;
        Ok(())
    }

    pub fn get_config(&self) -> Result<AiServiceConfig, Error> {
        let provider = self.get_provider()?;
        let ollama_endpoint = self
            .storage
            .get_setting("ollama_endpoint")?
            .unwrap_or_else(|| "http://127.0.0.1:11434".to_string());

        let model = match provider {
            AIProvider::Ollama => self
                .storage
                .get_setting("ollama_model")?
                .filter(|m| !m.trim().is_empty())
                .unwrap_or_else(|| AIProvider::Ollama.default_model().to_string()),
            _ => self
                .storage
                .get_setting("ai_model")?
                .filter(|m| !m.trim().is_empty())
                .unwrap_or_else(|| provider.default_model().to_string()),
        };

        Ok(AiServiceConfig {
            provider: provider.as_str().to_string(),
            model,
            ollama_endpoint,
        })
    }

    pub fn set_config(&self, config: AiServiceConfig) -> Result<(), Error> {
        let provider = AIProvider::parse(&config.provider)?;
        self.set_provider(provider)?;

        let model = config.model.trim();
        if model.is_empty() {
            return Err(Error::InvalidInput("Model cannot be empty".into()));
        }

        match provider {
            AIProvider::Ollama => {
                self.storage.set_setting("ollama_model", model)?;
                self.storage
                    .set_setting("ollama_endpoint", config.ollama_endpoint.trim())?;
            }
            _ => {
                self.storage.set_setting("ai_model", model)?;
            }
        }

        Ok(())
    }

    pub async fn get_status(&self) -> Result<AiStatus, Error> {
        let config = self.get_config()?;
        let mut providers = Vec::with_capacity(6);

        providers.push(match GroqClient::from_env_and_storage(self.storage) {
            Ok(client) => AiProviderReadiness {
                provider: AIProvider::Groq.as_str().to_string(),
                ready: true,
                detail: None,
                key_count: Some(client.key_count()),
            },
            Err(_) => AiProviderReadiness {
                provider: AIProvider::Groq.as_str().to_string(),
                ready: false,
                detail: Some("Add a Groq API key in Settings → AI Keys".into()),
                key_count: Some(0),
            },
        });

        let gemini_ready = self
            .storage
            .get_setting("gemini_api_key")?
            .is_some_and(|key| !key.trim().is_empty());
        providers.push(AiProviderReadiness {
            provider: AIProvider::Gemini.as_str().to_string(),
            ready: gemini_ready,
            detail: if gemini_ready {
                None
            } else {
                Some("Gemini API key not configured".into())
            },
            key_count: None,
        });

        let ollama_client = OllamaClient::new(config.ollama_endpoint.clone(), String::new());
        providers.push(match ollama_client.list_models().await {
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
                detail: Some(format!(
                    "Ollama unreachable at {} ({error})",
                    config.ollama_endpoint
                )),
                key_count: None,
            },
        });

        for provider in [AIProvider::Openai, AIProvider::Anthropic] {
            let keys = self.storage.ai_keys_list(provider.as_str())?;
            let active_count = keys.iter().filter(|key| key.is_active).count();
            providers.push(AiProviderReadiness {
                provider: provider.as_str().to_string(),
                ready: active_count > 0,
                detail: if active_count > 0 {
                    None
                } else if keys.is_empty() {
                    Some(format!(
                        "{} support is coming soon — keys can be saved ahead of time",
                        provider.label()
                    ))
                } else {
                    Some("Enable an API key in Settings".into())
                },
                key_count: Some(keys.len()),
            });
        }

        providers.push(AiProviderReadiness {
            provider: AIProvider::Mock.as_str().to_string(),
            ready: false,
            detail: Some("Web demo only".into()),
            key_count: None,
        });

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
        let provider = self.get_provider()?;

        match provider {
            AIProvider::Groq => {
                let client = GroqClient::from_env_and_storage(self.storage)?;
                client.complete(request).await
            }
            AIProvider::Gemini => {
                let api_key = self
                    .storage
                    .get_setting("gemini_api_key")?
                    .ok_or_else(|| Error::Any(anyhow::anyhow!("Gemini API key not configured")))?;

                let client = GeminiClient::new(api_key);
                client.complete(request).await
            }
            AIProvider::Ollama => {
                let config = self.get_config()?;
                let client = OllamaClient::new(config.ollama_endpoint, config.model);
                client.complete(request).await
            }
            AIProvider::Openai | AIProvider::Anthropic => Err(Error::Any(anyhow::anyhow!(
                "{} support is coming soon. Switch to Groq in Settings → AI.",
                provider.label()
            ))),
            AIProvider::Mock => Err(Error::Any(anyhow::anyhow!(
                "Mock provider is only available in the web demo."
            ))),
        }
    }

    /// Streaming completion. Currently only Groq supports streaming natively;
    /// Gemini/Ollama fall back to non-streaming and emit the full result as
    /// a single Final event.
    pub async fn complete_stream(
        &self,
        request: AIRequest,
        sender: tokio::sync::mpsc::UnboundedSender<AiStreamEvent>,
        cancel: std::sync::Arc<std::sync::atomic::AtomicBool>,
    ) -> Result<(), Error> {
        let provider = self.get_provider()?;

        match provider {
            AIProvider::Groq => {
                let client = GroqClient::from_env_and_storage(self.storage)?;
                client.complete_stream(request, sender, cancel).await
            }
            AIProvider::Openai | AIProvider::Anthropic | AIProvider::Mock => {
                let message = match self.complete(request).await {
                    Ok(response) => response.content,
                    Err(error) => {
                        let _ = sender.send(AiStreamEvent::Error {
                            message: error.to_string(),
                        });
                        return Ok(());
                    }
                };
                let _ = sender.send(AiStreamEvent::Final { content: message });
                Ok(())
            }
            _ => {
                let response = self.complete(request).await?;
                let _ = sender.send(AiStreamEvent::Final {
                    content: response.content,
                });
                Ok(())
            }
        }
    }
}
