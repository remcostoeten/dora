use crate::database::types::is_postgres_pooler_url;

pub fn is_postgres_connection_url(connection_string: &str) -> bool {
    let connection_string = strip_trailing_shell_comment(connection_string);
    connection_string.starts_with("postgres://") || connection_string.starts_with("postgresql://")
}

pub fn clean_postgres_connection_string(connection_string: &str) -> (String, bool, bool) {
    let connection_string = strip_trailing_shell_comment(connection_string);
    let Ok(mut url) = url::Url::parse(connection_string) else {
        return (connection_string.to_string(), false, false);
    };

    let is_pooler = is_postgres_pooler_url(&url);
    let mut disable_channel_binding = is_pooler;
    let mut verify_tls = false;
    let mut has_sslmode = false;
    let params: Vec<_> = url
        .query_pairs()
        .filter_map(|(key, value)| {
            if key == "channel_binding" {
                disable_channel_binding = true;
                None
            } else if key == "sslmode" && matches!(value.as_ref(), "verify-ca" | "verify-full") {
                has_sslmode = true;
                verify_tls = true;
                Some((key.into_owned(), "require".to_string()))
            } else if key == "sslmode" {
                has_sslmode = true;
                Some((key.into_owned(), value.into_owned()))
            } else if is_dora_postgres_option(&key) {
                None
            } else {
                Some((key.into_owned(), value.into_owned()))
            }
        })
        .collect();

    url.query_pairs_mut().clear().extend_pairs(params);
    if is_pooler && !has_sslmode {
        url.query_pairs_mut().append_pair("sslmode", "require");
    }
    if url.query().is_some_and(str::is_empty) {
        url.set_query(None);
    }

    (url.to_string(), disable_channel_binding, verify_tls)
}

fn strip_trailing_shell_comment(input: &str) -> &str {
    let trimmed = input.trim();
    let mut quote: Option<char> = None;

    for (idx, ch) in trimmed.char_indices() {
        if let Some(active_quote) = quote {
            if ch == active_quote {
                quote = None;
            }
            continue;
        }

        if matches!(ch, '"' | '\'') {
            quote = Some(ch);
            continue;
        }

        if ch == '#'
            && trimmed[..idx]
                .chars()
                .last()
                .is_none_or(char::is_whitespace)
        {
            return trimmed[..idx].trim_end();
        }
    }

    trimmed
}

fn is_dora_postgres_option(key: &str) -> bool {
    matches!(
        key.to_ascii_lowercase().as_str(),
        "pgbouncer"
            | "pooler"
            | "simple_query"
            | "prepared_statements"
            | "prepared_statement"
            | "statement_cache_size"
            | "statement_cache_capacity"
    )
}

#[cfg(test)]
mod tests {
    use super::clean_postgres_connection_string;

    #[test]
    fn strips_dora_postgres_options() {
        let url = "postgres://user@host/db?pgbouncer=true&sslmode=require";
        let (cleaned, disable_channel_binding, verify_tls) = clean_postgres_connection_string(url);
        assert!(!cleaned.contains("pgbouncer"));
        assert_eq!(cleaned, "postgres://user@host/db?sslmode=require");
        assert!(!disable_channel_binding);
        assert!(!verify_tls);
    }

    #[test]
    fn pooler_forces_sslmode_require() {
        let url = "postgres://user@aws.pooler.supabase.com:6543/postgres";
        let (cleaned, disable_channel_binding, _) = clean_postgres_connection_string(url);
        assert!(cleaned.contains("sslmode=require"));
        assert!(disable_channel_binding);
    }

    #[test]
    fn verify_full_downgrades_to_require() {
        let url = "postgres://user@host/db?sslmode=verify-full";
        let (cleaned, _, verify_tls) = clean_postgres_connection_string(url);
        assert!(cleaned.contains("sslmode=require"));
        assert!(verify_tls);
    }

    #[test]
    fn strips_trailing_env_comment() {
        let url = "postgres://user@localhost:5433/auth_drawer  # pasted from .env";
        let (cleaned, _, _) = clean_postgres_connection_string(url);
        assert_eq!(cleaned, "postgres://user@localhost:5433/auth_drawer");
    }
}
