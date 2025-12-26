/**
 * Tauri command wrappers
 * Re-exports from @/lib/tauri-commands for use in components
 */

export {
    testConnection,
    addConnection,
    updateConnection,
    connectToDatabase,
    disconnectFromDatabase,
    getConnections,
    removeConnection,
    pickSqliteDbDialog,
    saveSqliteDbDialog,
} from '@/lib/tauri-commands'

export type { DatabaseInfo, ConnectionInfo } from '@/types/database'
