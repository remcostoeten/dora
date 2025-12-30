use serde::{Deserialize, Serialize};

use crate::error::Error;
use super::{AIRequest, AIResponse};

#[derive(Debug, Serialize)]
struct OllamaRequest {
    model: String,
    prompt: String,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    options: Option<OllamaOptions>,
}

#[derive(Debug, Serialize)]
struct OllamaOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    num_predict: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct OllamaResponse {
    response: String,
    #[serde(default)]
    done: bool,
    #[serde(rename = "eval_count")]
    eval_count: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct OllamaModel {
    name: String,
}

#[derive(Debug, Deserialize)]
struct OllamaModelsResponse {
    models: Vec<OllamaModel>,
}

pub struct OllamaClient {
    endpoint: String,
    model: String,
    client: reqwest::Client,
}

impl OllamaClient {
    pub fn new(endpoint: String, model: String) -> Self {
        Self {
            endpoint,
            model,
            client: reqwest::Client::new(),
        }
    }

    fn build_prompt(&self, request: &AIRequest) -> String {
        let mut prompt = String::new();
        
        // System context
        prompt.push_str("You are an expert SQL assistant. Help the user write, debug, and understand SQL queries.\n\n");
        
        // Schema context if provided
        if let Some(ctx) = &request.context {
            prompt.push_str("## Available Tables:\n");
            for table in &ctx.tables {
                prompt.push_str(&format!("- **{}**: {}\n", table.name, table.columns.join(", ")));
            }
            prompt.push('\n');
        }
        
        // User prompt
        prompt.push_str("## User Request:\n");
        prompt.push_str(&request.prompt);
        
        prompt
    }

    pub async fn complete(&self, request: AIRequest) -> Result<AIResponse, Error> {
        let prompt = self.build_prompt(&request);
        
        let ollama_request = OllamaRequest {
            model: self.model.clone(),
            prompt,
            stream: false,
            options: request.max_tokens.map(|max| OllamaOptions {
                num_predict: Some(max),
            }),
        };

        let url = format!("{}/api/generate", self.endpoint);
        
        let response = self.client
            .post(&url)
            .json(&ollama_request)
            .send()
            .await
            .map_err(|e| Error::Any(anyhow::anyhow!("Ollama request failed: {}. Is Ollama running?", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Any(anyhow::anyhow!("Ollama API error ({}): {}", status, body)));
        }

        let ollama_response: OllamaResponse = response.json().await
            .map_err(|e| Error::Any(anyhow::anyhow!("Failed to parse Ollama response: {}", e)))?;

        Ok(AIResponse {
            content: ollama_response.response,
            suggested_queries: None,
            tokens_used: ollama_response.eval_count,
            provider: "ollama".to_string(),
        })
    }

    /// List available models from Ollama
    pub async fn list_models(&self) -> Result<Vec<String>, Error> {
        let url = format!("{}/api/tags", self.endpoint);
        
        let response = self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| Error::Any(anyhow::anyhow!("Failed to list Ollama models: {}", e)))?;

        if !response.status().is_success() {
            return Err(Error::Any(anyhow::anyhow!("Failed to list Ollama models")));
        }

        let models_response: OllamaModelsResponse = response.json().await
            .map_err(|e| Error::Any(anyhow::anyhow!("Failed to parse Ollama models: {}", e)))?;

        Ok(models_response.models.into_iter().map(|m| m.name).collect())
    }
}
