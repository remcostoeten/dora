use std::fmt::Write;

use serde::de::IgnoredAny;
use serde_json::value::RawValue;

use crate::Error;

pub fn serialize_as_json_array<'a, I: ExactSizeIterator<Item = &'a str>>(
    iter: I,
) -> Result<Box<RawValue>, Error> {
    let mut json = String::with_capacity(iter.len() + 2);
    json.push('[');

    for (i, col) in iter.enumerate() {
        if i > 0 {
            json.push(',');
        }
        write!(&mut json, "\"{}\"", col)?;
    }
    json.push(']');

    Ok(RawValue::from_string(json).expect("hand-built JSON array is valid"))
}

pub fn is_json(input: &[u8]) -> bool {
    serde_json::from_slice::<IgnoredAny>(input).is_ok()
}

/// Replaces the password of a connection URL (userinfo and/or `password=`
/// query param) with `****` so the string is safe to embed in user-visible
/// errors and logs. Handles malformed input too, since the call sites are
/// exactly the ones where URL parsing failed.
pub fn redact_connection_string(connection_string: &str) -> String {
    let Ok(mut url) = url::Url::parse(connection_string) else {
        return redact_unparseable_connection_string(connection_string);
    };

    if url.password().is_some() {
        let _ = url.set_password(Some("****"));
    }

    let has_password_param = url
        .query_pairs()
        .any(|(key, _)| key.eq_ignore_ascii_case("password"));
    if has_password_param {
        let pairs: Vec<(String, String)> = url
            .query_pairs()
            .map(|(key, value)| {
                let value = if key.eq_ignore_ascii_case("password") {
                    "****".to_string()
                } else {
                    value.into_owned()
                };
                (key.into_owned(), value)
            })
            .collect();
        url.query_pairs_mut().clear().extend_pairs(pairs);
    }

    url.to_string()
}

fn redact_unparseable_connection_string(connection_string: &str) -> String {
    match connection_string.split_once("://") {
        Some((scheme, rest)) if rest.contains('@') => {
            let (userinfo, host) = rest
                .rsplit_once('@')
                .expect("rest contains '@' per the guard");
            match userinfo.split_once(':') {
                Some((user, _password)) => format!("{scheme}://{user}:****@{host}"),
                None => connection_string.to_string(),
            }
        }
        // Could be a keyword/value DSN ("host=x password=y") or anything else;
        // over-redact rather than risk echoing a secret.
        _ => "<unparseable connection string redacted>".to_string(),
    }
}

#[tauri::command]
pub fn check_tcp_port(port: u16) -> bool {
    std::net::TcpListener::bind(("127.0.0.1", port)).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_serialize_as_json_array() {
        let iter = ["a", "b", "c"];
        let json = serialize_as_json_array(iter.iter().copied()).unwrap();
        assert_eq!(serde_json::to_string(&json).unwrap(), r#"["a","b","c"]"#);

        let iter = ["a"];
        let json = serialize_as_json_array(iter.iter().copied()).unwrap();
        assert_eq!(serde_json::to_string(&json).unwrap(), r#"["a"]"#);

        let iter = [];
        let json = serialize_as_json_array(iter.iter().copied()).unwrap();
        assert_eq!(serde_json::to_string(&json).unwrap(), r#"[]"#);
    }

    #[test]
    fn redacts_userinfo_password() {
        let redacted = redact_connection_string("postgres://user:hunter2@db.example.com:5432/app");
        assert!(!redacted.contains("hunter2"));
        assert_eq!(redacted, "postgres://user:****@db.example.com:5432/app");
    }

    #[test]
    fn leaves_passwordless_url_untouched() {
        let url = "postgres://user@db.example.com/app?sslmode=require";
        assert_eq!(redact_connection_string(url), url);
    }

    #[test]
    fn redacts_password_query_param() {
        let redacted = redact_connection_string(
            "postgres://db.example.com/app?password=hunter2&sslmode=require",
        );
        assert!(!redacted.contains("hunter2"));
        assert!(redacted.contains("sslmode=require"));
    }

    #[test]
    fn redacts_unparseable_url_with_userinfo() {
        let redacted = redact_connection_string("postgres://user:secret@@@/db");
        assert!(!redacted.contains("secret"));
        assert!(redacted.starts_with("postgres://user:****@"));
    }

    #[test]
    fn over_redacts_unrecognized_input() {
        let redacted = redact_connection_string("host=localhost password=hunter2");
        assert!(!redacted.contains("hunter2"));
    }

    #[test]
    fn test_is_json() {
        assert!(is_json(b"{}"));
        assert!(is_json(b"[]"));
        assert!(is_json(b"{\"a\": 1}"));
        assert!(is_json(b"[\"a\", 1]"));
        assert!(is_json(b"[\"a\", 1, true, false, null]"));

        assert!(!is_json(b"{]"));
        assert!(!is_json(b"{\"a\": 1"));
    }
}
