use std::collections::HashSet;

use super::AiModelOption;
use crate::error::Error;
use crate::storage::Storage;

pub const OPENAI_CURATED: &[(&str, &str, &str)] = &[
    ("gpt-5.5", "GPT-5.5", "flagship"),
    ("gpt-5.5-pro", "GPT-5.5 Pro", "flagship"),
    ("gpt-5.2", "GPT-5.2", "balanced"),
    ("gpt-5", "GPT-5", "balanced"),
    ("gpt-5.4", "GPT-5.4", "balanced"),
    ("gpt-4.1", "GPT-4.1", "balanced"),
    ("gpt-4o", "GPT-4o", "balanced"),
    ("o3", "o3", "balanced"),
    ("o4-mini", "o4-mini", "balanced"),
    ("gpt-4.1-mini", "GPT-4.1 mini", "balanced"),
    ("gpt-5.4-mini", "GPT-5.4 mini", "fast"),
    ("gpt-5.4-nano", "GPT-5.4 nano", "fast"),
    ("gpt-4o-mini", "GPT-4o mini", "fast"),
    ("gpt-4.1-nano", "GPT-4.1 nano", "fast"),
];

pub const ANTHROPIC_CURATED: &[(&str, &str, &str)] = &[
    ("claude-opus-4-8", "Claude Opus 4.8", "flagship"),
    ("claude-opus-4-7", "Claude Opus 4.7", "flagship"),
    ("claude-opus-4-6", "Claude Opus 4.6", "flagship"),
    ("claude-sonnet-4-6", "Claude Sonnet 4.6", "balanced"),
    ("claude-sonnet-4-5", "Claude Sonnet 4.5", "balanced"),
    ("claude-3-7-sonnet-20250219", "Claude 3.7 Sonnet", "balanced"),
    ("claude-3-5-sonnet-20241022", "Claude 3.5 Sonnet", "balanced"),
    ("claude-haiku-4-5", "Claude Haiku 4.5", "fast"),
    ("claude-3-5-haiku-20241022", "Claude 3.5 Haiku", "fast"),
];

pub const GROQ_CURATED: &[(&str, &str, &str)] = &[
    ("llama-3.3-70b-versatile", "Llama 3.3 70B", "flagship"),
    ("llama-3.1-70b-versatile", "Llama 3.1 70B", "balanced"),
    ("llama-3.1-8b-instant", "Llama 3.1 8B", "fast"),
    ("mixtral-8x7b-32768", "Mixtral 8x7B", "balanced"),
];

pub const GEMINI_CURATED: &[(&str, &str, &str)] = &[
    ("gemini-2.5-pro", "Gemini 2.5 Pro", "flagship"),
    ("gemini-2.5-flash", "Gemini 2.5 Flash", "balanced"),
    ("gemini-2.0-flash", "Gemini 2.0 Flash", "fast"),
];

pub fn curated_only(entries: &[(&str, &str, &str)]) -> Vec<AiModelOption> {
    entries
        .iter()
        .map(|(id, label, tier)| AiModelOption {
            id: (*id).to_string(),
            label: (*label).to_string(),
            tier: (*tier).to_string(),
        })
        .collect()
}

