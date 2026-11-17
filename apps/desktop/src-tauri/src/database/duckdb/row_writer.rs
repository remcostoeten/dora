use std::fmt::Write;

use duckdb::types::{TimeUnit, Value, ValueRef};
use duckdb::Row;
use serde_json::value::RawValue;

use crate::utils;

/// Converts raw DuckDB query results into the JSON page format the frontend
/// expects (`Vec<Vec<Json>>`), mirroring the SQLite `RowWriter`.
pub struct RowWriter {
    buf: String,
    row_count: usize,
    column_count: usize,
}

impl RowWriter {
    pub fn new(column_count: usize) -> Self {
        Self {
            buf: String::new(),
            row_count: 0,
            column_count,
        }
    }

    pub fn add_row(&mut self, row: &Row) -> Result<(), anyhow::Error> {
        if self.row_count == 0 {
            self.buf.reserve(2);
            self.buf.push('[');
        }

        if self.row_count > 0 {
            self.buf.push(',');
        }

        self.buf.push('[');
        for i in 0..self.column_count {
            if i > 0 {
                self.buf.push(',');
            }

            match row.get_ref(i)? {
                ValueRef::Null => self.buf.push_str("null"),
                ValueRef::Boolean(value) => write!(&mut self.buf, "{value}")?,
                ValueRef::TinyInt(value) => write!(&mut self.buf, "{value}")?,
                ValueRef::SmallInt(value) => write!(&mut self.buf, "{value}")?,
                ValueRef::Int(value) => write!(&mut self.buf, "{value}")?,
                ValueRef::BigInt(value) => {
                    crate::database::safe_int::write_int(&mut self.buf, value as i128)
                }
                ValueRef::HugeInt(value) => {
                    crate::database::safe_int::write_int(&mut self.buf, value)
                }
                ValueRef::UTinyInt(value) => write!(&mut self.buf, "{value}")?,
                ValueRef::USmallInt(value) => write!(&mut self.buf, "{value}")?,
                ValueRef::UInt(value) => write!(&mut self.buf, "{value}")?,
                ValueRef::UBigInt(value) => {
                    crate::database::safe_int::write_int(&mut self.buf, value as i128)
                }
                ValueRef::Float(value) => self.write_float(value as f64),
                ValueRef::Double(value) => self.write_float(value),
                ValueRef::Decimal(value) => {
                    // rust_decimal renders as a plain numeric literal, valid JSON
                    write!(&mut self.buf, "{value}")?
                }
                ValueRef::Timestamp(unit, value) => {
                    self.write_json_string(&timestamp_to_string(unit, value));
                }
                ValueRef::Date32(days) => {
                    self.write_json_string(&date32_to_string(days));
                }
                ValueRef::Time64(unit, value) => {
                    self.write_json_string(&time64_to_string(unit, value));
                }
                ValueRef::Interval {
                    months,
                    days,
                    nanos,
                } => {
                    self.write_json_string(&interval_to_string(months, days, nanos));
                }
                ValueRef::Text(value) => {
                    // If this is a JSON object or array, pass it through raw so the
                    // frontend JsonInspector picks it up (same as SQLite path)
                    let is_json = val_is_json(value);
                    let Ok(utf8) = std::str::from_utf8(value) else {
                        let utf8_lossy = String::from_utf8_lossy(value);
                        self.write_json_string(&utf8_lossy);
                        continue;
                    };

                    if is_json {
                        self.buf.write_str(utf8)?;
                    } else {
                        self.write_json_string(utf8);
                    }
                }
                ValueRef::Blob(value) => {
                    self.write_json_string(&format!("Blob({})", value.len()));
                }
                // Nested / exotic types (LIST, STRUCT, MAP, ENUM, UNION, ARRAY, …):
                // convert to an owned value and render recursively — never panic.
                other => {
                    let json = owned_value_to_json(&Value::from(other));
                    self.buf.push_str(&serde_json::to_string(&json)?);
                }
            };
        }
        self.buf.push(']');
        self.row_count += 1;

        Ok(())
    }

    pub fn len(&self) -> usize {
        self.row_count
    }

    pub fn is_empty(&self) -> bool {
        self.row_count == 0
    }

    pub fn finish(&mut self) -> Box<RawValue> {
        if self.row_count == 0 {
            self.buf.push('[');
        }
        self.buf.push(']');

        let json = std::mem::take(&mut self.buf);
        self.row_count = 0;

        RawValue::from_string(json).expect("hand-built JSON is valid")
    }

    fn write_float(&mut self, value: f64) {
        if value.is_finite() {
            write!(&mut self.buf, "{value}").expect("write to String buf");
        } else {
            self.write_json_string(&value.to_string());
        }
    }

