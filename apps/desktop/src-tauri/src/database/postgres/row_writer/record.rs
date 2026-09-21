use std::error::Error;
use std::fmt::Write;

use bytes::Buf;
use chrono::Utc;
use tokio_postgres::types::{FromSql, Kind, Type};

use super::{interval::PgInterval, numeric::PostgresNumeric};

/// Deserializes record types into a JSON array
/// E.g. `ROW('("fuzzy dice",42,1.99)'` -> `["fuzzy dice", 42, 1.99]`
#[derive(Debug)]
pub struct PgRecord {
    pub json: String,
}

impl<'a> FromSql<'a> for PgRecord {
    fn from_sql(_: &Type, mut raw: &'a [u8]) -> Result<Self, Box<dyn Error + Sync + Send>> {
        ensure_remaining(raw, 4, "record field count")?;
        let field_count = raw.get_i32();
        if field_count < 0 {
            return Err("Invalid record field count".into());
        }

        let field_count = field_count as usize;
        let mut json = String::new();
        json.push('[');

        for field_index in 0..field_count {
            ensure_remaining(raw, 8, "record field header")?;
            let field_oid = raw.get_u32();
            let field_length = raw.get_i32();

            if field_index > 0 {
                json.push(',');
            }

            if field_length == -1 {
                json.push_str("null");
            } else {
                if field_length < 0 {
                    return Err("Invalid record field length".into());
                }

                let field_length = field_length as usize;
                ensure_remaining(raw, field_length, "record field data")?;

                let field_data = &raw[..field_length];
                raw.advance(field_length);

                let pg_type = Type::from_oid(field_oid).unwrap_or(Type::TEXT);
                write_pg_binary_as_json(&mut json, &pg_type, field_data)?;
            }
        }

        json.push(']');
        Ok(PgRecord { json })
    }

    fn accepts(ty: &Type) -> bool {
        matches!(*ty, Type::RECORD)
    }
}

