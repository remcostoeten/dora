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

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub enum AIProvider {
    Groq,
    Gemini,
    Ollama,
}

impl Default for AIProvider {
    fn default() -> Self {
        // Groq free tier with rotating keys is the preferred default.
        Self::Groq
    }
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

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
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
            Some(p) if p == "groq" => Ok(AIProvider::Groq),
            Some(p) if p == "gemini" => Ok(AIProvider::Gemini),
            Some(p) if p == "ollama" => Ok(AIProvider::Ollama),
            _ => Ok(AIProvider::default()),
        }
    }

    pub fn set_provider(&self, provider: AIProvider) -> Result<(), Error> {
        let value = match provider {
            AIProvider::Groq => "groq",
            AIProvider::Gemini => "gemini",
            AIProvider::Ollama => "ollama",
        };
        self.storage.set_setting("ai_provider", value)?;
        Ok(())
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
                    .ok_or_else(|| {
                        Error::Any(anyhow::anyhow!("Gemini API key not configured"))
                    })?;

                let client = GeminiClient::new(api_key);
                client.complete(request).await
            }
            AIProvider::Ollama => {
                let endpoint = self
                    .storage
                    .get_setting("ollama_endpoint")?
                    .unwrap_or_else(|| "http://localhost:11434".to_string());
                let model = self
                    .storage
                    .get_setting("ollama_model")?
                    .unwrap_or_else(|| "llama3.2".to_string());

                let client = OllamaClient::new(endpoint, model);
                client.complete(request).await
            }
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
