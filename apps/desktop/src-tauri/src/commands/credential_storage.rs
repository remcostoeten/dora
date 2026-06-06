use crate::credential_storage::CredentialStorageStatus;

#[tauri::command]
#[specta::specta]
pub fn get_credential_storage_status() -> CredentialStorageStatus {
    crate::credential_storage::status()
}