/// Writes one Postgres binary-format value as JSON.
///
/// Covers the scalar types the grid renders natively, plus the shapes that
/// only show up through the type's `Kind` (arrays of any element type, ranges,
/// multiranges, composites, enums and domains). Anything still unknown falls
/// back to UTF-8 text, then hex.
///
/// Values that have no natural JSON counterpart are emitted as their Postgres
/// text form inside a JSON string; composites and arrays become JSON arrays.
pub(super) fn write_pg_binary_as_json(
    out: &mut String,
    pg_type: &Type,
    data: &[u8],
) -> Result<(), Box<dyn Error + Sync + Send>> {
    let mut buf = data;

    match *pg_type {
        Type::BOOL => {
            ensure_remaining(buf, 1, "bool")?;
            let value = buf.get_u8() != 0;
            out.push_str(if value { "true" } else { "false" });
        }

        Type::INT2 => {
            ensure_remaining(buf, 2, "int2")?;
            let value = buf.get_i16();
            write!(out, "{}", value)?;
        }
        Type::INT4 => {
            ensure_remaining(buf, 4, "int4")?;
            let value = buf.get_i32();
            write!(out, "{}", value)?;
        }
        Type::INT8 => {
            ensure_remaining(buf, 8, "int8")?;
            let value = buf.get_i64();
            write!(out, "{}", value)?;
        }

        Type::FLOAT4 => {
            ensure_remaining(buf, 4, "float4")?;
            let value = buf.get_f32();
            if value.is_finite() {
                write!(out, "{}", value)?;
            } else {
                write_json_string(out, &value.to_string());
            }
        }
        Type::FLOAT8 => {
            ensure_remaining(buf, 8, "float8")?;
            let value = buf.get_f64();
            if value.is_finite() {
                write!(out, "{}", value)?;
            } else {
                write_json_string(out, &value.to_string());
            }
        }

        Type::NUMERIC => {
            let value = PostgresNumeric::from_sql(&Type::NUMERIC, data)?;
            write_json_string(out, &value.to_string());
        }
        Type::JSON | Type::JSONB => {
            let value = serde_json::Value::from_sql(pg_type, data)?;
            out.push_str(&value.to_string());
        }
        Type::UUID => {
            let value = uuid::Uuid::from_sql(&Type::UUID, data)?;
            write_json_string(out, &value.to_string());
        }
        Type::TEXT_ARRAY | Type::INT4_ARRAY | Type::INT8_ARRAY => {
            write_pg_array_as_json(out, data, None)?;
        }
        Type::DATE => {
            ensure_remaining(buf, 4, "date")?;
            let days = buf.get_i32();
            let date = match days {
                i32::MAX => "infinity".to_string(),
                i32::MIN => "-infinity".to_string(),
                _ => (pg_epoch_date() + chrono::Duration::days(days as i64)).to_string(),
            };
            write_json_string(out, &date);
        }
        Type::TIME => {
            ensure_remaining(buf, 8, "time")?;
            let microseconds = buf.get_i64();
            write_json_string(out, &format_pg_time(microseconds));
        }
        Type::TIMETZ => {
            ensure_remaining(buf, 12, "timetz")?;
            let microseconds = buf.get_i64();
            let seconds_west_of_utc = buf.get_i32();
            let offset = chrono::FixedOffset::west_opt(seconds_west_of_utc)
                .ok_or("Invalid timetz zone offset")?;
            write_json_string(out, &format!("{}{}", format_pg_time(microseconds), offset));
        }
        Type::POINT => {
            ensure_remaining(buf, 16, "point")?;
            let x = buf.get_f64();
            let y = buf.get_f64();
            write_json_string(out, &format!("({},{})", x, y));
        }
        Type::TS_VECTOR => {
            write_json_string(out, &pg_tsvector_to_text(data)?);
        }
        Type::TSQUERY => {
            write_json_string(out, &pg_tsquery_to_text(data)?);
        }
        Type::MONEY => {
            ensure_remaining(buf, 8, "money")?;
            let value = buf.get_i64();
            write_json_string(out, &format_pg_money(value));
        }
        Type::MACADDR => {
            ensure_remaining(buf, 6, "macaddr")?;
            write_json_string(out, &format_pg_macaddr(&buf[..6]));
        }
        Type::MACADDR8 => {
            ensure_remaining(buf, 8, "macaddr8")?;
            write_json_string(out, &format_pg_macaddr(&buf[..8]));
        }
        Type::INET | Type::CIDR => {
            write_json_string(out, &pg_network_to_text(data)?);
        }
        Type::BIT | Type::VARBIT => {
            write_json_string(out, &pg_bit_string_to_text(data)?);
        }
        Type::XML => {
            write_text_or_hex(out, data);
        }
        Type::OID => {
            ensure_remaining(buf, 4, "oid")?;
            let value = buf.get_u32();
            write!(out, "{}", value)?;
        }
        Type::TIMESTAMP => {
            ensure_remaining(buf, 8, "timestamp")?;
            let microseconds = buf.get_i64();
            let timestamp = pg_epoch_datetime() + chrono::Duration::microseconds(microseconds);
            write_json_string(out, &timestamp.to_string());
        }
        Type::TIMESTAMPTZ => {
            ensure_remaining(buf, 8, "timestamptz")?;
            let microseconds = buf.get_i64();
            let timestamp =
                chrono::DateTime::<Utc>::from_naive_utc_and_offset(pg_epoch_datetime(), Utc)
                    + chrono::Duration::microseconds(microseconds);
            write_json_string(out, &timestamp.to_string());
        }
        Type::INTERVAL => {
            let value = PgInterval::from_sql(&Type::INTERVAL, data)?;
            write_json_string(out, &value.to_string());
        }
        Type::RECORD => {
            let value = PgRecord::from_sql(&Type::RECORD, data)?;
            out.push_str(&value.json);
        }

        Type::TEXT | Type::VARCHAR | Type::BPCHAR | Type::NAME => {
            write_text_or_hex(out, data);
        }

        _ => match pg_type.kind() {
            Kind::Array(element_type) => {
                write_pg_array_as_json(out, data, Some(element_type))?;
            }
            Kind::Range(element_type) => {
                write_json_string(out, &pg_range_to_text(element_type, data)?);
            }
            Kind::Multirange(element_type) => {
                write_json_string(out, &pg_multirange_to_text(element_type, data)?);
            }
            Kind::Composite(_) => {
                let value = PgRecord::from_sql(&Type::RECORD, data)?;
                out.push_str(&value.json);
            }
            Kind::Domain(inner_type) => {
                write_pg_binary_as_json(out, inner_type, data)?;
            }
            Kind::Enum(_) => {
                write_text_or_hex(out, data);
            }
            _ => {
                write_text_or_hex(out, data);
            }
        },
    }

    Ok(())
}

