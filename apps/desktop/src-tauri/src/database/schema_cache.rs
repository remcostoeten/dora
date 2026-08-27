//! In-place patches for the cached `Arc<DatabaseSchema>`.
//!
//! Plain DML changes row counts, never structure, so mutation paths patch the
//! affected table's `row_count_estimate` instead of dropping the whole schema
//! entry — dropping it forces a full re-introspection (and, on the engines
//! without cheap estimates, a background count storm) after every single cell
//! edit.

use std::sync::Arc;

use dashmap::DashMap;
use uuid::Uuid;

use crate::database::types::DatabaseSchema;

#[derive(Clone, Copy, Debug)]
pub enum RowCountDelta {
    Add(i64),
    Zero,
}

/// Adjusts one table's row-count estimate in the cached schema. A `None`
/// estimate stays `None` under `Add` (the true count is unknown; the background
/// refresher owns filling it in), while `Zero` always pins it to `Some(0)`.
/// Missing connection or table is a no-op.
pub fn patch_row_count(
    schemas: &DashMap<Uuid, Arc<DatabaseSchema>>,
    connection_id: Uuid,
    table_name: &str,
    schema_name: Option<&str>,
    delta: RowCountDelta,
) {
    schemas.alter(&connection_id, |_, old| {
        let mut patched = (*old).clone();
        let table = patched.tables.iter_mut().find(|table| {
            table.name == table_name
                && schema_name
                    .map(|schema| table.schema == schema)
                    .unwrap_or(true)
        });
        if let Some(table) = table {
            table.row_count_estimate = match (delta, table.row_count_estimate) {
                (RowCountDelta::Zero, _) => Some(0),
                (RowCountDelta::Add(delta), Some(current)) => {
                    Some((current as i64).saturating_add(delta).max(0) as u64)
                }
                (RowCountDelta::Add(_), None) => None,
            };
        }
        Arc::new(patched)
    });
}

/// Pins every table's estimate to zero — the truncate-database case, where
/// structure is untouched but every table is now empty.
pub fn zero_all_row_counts(schemas: &DashMap<Uuid, Arc<DatabaseSchema>>, connection_id: Uuid) {
    schemas.alter(&connection_id, |_, old| {
        let mut patched = (*old).clone();
        for table in &mut patched.tables {
            table.row_count_estimate = Some(0);
        }
        Arc::new(patched)
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::types::TableInfo;

    fn schemas_with(
        connection_id: Uuid,
        tables: Vec<(&str, &str, Option<u64>)>,
    ) -> DashMap<Uuid, Arc<DatabaseSchema>> {
        let map = DashMap::new();
        map.insert(
            connection_id,
            Arc::new(DatabaseSchema {
                tables: tables
                    .into_iter()
                    .map(|(name, schema, estimate)| TableInfo {
                        name: name.to_string(),
                        schema: schema.to_string(),
                        columns: Vec::new(),
                        primary_key_columns: Vec::new(),
                        row_count_estimate: estimate,
                        indexes: Vec::new(),
                    })
                    .collect(),
                schemas: Vec::new(),
                unique_columns: Vec::new(),
            }),
        );
        map
    }

    fn estimate(
        schemas: &DashMap<Uuid, Arc<DatabaseSchema>>,
        connection_id: Uuid,
        table: &str,
    ) -> Option<u64> {
        schemas
            .get(&connection_id)
            .and_then(|schema| {
                schema
                    .tables
                    .iter()
                    .find(|t| t.name == table)
                    .map(|t| t.row_count_estimate)
            })
            .flatten()
    }

    #[test]
    fn add_and_subtract() {
        let id = Uuid::new_v4();
        let schemas = schemas_with(id, vec![("users", "public", Some(10))]);
        patch_row_count(&schemas, id, "users", Some("public"), RowCountDelta::Add(1));
        assert_eq!(estimate(&schemas, id, "users"), Some(11));
        patch_row_count(
            &schemas,
            id,
            "users",
            Some("public"),
            RowCountDelta::Add(-5),
        );
        assert_eq!(estimate(&schemas, id, "users"), Some(6));
    }

    #[test]
    fn subtract_saturates_at_zero() {
        let id = Uuid::new_v4();
        let schemas = schemas_with(id, vec![("users", "public", Some(2))]);
        patch_row_count(
            &schemas,
            id,
            "users",
            Some("public"),
            RowCountDelta::Add(-10),
        );
        assert_eq!(estimate(&schemas, id, "users"), Some(0));
    }

    #[test]
    fn add_on_unknown_estimate_stays_unknown() {
        let id = Uuid::new_v4();
        let schemas = schemas_with(id, vec![("users", "public", None)]);
        patch_row_count(&schemas, id, "users", Some("public"), RowCountDelta::Add(1));
        assert_eq!(estimate(&schemas, id, "users"), None);
    }

    #[test]
    fn zero_pins_even_unknown() {
        let id = Uuid::new_v4();
        let schemas = schemas_with(id, vec![("users", "public", None)]);
        patch_row_count(&schemas, id, "users", Some("public"), RowCountDelta::Zero);
        assert_eq!(estimate(&schemas, id, "users"), Some(0));
    }

    #[test]
    fn missing_table_and_connection_are_noops() {
        let id = Uuid::new_v4();
        let schemas = schemas_with(id, vec![("users", "public", Some(3))]);
        patch_row_count(&schemas, id, "ghost", None, RowCountDelta::Add(1));
        patch_row_count(
            &schemas,
            Uuid::new_v4(),
            "users",
            None,
            RowCountDelta::Add(1),
        );
        assert_eq!(estimate(&schemas, id, "users"), Some(3));
    }

    #[test]
    fn schema_qualifier_disambiguates() {
        let id = Uuid::new_v4();
        let schemas = schemas_with(id, vec![("users", "a", Some(1)), ("users", "b", Some(1))]);
        patch_row_count(&schemas, id, "users", Some("b"), RowCountDelta::Add(4));
        assert_eq!(
            schemas
                .get(&id)
                .map(|s| (
                    s.tables[0].row_count_estimate,
                    s.tables[1].row_count_estimate
                ))
                .unwrap(),
            (Some(1), Some(5))
        );
    }

    #[test]
    fn zero_all_covers_every_table() {
        let id = Uuid::new_v4();
        let schemas = schemas_with(id, vec![("a", "public", Some(9)), ("b", "public", None)]);
        zero_all_row_counts(&schemas, id);
        assert_eq!(estimate(&schemas, id, "a"), Some(0));
        assert_eq!(estimate(&schemas, id, "b"), Some(0));
    }
}