pub fn merge_models<F>(curated: &[(&str, &str, &str)], fetched_ids: Vec<String>, classify: F) -> Vec<AiModelOption>
where
    F: Fn(&str) -> (&'static str, String),
{
    let mut seen = HashSet::new();
    let mut out = curated_only(curated);
    for option in &out {
        seen.insert(option.id.clone());
    }

    let mut extras: Vec<AiModelOption> = fetched_ids
        .into_iter()
        .filter(|id| !id.is_empty() && !seen.contains(id))
        .map(|id| {
            let (tier, label) = classify(&id);
            AiModelOption {
                id: id.clone(),
                label,
                tier: tier.to_string(),
            }
        })
        .collect();

    extras.sort_by(|left, right| left.id.cmp(&right.id));
    out.extend(extras);
    out
}

pub fn classify_openai(id: &str) -> (&'static str, String) {
    let lower = id.to_lowercase();
    let tier = if lower.starts_with("gpt-5.5")
        || (lower.starts_with("o3") && !lower.contains("mini"))
    {
        "flagship"
    } else if lower.contains("mini") || lower.contains("nano") || lower.contains("instant") {
        "fast"
    } else if lower.starts_with("gpt-")
        || lower.starts_with("o1")
        || lower.starts_with("o3")
        || lower.starts_with("o4")
        || lower.starts_with("chatgpt-")
    {
        "balanced"
    } else {
        "other"
    };
    (tier, id.to_string())
}

pub fn is_openai_chat_model(id: &str) -> bool {
    let lower = id.to_lowercase();
    if lower.contains("embed")
        || lower.contains("whisper")
        || lower.contains("tts")
        || lower.contains("dall-e")
        || lower.contains("moderation")
        || lower.contains("realtime")
        || lower.contains("transcribe")
        || lower.contains("audio")
        || lower.contains("search")
        || lower.contains("codex")
    {
        return false;
    }

    lower.starts_with("gpt-")
        || lower.starts_with("o1")
        || lower.starts_with("o3")
        || lower.starts_with("o4")
        || lower.starts_with("chatgpt-")
}

pub fn classify_anthropic(id: &str) -> (&'static str, String) {
    let lower = id.to_lowercase();
    let tier = if lower.contains("opus") {
        if lower.contains("4-6") || lower.contains("4-7") || lower.contains("4-8") {
            "flagship"
        } else {
            "other"
        }
    } else if lower.contains("haiku") {
        "fast"
    } else if lower.contains("sonnet") {
        "balanced"
    } else {
        "other"
    };
    (
        tier,
        id.replace('-', " ")
            .replace("claude ", "Claude ")
            .trim()
            .to_string(),
    )
}

pub fn classify_groq(id: &str) -> (&'static str, String) {
    let lower = id.to_lowercase();
    let tier = if lower.contains("70b") || lower.contains("405b") || lower.contains("90b") {
        "flagship"
    } else if lower.contains("8b") || lower.contains("instant") || lower.contains("mini") {
        "fast"
    } else {
        "balanced"
    };
    (tier, id.to_string())
}

pub fn classify_gemini(id: &str) -> (&'static str, String) {
    let lower = id.to_lowercase();
    let tier = if lower.contains("pro") {
        "flagship"
    } else if lower.contains("flash") || lower.contains("lite") {
        "fast"
    } else {
        "balanced"
    };
    (
        tier,
        id.replace("gemini-", "Gemini ")
            .replace('-', " ")
            .trim()
            .to_string(),
    )
}

pub async fn list_openai_models(storage: &Storage) -> Result<Vec<AiModelOption>, Error> {
    use super::OpenAiClient;

    match OpenAiClient::fetch_model_ids(storage).await {
        Ok(ids) => Ok(merge_models(
            OPENAI_CURATED,
            ids.into_iter()
                .filter(|id| is_openai_chat_model(id))
                .collect(),
            classify_openai,
        )),
        Err(error) => {
            tracing::debug!("OpenAI model list unavailable: {error}");
            Ok(curated_only(OPENAI_CURATED))
        }
    }
}

pub async fn list_anthropic_models(storage: &Storage) -> Result<Vec<AiModelOption>, Error> {
    use super::AnthropicClient;

    match AnthropicClient::fetch_model_ids(storage).await {
        Ok(ids) => Ok(merge_models(ANTHROPIC_CURATED, ids, classify_anthropic)),
        Err(error) => {
            tracing::debug!("Anthropic model list unavailable: {error}");
            Ok(curated_only(ANTHROPIC_CURATED))
        }
    }
}

pub async fn list_groq_models(storage: &Storage) -> Result<Vec<AiModelOption>, Error> {
    use super::GroqClient;

    match GroqClient::fetch_model_ids(storage).await {
        Ok(ids) => Ok(merge_models(GROQ_CURATED, ids, classify_groq)),
        Err(error) => {
            tracing::debug!("Groq model list unavailable: {error}");
            Ok(curated_only(GROQ_CURATED))
        }
    }
}

pub async fn list_gemini_models(storage: &Storage) -> Result<Vec<AiModelOption>, Error> {
    use super::GeminiClient;

    match GeminiClient::fetch_model_ids(storage).await {
        Ok(ids) => Ok(merge_models(GEMINI_CURATED, ids, classify_gemini)),
        Err(error) => {
            tracing::debug!("Gemini model list unavailable: {error}");
            Ok(curated_only(GEMINI_CURATED))
        }
    }
}

pub async fn list_ollama_models(endpoint: &str) -> Result<Vec<AiModelOption>, Error> {
    use super::OllamaClient;

    let client = OllamaClient::with_endpoint(endpoint.to_string());
    let catalog = client.list_catalog().await.unwrap_or_default();
    Ok(catalog
        .into_iter()
        .map(|entry| AiModelOption {
            id: entry.name.clone(),
            label: entry.label,
            tier: if entry.installed {
                "installed".to_string()
            } else {
                "available".to_string()
            },
        })
        .collect())
}