fn write_text_or_hex(out: &mut String, data: &[u8]) {
    match std::str::from_utf8(data) {
        Ok(s) => write_json_string(out, s),
        Err(_) => write_hex_json_string(out, data),
    }
}

fn pg_epoch_date() -> chrono::NaiveDate {
    chrono::NaiveDate::from_ymd_opt(2000, 1, 1).expect("2000-01-01 is a valid date")
}

fn pg_epoch_datetime() -> chrono::NaiveDateTime {
    pg_epoch_date()
        .and_hms_opt(0, 0, 0)
        .expect("midnight is a valid time")
}

fn format_pg_time(microseconds_since_midnight: i64) -> String {
    let total_seconds = microseconds_since_midnight.div_euclid(1_000_000);
    let micros = microseconds_since_midnight.rem_euclid(1_000_000);
    let hours = total_seconds / 3600;
    let minutes = (total_seconds % 3600) / 60;
    let seconds = total_seconds % 60;
    if micros == 0 {
        format!("{:02}:{:02}:{:02}", hours, minutes, seconds)
    } else {
        let fraction = format!("{:06}", micros);
        format!(
            "{:02}:{:02}:{:02}.{}",
            hours,
            minutes,
            seconds,
            fraction.trim_end_matches('0')
        )
    }
}

/// Renders a value the way its Postgres output function would, for the places
/// that embed a text rendering inside a larger text form (range bounds).
///
/// Reuses the JSON writer and unwraps the JSON string quoting when the type
/// already renders as a string, so composite and scalar bounds share one path.
fn pg_binary_to_text(pg_type: &Type, data: &[u8]) -> Result<String, Box<dyn Error + Sync + Send>> {
    let mut json = String::new();
    write_pg_binary_as_json(&mut json, pg_type, data)?;
    match serde_json::from_str::<serde_json::Value>(&json) {
        Ok(serde_json::Value::String(value)) => Ok(value),
        _ => Ok(json),
    }
}

const RANGE_EMPTY: u8 = 0x01;
const RANGE_LB_INC: u8 = 0x02;
const RANGE_UB_INC: u8 = 0x04;
const RANGE_LB_INF: u8 = 0x08;
const RANGE_UB_INF: u8 = 0x10;
const RANGE_LB_NULL: u8 = 0x20;
const RANGE_UB_NULL: u8 = 0x40;