    fn write_json_string(&mut self, s: &str) {
        self.buf.push('"');
        for ch in s.chars() {
            match ch {
                '"' => self.buf.push_str("\\\""),
                '\\' => self.buf.push_str("\\\\"),
                '\n' => self.buf.push_str("\\n"),
                '\r' => self.buf.push_str("\\r"),
                '\t' => self.buf.push_str("\\t"),
                c if c.is_control() => {
                    write!(&mut self.buf, "\\u{:04x}", c as u32).expect("write to String buf");
                }
                c => self.buf.push(c),
            }
        }
        self.buf.push('"');
    }
}

/// Convert any DuckDB value reference into a `serde_json::Value`. Used by the
/// watch/live-monitor paths and as the fallback for nested types.
pub(crate) fn value_ref_to_json(value: ValueRef<'_>) -> serde_json::Value {
    match value {
        ValueRef::Null => serde_json::Value::Null,
        ValueRef::Boolean(v) => serde_json::Value::from(v),
        ValueRef::TinyInt(v) => serde_json::Value::from(v),
        ValueRef::SmallInt(v) => serde_json::Value::from(v),
        ValueRef::Int(v) => serde_json::Value::from(v),
        ValueRef::BigInt(v) => crate::database::safe_int::i64_to_json(v),
        ValueRef::HugeInt(v) => crate::database::safe_int::i128_to_json(v),
        ValueRef::UTinyInt(v) => serde_json::Value::from(v),
        ValueRef::USmallInt(v) => serde_json::Value::from(v),
        ValueRef::UInt(v) => serde_json::Value::from(v),
        ValueRef::UBigInt(v) => crate::database::safe_int::u64_to_json(v),
        ValueRef::Float(v) => serde_json::Value::from(v),
        ValueRef::Double(v) => serde_json::Value::from(v),
        ValueRef::Decimal(v) => serde_json::Value::from(v.to_string()),
        ValueRef::Timestamp(unit, v) => serde_json::Value::from(timestamp_to_string(unit, v)),
        ValueRef::Date32(days) => serde_json::Value::from(date32_to_string(days)),
        ValueRef::Time64(unit, v) => serde_json::Value::from(time64_to_string(unit, v)),
        ValueRef::Interval {
            months,
            days,
            nanos,
        } => serde_json::Value::from(interval_to_string(months, days, nanos)),
        ValueRef::Text(v) => serde_json::Value::from(String::from_utf8_lossy(v).to_string()),
        ValueRef::Blob(v) => serde_json::Value::from(format!("Blob({})", v.len())),
        other => owned_value_to_json(&Value::from(other)),
    }
}

fn owned_value_to_json(value: &Value) -> serde_json::Value {
    match value {
        Value::Null => serde_json::Value::Null,
        Value::Boolean(v) => serde_json::Value::from(*v),
        Value::TinyInt(v) => serde_json::Value::from(*v),
        Value::SmallInt(v) => serde_json::Value::from(*v),
        Value::Int(v) => serde_json::Value::from(*v),
        Value::BigInt(v) => crate::database::safe_int::i64_to_json(*v),
        Value::HugeInt(v) => crate::database::safe_int::i128_to_json(*v),
        Value::UTinyInt(v) => serde_json::Value::from(*v),
        Value::USmallInt(v) => serde_json::Value::from(*v),
        Value::UInt(v) => serde_json::Value::from(*v),
        Value::UBigInt(v) => crate::database::safe_int::u64_to_json(*v),
        Value::Float(v) => serde_json::Value::from(*v),
        Value::Double(v) => serde_json::Value::from(*v),
        Value::Decimal(v) => serde_json::Value::from(v.to_string()),
        Value::Timestamp(unit, v) => serde_json::Value::from(timestamp_to_string(*unit, *v)),
        Value::Date32(days) => serde_json::Value::from(date32_to_string(*days)),
        Value::Time64(unit, v) => serde_json::Value::from(time64_to_string(*unit, *v)),
        Value::Interval {
            months,
            days,
            nanos,
        } => serde_json::Value::from(interval_to_string(*months, *days, *nanos)),
        Value::Text(v) => serde_json::Value::from(v.clone()),
        Value::Blob(v) => serde_json::Value::from(format!("Blob({})", v.len())),
        Value::List(items) | Value::Array(items) => {
            serde_json::Value::Array(items.iter().map(owned_value_to_json).collect())
        }
        Value::Enum(v) => serde_json::Value::from(v.clone()),
        Value::Struct(fields) => serde_json::Value::Object(
            fields
                .iter()
                .map(|(key, val)| (key.clone(), owned_value_to_json(val)))
                .collect(),
        ),
        Value::Map(entries) => serde_json::Value::Object(
            entries
                .iter()
                .map(|(key, val)| {
                    let key = match owned_value_to_json(key) {
                        serde_json::Value::String(s) => s,
                        other => other.to_string(),
                    };
                    (key, owned_value_to_json(val))
                })
                .collect(),
        ),
        Value::Union(inner) => owned_value_to_json(inner),
    }
}

