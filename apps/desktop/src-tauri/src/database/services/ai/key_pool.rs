//! Shared API-key handling for cloud AI providers: env + stored keys merged,
//! deduped, and rotated round-robin so a rate-limited key falls back to the next.

use std::sync::atomic::{AtomicUsize, Ordering};

use super::AIProvider;
use crate::error::Error;
use crate::storage::Storage;

#[derive(Debug)]
pub struct KeyPool {
    keys: Vec<String>,
    counter: AtomicUsize,
}

impl KeyPool {
    /// Merge environment keys (`{PREFIX}_API_KEY`, `{PREFIX}_API_KEY_1..10`)
    /// with active stored keys for the provider.
    pub fn from_env_and_storage(provider: AIProvider, storage: &Storage) -> Result<Self, Error> {
        let prefix = provider.env_key_prefix().ok_or_else(|| {
            Error::InvalidInput(format!("{} does not use API keys", provider.label()))
        })?;
        let mut keys = collect_env_keys(prefix);
        keys.extend(
            storage
                .ai_keys_active_decrypted(provider.as_str())
                .unwrap_or_default(),
        );
        Self::from_keys(provider, keys)
    }

    pub fn from_keys(provider: AIProvider, keys: Vec<String>) -> Result<Self, Error> {
        let mut seen = std::collections::HashSet::new();
        let keys: Vec<String> = keys
            .into_iter()
            .map(|key| key.trim().to_string())
            .filter(|key| !key.is_empty() && seen.insert(key.clone()))
            .collect();

        if keys.is_empty() {
            let label = provider.label();
            let hint = provider
                .env_key_prefix()
                .map(|prefix| format!(", or set {prefix}_API_KEY in your environment"))
                .unwrap_or_default();
            return Err(Error::InvalidInput(format!(
                "No {label} API keys configured. Add one in Settings → AI Keys{hint}."
            )));
        }

        Ok(Self {
            keys,
            counter: AtomicUsize::new(0),
        })
    }

    pub fn next(&self) -> &str {
        let index = self.counter.fetch_add(1, Ordering::Relaxed);
        &self.keys[index % self.keys.len()]
    }

    pub fn first(&self) -> &str {
        &self.keys[0]
    }

    pub fn key_count(&self) -> usize {
        self.keys.len()
    }
}

fn collect_env_keys(prefix: &str) -> Vec<String> {
    let mut keys = Vec::new();
    if let Ok(key) = std::env::var(format!("{prefix}_API_KEY")) {
        keys.push(key);
    }
    for index in 1..=10 {
        if let Ok(key) = std::env::var(format!("{prefix}_API_KEY_{index}")) {
            keys.push(key);
        }
    }
    keys
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn from_keys_dedupes_and_trims() {
        let pool = KeyPool::from_keys(
            AIProvider::Groq,
            vec![
                " key-a ".to_string(),
                "key-a".to_string(),
                "key-b".to_string(),
                "".to_string(),
            ],
        )
        .expect("pool");
        assert_eq!(pool.key_count(), 2);
        assert_eq!(pool.first(), "key-a");
    }

    #[test]
    fn from_keys_rejects_empty() {
        let error = KeyPool::from_keys(AIProvider::Openai, vec!["  ".to_string()]).unwrap_err();
        assert!(error.to_string().contains("No OpenAI API keys configured"));
        assert!(error.to_string().contains("OPENAI_API_KEY"));
    }

    #[test]
    fn next_rotates_round_robin() {
        let pool = KeyPool::from_keys(AIProvider::Groq, vec!["a".to_string(), "b".to_string()])
            .expect("pool");
        assert_eq!(pool.next(), "a");
        assert_eq!(pool.next(), "b");
        assert_eq!(pool.next(), "a");
    }
}
