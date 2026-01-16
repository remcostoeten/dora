//! Integration tests for the utils module.
//!
//! This module tests utility functions provided by [`app_lib::utils`].
//! These tests verify JSON detection and serialization functionality.
//!
//! # Source Module
//! - [`app_lib::utils`](../src/utils.rs)

use app_lib::utils::{is_json, serialize_as_json_array};

#[test]
fn is_json_detects_valid_objects() {
    assert!(is_json(b"{}"));
    assert!(is_json(b"[]"));
    assert!(is_json(b"{\"key\": \"value\"}"));
    assert!(is_json(b"[1, 2, 3]"));
}

#[test]
fn is_json_rejects_invalid() {
    assert!(!is_json(b"{]"));
    assert!(!is_json(b"{\"a\": 1"));
}

#[test]
fn serialize_as_json_array_works() {
    let items = ["a", "b", "c"];
    let result = serialize_as_json_array(items.iter().copied()).unwrap();
    assert_eq!(serde_json::to_string(&result).unwrap(), r#"["a","b","c"]"#);
}

#[test]
fn serialize_as_json_array_handles_empty() {
    let items: [&str; 0] = [];
    let result = serialize_as_json_array(items.iter().copied()).unwrap();
    assert_eq!(serde_json::to_string(&result).unwrap(), r#"[]"#);
}
