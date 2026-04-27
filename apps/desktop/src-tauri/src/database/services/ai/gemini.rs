use serde::{Deserialize, Serialize};

use super::{AIRequest, AIResponse};
use crate::error::Error;

const GEMINI_API_URL: &str =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

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
    api_key: String,
    client: reqwest::Client,
}

impl GeminiClient {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            client: reqwest::Client::new(),
        }
    }

    fn build_prompt(&self, request: &AIRequest) -> String {
        let (system, user) = super::prompts::build(request);
        format!("{}\n\n## User request\n{}", system, user)
    }

    pub async fn complete(&self, request: AIRequest) -> Result<AIResponse, Error> {
        let prompt = self.build_prompt(&request);

        let gemini_request = GeminiRequest {
            contents: vec![GeminiContent {
                parts: vec![GeminiPart { text: prompt }],
            }],
            generation_config: request.max_tokens.map(|max| GenerationConfig {
                max_output_tokens: Some(max),
            }),
        };

        let url = format!("{}?key={}", GEMINI_API_URL, self.api_key);

        let response = self
            .client
            .post(&url)
            .json(&gemini_request)
            .send()
            .await
            .map_err(|e| Error::Any(anyhow::anyhow!("Gemini request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(Error::Any(anyhow::anyhow!(
                "Gemini API error ({}): {}",
                status,
                body
            )));
        }

        let gemini_response: GeminiResponse = response
            .json()
            .await
            .map_err(|e| Error::Any(anyhow::anyhow!("Failed to parse Gemini response: {}", e)))?;

        let content = gemini_response
            .candidates
            .and_then(|c| c.into_iter().next())
            .map(|c| {
                c.content
                    .parts
                    .into_iter()
                    .map(|p| p.text)
                    .collect::<Vec<_>>()
                    .join("")
            })
            .unwrap_or_default();

        let tokens_used = gemini_response
            .usage_metadata
            .and_then(|u| u.total_token_count);

        Ok(AIResponse {
            content,
            suggested_queries: None,
            tokens_used,
            provider: "gemini".to_string(),
        })
    }
}
