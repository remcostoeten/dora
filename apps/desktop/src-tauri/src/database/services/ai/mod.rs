mod gemini;
mod ollama;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::Error;
use crate::storage::Storage;

pub use gemini::GeminiClient;
pub use ollama::OllamaClient;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub enum AIProvider {
    Gemini,
    Ollama,
}

impl Default for AIProvider {
    fn default() -> Self {
        Self::Ollama // Default to local/free
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct SchemaContext {
    pub tables: Vec<TableContext>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct TableContext {
    pub name: String,
    pub columns: Vec<String>,
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

pub struct AIService<'a> {
    pub storage: &'a Storage,
}

impl<'a> AIService<'a> {
    /// Get the currently configured AI provider
    pub fn get_provider(&self) -> Result<AIProvider, Error> {
        match self.storage.get_setting("ai_provider")? {
            Some(p) if p == "gemini" => Ok(AIProvider::Gemini),
            Some(p) if p == "ollama" => Ok(AIProvider::Ollama),
            _ => Ok(AIProvider::default()),
        }
    }

    /// Set the AI provider
    pub fn set_provider(&self, provider: AIProvider) -> Result<(), Error> {
        let value = match provider {
            AIProvider::Gemini => "gemini",
            AIProvider::Ollama => "ollama",
        };
        self.storage.set_setting("ai_provider", value)?;
        Ok(())
    }

    /// Complete a prompt using the configured provider
    pub async fn complete(&self, request: AIRequest) -> Result<AIResponse, Error> {
        let provider = self.get_provider()?;
        
        match provider {
            AIProvider::Gemini => {
                let api_key = self.storage.get_setting("gemini_api_key")?
                    .ok_or_else(|| Error::Any(anyhow::anyhow!("Gemini API key not configured")))?;
                
                let client = GeminiClient::new(api_key);
                client.complete(request).await
            }
            AIProvider::Ollama => {
                let endpoint = self.storage.get_setting("ollama_endpoint")?
                    .unwrap_or_else(|| "http://localhost:11434".to_string());
                let model = self.storage.get_setting("ollama_model")?
                    .unwrap_or_else(|| "llama3.2".to_string());
                
                let client = OllamaClient::new(endpoint, model);
                client.complete(request).await
            }
        }
    }
}
