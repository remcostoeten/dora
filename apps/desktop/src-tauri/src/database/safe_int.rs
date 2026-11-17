//! JSON encoding for 64-bit integers that survives a JavaScript consumer.
//!
//! The webview parses result rows with `JSON.parse`, which reads every number
//! as an f64. Integers beyond 2^53 - 1 are silently rounded there, so a
//! snowflake id or a CockroachDB `unique_rowid()` key comes back as a
//! different number and row edits then target the wrong key. Values outside
//! the safe range are sent as strings instead; every write path already
//! accepts string-encoded integers.

use std::fmt::Write;

const MAX_SAFE: i128 = 9_007_199_254_740_991;

fn is_safe(value: i128) -> bool {
    (-MAX_SAFE..=MAX_SAFE).contains(&value)
}

pub(crate) fn i64_to_json(value: i64) -> serde_json::Value {
    if is_safe(value as i128) {
        serde_json::Value::from(value)
    } else {
        serde_json::Value::from(value.to_string())
    }
}

pub(crate) fn u64_to_json(value: u64) -> serde_json::Value {
    if is_safe(value as i128) {
        serde_json::Value::from(value)
    } else {
        serde_json::Value::from(value.to_string())
    }
}

#[cfg(any(feature = "duckdb-engine", test))]
pub(crate) fn i128_to_json(value: i128) -> serde_json::Value {
    if is_safe(value) {
        serde_json::Value::from(value as i64)
    } else {
        serde_json::Value::from(value.to_string())
    }
}

/// Appends an integer to a hand-built JSON buffer, quoted when it is outside
/// the safe range.
pub(crate) fn write_int(buf: &mut String, value: i128) {
    if is_safe(value) {
        let _ = write!(buf, "{value}");
    } else {
        let _ = write!(buf, "\"{value}\"");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safe_integers_stay_numbers() {
        assert_eq!(i64_to_json(42), serde_json::json!(42));
        assert_eq!(
            i64_to_json(-9_007_199_254_740_991),
            serde_json::json!(-9_007_199_254_740_991i64)
        );
        assert_eq!(
            u64_to_json(9_007_199_254_740_991),
            serde_json::json!(9_007_199_254_740_991u64)
        );
    }

    #[test]
    fn unsafe_integers_become_strings() {
        assert_eq!(
            i64_to_json(9_007_199_254_740_993),
            serde_json::json!("9007199254740993")
        );
        assert_eq!(
            u64_to_json(u64::MAX),
            serde_json::json!("18446744073709551615")
        );
        assert_eq!(
            i128_to_json(i128::MAX),
            serde_json::json!(i128::MAX.to_string())
        );
    }

    #[test]
    fn write_int_quotes_only_unsafe_values() {
        let mut buf = String::new();
        write_int(&mut buf, 7);
        buf.push(',');
        write_int(&mut buf, 1_794_855_336_000_000_000);
        assert_eq!(buf, "7,\"1794855336000000000\"");
    }
}