/// Postgres range wire format: a flag byte, then each present bound as an
/// i32 length followed by the bound value in the element type's binary format.
/// An infinite, null or empty bound contributes no bytes at all.
fn pg_range_to_text(
    element_type: &Type,
    data: &[u8],
) -> Result<String, Box<dyn Error + Sync + Send>> {
    let mut raw = data;
    ensure_remaining(raw, 1, "range flags")?;
    let flags = raw.get_u8();

    if flags & RANGE_EMPTY != 0 {
        return Ok("empty".to_string());
    }

    let mut text = String::new();
    text.push(if flags & RANGE_LB_INC != 0 { '[' } else { '(' });
    if flags & (RANGE_LB_INF | RANGE_LB_NULL) == 0 {
        let bound = read_range_bound(&mut raw, element_type, "range lower bound")?;
        text.push_str(&escape_range_bound(&bound));
    }
    text.push(',');
    if flags & (RANGE_UB_INF | RANGE_UB_NULL) == 0 {
        let bound = read_range_bound(&mut raw, element_type, "range upper bound")?;
        text.push_str(&escape_range_bound(&bound));
    }
    text.push(if flags & RANGE_UB_INC != 0 { ']' } else { ')' });
    Ok(text)
}

fn read_range_bound(
    raw: &mut &[u8],
    element_type: &Type,
    context: &'static str,
) -> Result<String, Box<dyn Error + Sync + Send>> {
    ensure_remaining(raw, 4, context)?;
    let length = raw.get_i32();
    if length < 0 {
        return Err(format!("Invalid {} length", context).into());
    }

    let length = length as usize;
    ensure_remaining(raw, length, context)?;
    let bound = &raw[..length];
    raw.advance(length);
    pg_binary_to_text(element_type, bound)
}

fn escape_range_bound(value: &str) -> String {
    let needs_quotes = value.is_empty()
        || value
            .chars()
            .any(|c| matches!(c, '"' | '\\' | '(' | ')' | '[' | ']' | ',') || c.is_whitespace());
    if !needs_quotes {
        return value.to_string();
    }

    let mut escaped = String::with_capacity(value.len() + 2);
    escaped.push('"');
    for c in value.chars() {
        if c == '"' || c == '\\' {
            escaped.push(c);
        }
        escaped.push(c);
    }
    escaped.push('"');
    escaped
}

/// Postgres multirange wire format: an i32 range count, then each range as an
/// i32 length followed by that range's own binary representation.
fn pg_multirange_to_text(
    element_type: &Type,
    data: &[u8],
) -> Result<String, Box<dyn Error + Sync + Send>> {
    let mut raw = data;
    ensure_remaining(raw, 4, "multirange count")?;
    let count = raw.get_i32();
    if count < 0 {
        return Err("Invalid multirange count".into());
    }

    let mut text = String::from("{");
    for index in 0..count {
        if index > 0 {
            text.push(',');
        }

        ensure_remaining(raw, 4, "multirange entry length")?;
        let length = raw.get_i32();
        if length < 0 {
            return Err("Invalid multirange entry length".into());
        }

        let length = length as usize;
        ensure_remaining(raw, length, "multirange entry data")?;
        let entry = &raw[..length];
        raw.advance(length);
        text.push_str(&pg_range_to_text(element_type, entry)?);
    }
    text.push('}');
    Ok(text)
}

/// Postgres tsvector wire format: an i32 lexeme count, then per lexeme a
/// NUL-terminated string, a u16 position count and that many u16 positions.
/// A position packs the weight in its top two bits (3 = A, 2 = B, 1 = C,
/// 0 = the default D, which the text form leaves out).
fn pg_tsvector_to_text(data: &[u8]) -> Result<String, Box<dyn Error + Sync + Send>> {
    let mut raw = data;
    ensure_remaining(raw, 4, "tsvector lexeme count")?;
    let lexeme_count = raw.get_i32();
    if lexeme_count < 0 {
        return Err("Invalid tsvector lexeme count".into());
    }

    let mut text = String::new();
    for lexeme_index in 0..lexeme_count {
        if lexeme_index > 0 {
            text.push(' ');
        }

        let lexeme = read_cstring(&mut raw, "tsvector lexeme")?;
        write_tsearch_quoted(&mut text, &lexeme);

        ensure_remaining(raw, 2, "tsvector position count")?;
        let position_count = raw.get_u16();
        for position_index in 0..position_count {
            ensure_remaining(raw, 2, "tsvector position")?;
            let position = raw.get_u16();
            text.push(if position_index == 0 { ':' } else { ',' });
            write!(text, "{}", position & 0x3fff)?;
            match position >> 14 {
                3 => text.push('A'),
                2 => text.push('B'),
                1 => text.push('C'),
                _ => {}
            }
        }
    }
    Ok(text)
}