fn timestamp_to_string(unit: TimeUnit, value: i64) -> String {
    let (secs, nanos) = match unit {
        TimeUnit::Second => (value, 0i64),
        TimeUnit::Millisecond => (value.div_euclid(1_000), value.rem_euclid(1_000) * 1_000_000),
        TimeUnit::Microsecond => (
            value.div_euclid(1_000_000),
            value.rem_euclid(1_000_000) * 1_000,
        ),
        TimeUnit::Nanosecond => (
            value.div_euclid(1_000_000_000),
            value.rem_euclid(1_000_000_000),
        ),
    };

    chrono::DateTime::from_timestamp(secs, nanos as u32)
        .map(|dt| dt.naive_utc().to_string())
        .unwrap_or_else(|| value.to_string())
}

fn date32_to_string(days: i32) -> String {
    chrono::DateTime::from_timestamp(i64::from(days) * 86_400, 0)
        .map(|dt| dt.date_naive().to_string())
        .unwrap_or_else(|| days.to_string())
}

fn time64_to_string(unit: TimeUnit, value: i64) -> String {
    let micros = match unit {
        TimeUnit::Second => value.saturating_mul(1_000_000),
        TimeUnit::Millisecond => value.saturating_mul(1_000),
        TimeUnit::Microsecond => value,
        TimeUnit::Nanosecond => value / 1_000,
    };

    let secs = micros.div_euclid(1_000_000);
    let sub_micros = micros.rem_euclid(1_000_000);
    let (hours, mins, seconds) = (secs / 3600, (secs % 3600) / 60, secs % 60);

    if sub_micros == 0 {
        format!("{hours:02}:{mins:02}:{seconds:02}")
    } else {
        format!("{hours:02}:{mins:02}:{seconds:02}.{sub_micros:06}")
    }
}

fn interval_to_string(months: i32, days: i32, nanos: i64) -> String {
    format!("{months} months {days} days {} us", nanos / 1_000)
}

#[inline]
fn val_is_json(value: &[u8]) -> bool {
    let looks_like_json = (value.starts_with(b"[") && value.ends_with(b"]"))
        || (value.starts_with(b"{") && value.ends_with(b"}"));
    looks_like_json && utils::is_json(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use duckdb::Connection;
    use serde_json::Value as Json;

    fn query_json(conn: &Connection, sql: &str) -> Json {
        let mut stmt = conn.prepare(sql).unwrap();
        let mut rows = stmt.query([]).unwrap();
        let column_count = rows.as_ref().unwrap().column_count();
        let mut writer = RowWriter::new(column_count);

        while let Some(row) = rows.next().unwrap() {
            writer.add_row(row).unwrap();
        }

        serde_json::from_str(writer.finish().get()).unwrap()
    }

    #[test]
    fn basic_scalar_types() {
        let conn = Connection::open_in_memory().unwrap();
        let result = query_json(
            &conn,
            "SELECT 42::INTEGER, 3.5::DOUBLE, 'hello', TRUE, NULL",
        );
        assert_eq!(result, serde_json::json!([[42, 3.5, "hello", true, null]]));
    }

    #[test]
    fn big_integers_keep_precision() {
        let conn = Connection::open_in_memory().unwrap();
        let result = query_json(
            &conn,
            "SELECT 170141183460469231731687303715884105727::HUGEINT",
        );
        assert_eq!(
            result,
            serde_json::json!([["170141183460469231731687303715884105727"]])
        );
    }

    #[test]
    fn temporal_types_render_as_strings() {
        let conn = Connection::open_in_memory().unwrap();
        let result = query_json(
            &conn,
            "SELECT DATE '2024-01-15', TIMESTAMP '2024-01-15 10:30:00'",
        );
        assert_eq!(
            result,
            serde_json::json!([["2024-01-15", "2024-01-15 10:30:00"]])
        );
    }

    #[test]
    fn nested_types_render_as_json() {
        let conn = Connection::open_in_memory().unwrap();
        let result = query_json(&conn, "SELECT [1, 2, 3], {'a': 1, 'b': 'x'}");
        assert_eq!(result, serde_json::json!([[[1, 2, 3], {"a": 1, "b": "x"}]]));
    }

    #[test]
    fn json_text_passes_through_raw() {
        let conn = Connection::open_in_memory().unwrap();
        let result = query_json(&conn, "SELECT '{\"key\": \"value\"}'");
        assert_eq!(result, serde_json::json!([[{"key": "value"}]]));
    }

    #[test]
    fn multiple_rows_and_empty_results() {
        let conn = Connection::open_in_memory().unwrap();
        let result = query_json(&conn, "SELECT * FROM (VALUES (1, 'a'), (2, 'b')) t(n, s)");
        assert_eq!(result, serde_json::json!([[1, "a"], [2, "b"]]));

        let result = query_json(&conn, "SELECT 1 WHERE 1 = 0");
        assert_eq!(result, serde_json::json!([]));
    }
}
