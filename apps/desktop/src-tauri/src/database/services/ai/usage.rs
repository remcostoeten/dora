use super::AIResponse;
use crate::error::Error;
use crate::storage::{AiUsageInsert, Storage};

#[derive(Debug, Clone)]
pub struct AiUsageCapture {
    pub provider: String,
    pub model: String,
    pub source: String,
    pub input_tokens: Option<u32>,
    pub output_tokens: Option<u32>,
    pub total_tokens: Option<u32>,
    pub estimated: bool,
}

struct ModelPricing {
    input_per_million: f64,
    output_per_million: f64,
}

pub fn usage_source(prompt_mode: Option<&str>) -> &'static str {
    match prompt_mode {
        Some("chat") => "chat",
        _ => "sql_gen",
    }
}

pub fn estimate_tokens_from_text(text: &str) -> u32 {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return 0;
    }
    ((trimmed.chars().count() as f64) / 4.0).ceil().max(1.0) as u32
}

pub fn normalize_token_counts(
    input_tokens: Option<u32>,
    output_tokens: Option<u32>,
    total_tokens: Option<u32>,
) -> (Option<u32>, Option<u32>, Option<u32>) {
    if let (Some(input), Some(output)) = (input_tokens, output_tokens) {
        let total = total_tokens.or(Some(input.saturating_add(output)));
        return (Some(input), Some(output), total);
    }

    if let Some(total) = total_tokens.filter(|value| *value > 0) {
        let input = input_tokens.unwrap_or((total as f64 * 0.35).ceil() as u32);
        let output = output_tokens.unwrap_or(total.saturating_sub(input));
        return (Some(input), Some(output), Some(total));
    }

    (input_tokens, output_tokens, total_tokens)
}

pub fn estimate_cost_usd(
    provider: &str,
    model: &str,
    input_tokens: Option<u32>,
    output_tokens: Option<u32>,
) -> Option<f64> {
    if provider == "ollama" || provider == "mock" {
        return Some(0.0);
    }

    let pricing = pricing_for_model(model);
    let input = input_tokens.unwrap_or(0) as f64;
    let output = output_tokens.unwrap_or(0) as f64;
    if input == 0.0 && output == 0.0 {
        return None;
    }

    Some(
        (input / 1_000_000.0) * pricing.input_per_million
            + (output / 1_000_000.0) * pricing.output_per_million,
    )
}

fn pricing_for_model(model: &str) -> ModelPricing {
    let lower = model.to_lowercase();

    if lower.contains("gpt-5.5-pro") {
        return ModelPricing {
            input_per_million: 30.0,
            output_per_million: 180.0,
        };
    }
    if lower.contains("gpt-5.5") {
        return ModelPricing {
            input_per_million: 5.0,
            output_per_million: 30.0,
        };
    }
    if lower.contains("gpt-5.4-mini") || lower.contains("gpt-5.4-nano") {
        return ModelPricing {
            input_per_million: 0.5,
            output_per_million: 2.0,
        };
    }
    if lower.contains("gpt-5") || lower.contains("gpt-4.1") || lower.contains("gpt-4o") {
        return ModelPricing {
            input_per_million: 2.0,
            output_per_million: 8.0,
        };
    }
    if lower.contains("claude-opus-4") {
        return ModelPricing {
            input_per_million: 5.0,
            output_per_million: 25.0,
        };
    }
    if lower.contains("claude-sonnet-4") || lower.contains("claude-3-7-sonnet") {
        return ModelPricing {
            input_per_million: 3.0,
            output_per_million: 15.0,
        };
    }
    if lower.contains("haiku") {
        return ModelPricing {
            input_per_million: 0.8,
            output_per_million: 4.0,
        };
    }
    if lower.contains("gemini-2.5-pro") {
        return ModelPricing {
            input_per_million: 1.25,
            output_per_million: 10.0,
        };
    }
    if lower.contains("gemini") {
        return ModelPricing {
            input_per_million: 0.35,
            output_per_million: 1.05,
        };
    }
    if lower.contains("llama") || lower.contains("mixtral") || lower.contains("groq") {
        return ModelPricing {
            input_per_million: 0.2,
            output_per_million: 0.2,
        };
    }

    ModelPricing {
        input_per_million: 1.0,
        output_per_million: 3.0,
    }
}

impl AiUsageCapture {
    pub fn from_response(response: &AIResponse, model: &str, source: &str) -> Self {
        let (input_tokens, output_tokens, total_tokens) =
            normalize_token_counts(None, None, response.tokens_used);
        Self {
            provider: response.provider.clone(),
            model: model.to_string(),
            source: source.to_string(),
            input_tokens,
            output_tokens,
            total_tokens,
            estimated: response.tokens_used.is_none(),
        }
    }

    pub fn estimated_from_text(
        provider: &str,
        model: &str,
        source: &str,
        input_text: &str,
        output_text: &str,
    ) -> Self {
        let input_tokens = estimate_tokens_from_text(input_text);
        let output_tokens = estimate_tokens_from_text(output_text);
        let total_tokens = input_tokens.saturating_add(output_tokens);
        Self {
            provider: provider.to_string(),
            model: model.to_string(),
            source: source.to_string(),
            input_tokens: Some(input_tokens),
            output_tokens: Some(output_tokens),
            total_tokens: Some(total_tokens),
            estimated: true,
        }
    }
}

pub fn record_usage(storage: &Storage, capture: AiUsageCapture) -> Result<(), Error> {
    let (input_tokens, output_tokens, total_tokens) = normalize_token_counts(
        capture.input_tokens,
        capture.output_tokens,
        capture.total_tokens,
    );
    let cost = estimate_cost_usd(
        &capture.provider,
        &capture.model,
        input_tokens,
        output_tokens,
    );

    storage
        .ai_usage_record(AiUsageInsert {
            provider: capture.provider,
            model: capture.model,
            source: capture.source,
            input_tokens,
            output_tokens,
            total_tokens,
            estimated_cost_usd: cost,
            estimated: capture.estimated,
        })
        .map_err(|error| Error::Any(error.into()))?;

    Ok(())
}