const TSQUERY_VALUE: u8 = 1;
const TSQUERY_OPERATOR: u8 = 2;
const TSQUERY_OP_NOT: u8 = 1;
const TSQUERY_OP_AND: u8 = 2;
const TSQUERY_OP_OR: u8 = 3;
const TSQUERY_OP_PHRASE: u8 = 4;
const TSQUERY_MAX_DEPTH: usize = 128;

enum TsQueryNode {
    Value {
        lexeme: String,
        weight: u8,
        prefix: bool,
    },
    Not(Box<TsQueryNode>),
    Binary {
        operator: u8,
        distance: u16,
        left: Box<TsQueryNode>,
        right: Box<TsQueryNode>,
    },
}

/// Postgres tsquery wire format: an i32 node count followed by the nodes in
/// prefix order. A binary operator is followed by its **right** subtree and
/// only then by its left one, which is why the tree is rebuilt before the
/// infix text form can be produced.
fn pg_tsquery_to_text(data: &[u8]) -> Result<String, Box<dyn Error + Sync + Send>> {
    let mut raw = data;
    ensure_remaining(raw, 4, "tsquery node count")?;
    let node_count = raw.get_i32();
    if node_count < 0 {
        return Err("Invalid tsquery node count".into());
    }
    if node_count == 0 {
        return Ok(String::new());
    }

    let root = read_tsquery_node(&mut raw, 0)?;
    let mut text = String::new();
    write_tsquery_node(&mut text, &root, -1, false)?;
    Ok(text)
}

fn read_tsquery_node(
    raw: &mut &[u8],
    depth: usize,
) -> Result<TsQueryNode, Box<dyn Error + Sync + Send>> {
    if depth > TSQUERY_MAX_DEPTH {
        return Err("tsquery nesting too deep".into());
    }

    ensure_remaining(raw, 1, "tsquery node type")?;
    match raw.get_u8() {
        TSQUERY_VALUE => {
            ensure_remaining(raw, 2, "tsquery operand header")?;
            let weight = raw.get_u8();
            let prefix = raw.get_u8() != 0;
            let lexeme = read_cstring(raw, "tsquery operand")?;
            Ok(TsQueryNode::Value {
                lexeme,
                weight,
                prefix,
            })
        }
        TSQUERY_OPERATOR => {
            ensure_remaining(raw, 1, "tsquery operator")?;
            let operator = raw.get_u8();
            if operator == TSQUERY_OP_NOT {
                return Ok(TsQueryNode::Not(Box::new(read_tsquery_node(
                    raw,
                    depth + 1,
                )?)));
            }

            let distance = if operator == TSQUERY_OP_PHRASE {
                ensure_remaining(raw, 2, "tsquery phrase distance")?;
                raw.get_u16()
            } else {
                1
            };
            let right = Box::new(read_tsquery_node(raw, depth + 1)?);
            let left = Box::new(read_tsquery_node(raw, depth + 1)?);
            Ok(TsQueryNode::Binary {
                operator,
                distance,
                left,
                right,
            })
        }
        other => Err(format!("Unrecognized tsquery node type {}", other).into()),
    }
}

fn tsquery_operator_priority(operator: u8) -> i32 {
    match operator {
        TSQUERY_OP_NOT => 4,
        TSQUERY_OP_PHRASE => 3,
        TSQUERY_OP_AND => 2,
        TSQUERY_OP_OR => 1,
        _ => 0,
    }
}

