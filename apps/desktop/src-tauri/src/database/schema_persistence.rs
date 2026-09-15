//! Disk mirror for introspected schemas.
//!
//! The in-process schema cache (`AppState.schemas`) is what makes repeat
//! fetches instant, but it is empty on every app launch — which is exactly
//! when a skeleton sidebar hurts most. This module mirrors introspected
//! schemas into the storage SQLite so `bootstrap` can hand the renderer a
//! stale-but-paintable schema before the first connection is even opened.
//!
//! Privacy contract: snapshots are AES-256-GCM encrypted at rest (the same
//! `security::encrypt` used for saved connection data) and the mirror obeys
//! the same settings as the localStorage row-snapshot mirror — off when
//! `persistTableSnapshots` is disabled or `privacyMaskData` is on. Turning
//! the mirror off wipes what is stored; see [`clear_if_disabled`].
//!
//! Persistence is strictly best-effort: a failed write or delete is logged and
//! never fails the surrounding command. Every site that invalidates the
//! in-memory cache for a *content* reason (DDL, config change, connection
//! removal) must also call [`forget_schema`]; a plain disconnect must not.

use uuid::Uuid;

use crate::database::types::DatabaseSchema;
use crate::storage::Storage;

const UI_SETTINGS_KEY: &str = "ui_settings";

/// Mirrors the gating logic of the renderer's `initTableSnapshotPersistence`:
/// `persistTableSnapshots` (default on) and force-off under `privacyMaskData`.
/// A missing or unreadable settings document means the defaults apply.
pub fn mirror_enabled(storage: &Storage) -> bool {
    let doc = match storage.get_setting(UI_SETTINGS_KEY) {
        Ok(Some(doc)) => doc,
        Ok(None) => return true,
        Err(error) => {
            tracing::warn!("Failed to read settings for the schema mirror: {error}");
            return true;
        }
    };
    let Ok(settings) = serde_json::from_str::<serde_json::Value>(&doc) else {
        return true;
    };
    let persist = settings
        .get("persistTableSnapshots")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(true);
    let mask = settings
        .get("privacyMaskData")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(false);
    persist && !mask
}

pub fn persist_schema(storage: &Storage, connection_id: Uuid, schema: &DatabaseSchema) {
    if !mirror_enabled(storage) {
        return;
    }
    let json = match serde_json::to_string(schema) {
        Ok(json) => json,
        Err(error) => {
            tracing::warn!("Failed to serialize schema snapshot for {connection_id}: {error}");
            return;
        }
    };
    let encrypted = match crate::security::encrypt(&json) {
        Ok(encrypted) => encrypted,
        Err(error) => {
            tracing::warn!("Failed to encrypt schema snapshot for {connection_id}: {error}");
            return;
        }
    };
    if let Err(error) = storage.put_schema_snapshot(connection_id, &encrypted) {
        tracing::warn!("Failed to persist schema snapshot for {connection_id}: {error}");
    }
}

/// Decrypts and parses one stored snapshot. `None` (never an error) when the
/// row cannot be recovered — the caller should drop the row via
/// [`forget_schema`] so it is not retried forever.
pub fn decode_schema(connection_id: Uuid, encrypted: &str) -> Option<DatabaseSchema> {
    let json = match crate::security::decrypt(encrypted) {
        Ok(json) => json,
        Err(error) => {
            tracing::warn!("Failed to decrypt schema snapshot for {connection_id}: {error}");
            return None;
        }
    };
    match serde_json::from_str::<DatabaseSchema>(&json) {
        Ok(schema) => Some(schema),
        Err(error) => {
            tracing::warn!("Dropping unreadable schema snapshot for {connection_id}: {error}");
            None
        }
    }
}

pub fn forget_schema(storage: &Storage, connection_id: Uuid) {
    if let Err(error) = storage.delete_schema_snapshot(connection_id) {
        tracing::warn!("Failed to delete schema snapshot for {connection_id}: {error}");
    }
}

/// Wipes the mirror when the gating settings turn it off. Called wherever the
/// settings document is written, so a privacy toggle takes effect immediately
/// rather than at the next boot.
pub fn clear_if_disabled(storage: &Storage) {
    if mirror_enabled(storage) {
        return;
    }
    if let Err(error) = storage.delete_all_schema_snapshots() {
        tracing::warn!("Failed to clear schema snapshots: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::{clear_if_disabled, mirror_enabled, UI_SETTINGS_KEY};
    use crate::storage::Storage;
    use uuid::Uuid;

    fn temp_storage() -> Storage {
        let path =
            std::env::temp_dir().join(format!("dora-schema-mirror-{}.sqlite", Uuid::new_v4()));
        Storage::new(path).expect("storage should initialize")
    }

    #[test]
    fn mirror_defaults_on_without_a_settings_document() {
        let storage = temp_storage();
        assert!(mirror_enabled(&storage));
    }

    #[test]
    fn mirror_follows_the_renderer_gating_settings() {
        let storage = temp_storage();

        storage
            .set_setting(UI_SETTINGS_KEY, r#"{"persistTableSnapshots":false}"#)
            .unwrap();
        assert!(!mirror_enabled(&storage));

        storage
            .set_setting(
                UI_SETTINGS_KEY,
                r#"{"persistTableSnapshots":true,"privacyMaskData":true}"#,
            )
            .unwrap();
        assert!(!mirror_enabled(&storage));

        storage
            .set_setting(
                UI_SETTINGS_KEY,
                r#"{"persistTableSnapshots":true,"privacyMaskData":false}"#,
            )
            .unwrap();
        assert!(mirror_enabled(&storage));

        storage.set_setting(UI_SETTINGS_KEY, "not json").unwrap();
        assert!(mirror_enabled(&storage));
    }

    #[test]
    fn disabling_the_mirror_wipes_stored_snapshots() {
        let storage = temp_storage();
        storage
            .put_schema_snapshot(Uuid::new_v4(), "encrypted")
            .unwrap();

        clear_if_disabled(&storage);
        assert_eq!(storage.get_schema_snapshots().unwrap().len(), 1);

        storage
            .set_setting(UI_SETTINGS_KEY, r#"{"privacyMaskData":true}"#)
            .unwrap();
        clear_if_disabled(&storage);
        assert!(storage.get_schema_snapshots().unwrap().is_empty());
    }
}
