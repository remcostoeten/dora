use tauri::State;
use uuid::Uuid;

use crate::{
    database::live_monitor::{LiveMonitorChangeType, LiveMonitorSession},
    error::Error,
};

#[tauri::command]
#[specta::specta]
pub async fn start_live_monitor(
    connection_id: Uuid,
    table_name: String,
    interval_ms: u64,
    change_types: Vec<LiveMonitorChangeType>,
    live_monitor: State<'_, crate::database::LiveMonitorManager>,
) -> Result<LiveMonitorSession, Error> {
    live_monitor.stop_monitor_for_table(connection_id, &table_name);
    live_monitor.start_monitor(connection_id, table_name, interval_ms, change_types)
}

#[tauri::command]
#[specta::specta]
pub async fn stop_live_monitor(
    monitor_id: String,
    live_monitor: State<'_, crate::database::LiveMonitorManager>,
) -> Result<(), Error> {
    live_monitor.stop_monitor(&monitor_id);
    Ok(())
}