fn write_tsquery_node(
    out: &mut String,
    node: &TsQueryNode,
    parent_priority: i32,
    right_phrase_operand: bool,
) -> Result<(), Box<dyn Error + Sync + Send>> {
    match node {
        TsQueryNode::Value {
            lexeme,
            weight,
            prefix,
        } => {
            write_tsearch_quoted(out, lexeme);
            if *weight != 0 || *prefix {
                out.push(':');
                if *prefix {
                    out.push('*');
                }
                for (bit, label) in [(3, 'A'), (2, 'B'), (1, 'C'), (0, 'D')] {
                    if weight & (1 << bit) != 0 {
                        out.push(label);
                    }
                }
            }
        }
        TsQueryNode::Not(operand) => {
            let priority = tsquery_operator_priority(TSQUERY_OP_NOT);
            let parenthesize = priority < parent_priority;
            if parenthesize {
                out.push_str("( ");
            }
            out.push('!');
            write_tsquery_node(out, operand, priority, false)?;
            if parenthesize {
                out.push_str(" )");
            }
        }
        TsQueryNode::Binary {
            operator,
            distance,
            left,
            right,
        } => {
            let priority = tsquery_operator_priority(*operator);
            let parenthesize = priority < parent_priority
                || (*operator == TSQUERY_OP_PHRASE && right_phrase_operand);
            if parenthesize {
                out.push_str("( ");
            }

            write_tsquery_node(out, left, priority, false)?;
            match *operator {
                TSQUERY_OP_OR => out.push_str(" | "),
                TSQUERY_OP_AND => out.push_str(" & "),
                TSQUERY_OP_PHRASE if *distance == 1 => out.push_str(" <-> "),
                TSQUERY_OP_PHRASE => write!(out, " <{}> ", distance)?,
                other => return Err(format!("Unrecognized tsquery operator {}", other).into()),
            }
            write_tsquery_node(out, right, priority, *operator == TSQUERY_OP_PHRASE)?;

            if parenthesize {
                out.push_str(" )");
            }
        }
    }

    Ok(())
}

fn write_tsearch_quoted(out: &mut String, lexeme: &str) {
    out.push('\'');
    for c in lexeme.chars() {
        if c == '\'' || c == '\\' {
            out.push(c);
        }
        out.push(c);
    }
    out.push('\'');
}

const PGSQL_AF_INET: u8 = 2;
const PGSQL_AF_INET6: u8 = 3;

/// Postgres inet/cidr wire format: address family, netmask bits, a cidr flag
/// and the address byte count, then the raw address. The netmask is only
/// suppressed for an `inet` that covers every bit of its family.
fn pg_network_to_text(data: &[u8]) -> Result<String, Box<dyn Error + Sync + Send>> {
    let mut raw = data;
    ensure_remaining(raw, 4, "network address header")?;
    let family = raw.get_u8();
    let netmask_bits = raw.get_u8();
    let is_cidr = raw.get_u8() != 0;
    let address_length = raw.get_u8() as usize;
    ensure_remaining(raw, address_length, "network address")?;

    let (address, max_bits) = match (family, address_length) {
        (PGSQL_AF_INET, 4) => {
            let mut octets = [0u8; 4];
            octets.copy_from_slice(&raw[..4]);
            (std::net::IpAddr::from(octets).to_string(), 32)
        }
        (PGSQL_AF_INET6, 16) => {
            let mut octets = [0u8; 16];
            octets.copy_from_slice(&raw[..16]);
            (std::net::IpAddr::from(octets).to_string(), 128)
        }
        _ => return Err("Unsupported network address family".into()),
    };

    if !is_cidr && u32::from(netmask_bits) == max_bits {
        Ok(address)
    } else {
        Ok(format!("{}/{}", address, netmask_bits))
    }
}

