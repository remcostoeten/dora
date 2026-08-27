//! Unified, user-facing error messages for AI providers.
//!
//! Each provider used to surface raw `"<Provider> API error (<status>): <body>"`
//! strings straight to the UI. This module maps the handful of error classes a
//! user can actually act on into clear, consistent copy so the message reads the
//! same regardless of which provider produced it:
//!
//! - rate limit (HTTP 429)
//! - invalid key (HTTP 401 / 403)
//! - model not found (HTTP 404, or a 400/422 whose body mentions the model)
//! - Ollama offline (connection refused to the local daemon)
//!
//! Anything that doesn't match a known class falls back to the raw status/body
//! so we never hide a useful detail.

use crate::error::Error;

/// Build a friendly message for an HTTP error returned by a cloud provider.
///
/// `provider` is the human label (e.g. "Groq", "OpenAI"). `model` is the model
/// id that was requested. `status` and `body` come straight from the response.
pub fn http_error_message(
    provider: &str,
    model: &str,
    status: reqwest::StatusCode,
    body: &str,
) -> String {
    match status {
        reqwest::StatusCode::TOO_MANY_REQUESTS => {
            format!("Rate limit reached for {provider}. Wait a moment and retry.")
        }
        reqwest::StatusCode::UNAUTHORIZED | reqwest::StatusCode::FORBIDDEN => {
            format!("Invalid API key for {provider}. Check it in Settings → AI.")
        }
        reqwest::StatusCode::NOT_FOUND => {
            format!("Model '{model}' not found for {provider}. Pick a different model.")
        }
        // Some providers return 400/422 for an unknown model rather than 404.
        // Detect that from the body so the user still gets the model hint.
        _ if body_mentions_model(body) => {
            format!("Model '{model}' not found for {provider}. Pick a different model.")
        }
        _ => format!("{provider} request failed ({status}): {}", trim_body(body)),
    }
}

/// Build a friendly message for an HTTP error as an [`Error`].
pub fn http_error(provider: &str, model: &str, status: reqwest::StatusCode, body: &str) -> Error {
    Error::Any(anyhow::anyhow!(http_error_message(
        provider, model, status, body
    )))
}

/// Build a friendly message for a transport-level failure (the request never
/// got an HTTP response — DNS, TLS, connection refused, timeout, etc.).
///
/// For Ollama a refused connection almost always means the daemon isn't running,
/// so we special-case that into actionable copy.
pub fn request_error(provider: &str, error: &reqwest::Error) -> Error {
    if is_ollama(provider) && is_connection_refused(error) {
        return Error::Any(anyhow::anyhow!(
            "Ollama isn't running. Start it with `ollama serve`."
        ));
    }
    Error::Any(anyhow::anyhow!("{provider} request failed: {error}"))
}

fn is_ollama(provider: &str) -> bool {
    provider.eq_ignore_ascii_case("ollama")
}

/// reqwest doesn't expose a typed "connection refused" variant across versions,
/// so we walk the error source chain and match the OS error string. This also
/// catches the generic "tcp connect error" wrapper reqwest emits.
fn is_connection_refused(error: &reqwest::Error) -> bool {
    if error.is_connect() {
        return true;
    }
    let mut source: Option<&(dyn std::error::Error + 'static)> = Some(error);
    while let Some(err) = source {
        let text = err.to_string().to_lowercase();
        if text.contains("connection refused")
            || text.contains("connect error")
            || text.contains("os error 111")
        {
            return true;
        }
        source = err.source();
    }
    false
}

fn body_mentions_model(body: &str) -> bool {
    let lower = body.to_lowercase();
    (lower.contains("model") && (lower.contains("not found") || lower.contains("does not exist")))
        || lower.contains("model_not_found")
        || lower.contains("unknown model")
        || lower.contains("invalid model")
}

/// Keep raw bodies from flooding the UI while still surfacing useful detail.
fn trim_body(body: &str) -> String {
    const LIMIT: usize = 300;
    let trimmed = body.trim();
    if trimmed.is_empty() {
        return "no response body".to_string();
    }
    if trimmed.chars().count() <= LIMIT {
        return trimmed.to_string();
    }
    let shortened: String = trimmed.chars().take(LIMIT).collect();
    format!("{shortened}…")
}