/// Postgres bit/varbit wire format: an i32 bit count followed by those bits
/// packed most-significant-first, padded to a whole number of bytes.
fn pg_bit_string_to_text(data: &[u8]) -> Result<String, Box<dyn Error + Sync + Send>> {
    let mut raw = data;
    ensure_remaining(raw, 4, "bit string length")?;
    let bit_count = raw.get_i32();
    if bit_count < 0 {
        return Err("Invalid bit string length".into());
    }

    let bit_count = bit_count as usize;
    ensure_remaining(raw, bit_count.div_ceil(8), "bit string data")?;

    let mut text = String::with_capacity(bit_count);
    for index in 0..bit_count {
        let bit = (raw[index / 8] >> (7 - (index % 8))) & 1;
        text.push(if bit == 1 { '1' } else { '0' });
    }
    Ok(text)
}

fn format_pg_money(amount: i64) -> String {
    let sign = if amount < 0 { "-" } else { "" };
    let magnitude = amount.unsigned_abs();
    format!("{}{}.{:02}", sign, magnitude / 100, magnitude % 100)
}

fn format_pg_macaddr(bytes: &[u8]) -> String {
    let mut text = String::with_capacity(bytes.len() * 3);
    for (index, byte) in bytes.iter().enumerate() {
        if index > 0 {
            text.push(':');
        }
        write!(text, "{:02x}", byte).expect("write to String buf");
    }
    text
}

fn read_cstring(
    raw: &mut &[u8],
    context: &'static str,
) -> Result<String, Box<dyn Error + Sync + Send>> {
    let terminator = raw
        .iter()
        .position(|byte| *byte == 0)
        .ok_or_else(|| format!("Unterminated {}", context))?;
    let value = std::str::from_utf8(&raw[..terminator])
        .map_err(|_| format!("Invalid UTF-8 in {}", context))?
        .to_string();
    raw.advance(terminator + 1);
    Ok(value)
}

fn write_pg_array_as_json(
    out: &mut String,
    mut raw: &[u8],
    known_element_type: Option<&Type>,
) -> Result<(), Box<dyn Error + Sync + Send>> {
    ensure_remaining(raw, 12, "array header")?;
    let dimensions = raw.get_i32();
    let _has_null = raw.get_i32();
    let element_oid = raw.get_u32();

    if dimensions < 0 {
        return Err("Invalid array dimensions".into());
    }

    if dimensions == 0 {
        out.push_str("[]");
        return Ok(());
    }

    let dimensions = dimensions as usize;
    let mut lengths = Vec::with_capacity(dimensions);
    for _ in 0..dimensions {
        ensure_remaining(raw, 8, "array dimension")?;
        let length = raw.get_i32();
        let _lower_bound = raw.get_i32();
        if length < 0 {
            return Err("Invalid array dimension length".into());
        }
        lengths.push(length as usize);
    }

    let element_type = known_element_type
        .cloned()
        .or_else(|| Type::from_oid(element_oid))
        .unwrap_or(Type::TEXT);
    write_pg_array_dimension_as_json(out, &mut raw, &lengths, 0, &element_type)
}

fn write_pg_array_dimension_as_json(
    out: &mut String,
    raw: &mut &[u8],
    lengths: &[usize],
    dimension_index: usize,
    element_type: &Type,
) -> Result<(), Box<dyn Error + Sync + Send>> {
    out.push('[');
    for i in 0..lengths[dimension_index] {
        if i > 0 {
            out.push(',');
        }

        if dimension_index + 1 == lengths.len() {
            ensure_remaining(raw, 4, "array element length")?;
            let element_length = raw.get_i32();
            if element_length == -1 {
                out.push_str("null");
                continue;
            }

            if element_length < 0 {
                return Err("Invalid array element length".into());
            }

            let element_length = element_length as usize;
            ensure_remaining(raw, element_length, "array element data")?;
            let element_data = &raw[..element_length];
            raw.advance(element_length);
            write_pg_binary_as_json(out, element_type, element_data)?;
        } else {
            write_pg_array_dimension_as_json(out, raw, lengths, dimension_index + 1, element_type)?;
        }
    }
    out.push(']');
    Ok(())
}

fn write_json_string(out: &mut String, s: &str) {
    out.push('"');
    for ch in s.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if c.is_control() => {
                write!(out, "\\u{:04x}", c as u32).expect("write to String buf");
            }
            c => out.push(c),
        }
    }
    out.push('"');
}

fn write_hex_json_string(out: &mut String, data: &[u8]) {
    out.push('"');
    out.push_str("\\\\x");

    let mut encoded = vec![0; data.len() * 2];
    hex::encode_to_slice(data, &mut encoded).expect("hex output buffer has exact length");
    let encoded = std::str::from_utf8(&encoded).expect("hex output is valid UTF-8");
    out.push_str(encoded);

    out.push('"');
}

fn ensure_remaining(
    buf: &[u8],
    needed: usize,
    context: &'static str,
) -> Result<(), Box<dyn Error + Sync + Send>> {
    if buf.remaining() < needed {
        return Err(format!("Not enough data for {}", context).into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn field(ty: &Type, value: Option<Vec<u8>>) -> (u32, Option<Vec<u8>>) {
        (ty.oid(), value)
    }

    fn record_bytes(fields: Vec<(u32, Option<Vec<u8>>)>) -> Vec<u8> {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&(fields.len() as i32).to_be_bytes());

        for (oid, value) in fields {
            bytes.extend_from_slice(&oid.to_be_bytes());
            match value {
                Some(value) => {
                    bytes.extend_from_slice(&(value.len() as i32).to_be_bytes());
                    bytes.extend_from_slice(&value);
                }
                None => bytes.extend_from_slice(&(-1_i32).to_be_bytes()),
            }
        }

        bytes
    }

    fn hex_to_bytes(hex: &str) -> Vec<u8> {
        (0..hex.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).unwrap())
            .collect()
    }

    fn int4_array(values: &[Option<i32>]) -> Vec<u8> {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&1_i32.to_be_bytes());
        bytes.extend_from_slice(&(values.iter().any(Option::is_none) as i32).to_be_bytes());
        bytes.extend_from_slice(&Type::INT4.oid().to_be_bytes());
        bytes.extend_from_slice(&(values.len() as i32).to_be_bytes());
        bytes.extend_from_slice(&1_i32.to_be_bytes());

        for value in values {
            match value {
                Some(value) => {
                    bytes.extend_from_slice(&4_i32.to_be_bytes());
                    bytes.extend_from_slice(&value.to_be_bytes());
                }
                None => bytes.extend_from_slice(&(-1_i32).to_be_bytes()),
            }
        }

        bytes
    }

    #[test]
    fn record_from_sql_writes_json_array_directly() {
        let nested = record_bytes(vec![field(&Type::BOOL, Some(vec![1]))]);
        let record = record_bytes(vec![
            field(&Type::INT4, Some(42_i32.to_be_bytes().to_vec())),
            field(&Type::TEXT, Some(b"a\"b\n".to_vec())),
            field(&Type::TEXT, None),
            field(
                &Type::NUMERIC,
                Some(hex_to_bytes("0003000100000004000109291a85")),
            ),
            field(
                &Type::INT4_ARRAY,
                Some(int4_array(&[Some(1), None, Some(2)])),
            ),
            field(&Type::RECORD, Some(nested)),
        ]);

        let record = PgRecord::from_sql(&Type::RECORD, &record).unwrap();
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&record.json).unwrap(),
            serde_json::json!([42, "a\"b\n", null, "12345.6789", [1, null, 2], [true]])
        );
    }

    #[test]
    fn truncated_record_returns_error_instead_of_panicking() {
        let err = PgRecord::from_sql(&Type::RECORD, &[0, 0, 0]).unwrap_err();
        assert!(err.to_string().contains("record field count"));
    }
}
