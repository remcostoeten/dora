# Dora Desktop - Release v1.0 Task List & Specifications

This document outlines the critical features and improvements required to make Dora Desktop ready for a v1.0 release. It serves as a handover specification for development agents.

## 🚨 Technical Debt / Blockers

- [ ] **Fix Dev Server Port Conflict**
  - **Issue:** `turbo dev` fails with `Port 1420 is already in use`.
  - **Action:** Ensure Tauri or Vite process cleans up correctly, or configure a dynamic port.

---

## 🚀 Feature Checklist

### 1. SSH Tunneling (Security)
**Priority:** Critical
**Backend Support:** `DatabaseInfo.Postgres.ssh_config` (Stubbed in `connection-dialog.tsx` line 193).
**Files:** `src/features/connections/components/connection-dialog.tsx`

**Specification:**
1.  **UI Update:**
    - Add an "SSH Tunnel" toggle or tab in the `Postgres` / `MySQL` form sections.
    - Fields needed:
        - `SSH Host` (string, required if enabled)
        - `SSH Port` (number, default 22)
        - `SSH Username` (string, required)
        - `Authentication Method`: "Password" or "Key File".
        - `SSH Password / Passphrase` (password input).
        - `Private Key Path` (file picker).
2.  **Implementation:**
    - Update `formData` state to include `sshConfig`.
    - Map fields to the `SshConfig` type defined in `bindings.ts`.
    - Pass this populated object in `handleTestConnection` and `onSave`.

### 2. Schema Management (DDL)
**Priority:** High
**Backend Support:** `executeBatch` is available. Specific DDL commands might need raw SQL generation.
**Files:** `src/features/database-studio/**`

**Specification:**
1.  **Structure View Actions:**
    - In "Structure" view (`ViewMode.Structure`), add action buttons: "Add Column", "Drop Table".
2.  **Modals:**
    - **Add Column Dialog**: Inputs for Name, Type (dropdown), Nullable, Default Value.
    - **Create Table Dialog**: (Accessible from Sidebar "+"). Define Table Name and initial columns.
3.  **Logic:**
    - Since there isn't a direct `create_column` command in `commands`, construct the raw SQL `ALTER TABLE ... ADD COLUMN ...` and execute it via `commands.executeBatch` or `commands.startQuery`.

### 3. Advanced Export
**Priority:** Medium
**Backend Support:** `commands.exportTable(connectionId, tableName, schemaName, format, limit)`
**Files:** `src/features/database-studio/components/studio-toolbar.tsx`

**Specification:**
1.  **UI Update:**
    - Change the `Download` button in the toolbar to a `DropdownMenu`.
    - Options: "Export as JSON", "Export as CSV", "Export as SQL Insert".
2.  **Implementation:**
    - **JSON**: Keep existing client-side logic (for "Current View") OR add "Export Full JSON" using backend.
    - **CSV/SQL**: Call `commands.exportTable` with `format: "csv"` or `"sql_insert"`.
    - Handle the response: The command returns a `file_path` or content. If path, show "Exported to..." toast.

### 4. AI Query Copilot
**Priority:** Medium (Differentiator)
**Backend Support:** `commands.aiComplete(prompt, connectionId, maxTokens)`
**Files:** `src/features/sql-console/**`, `src/features/sql-console/components/console-toolbar.tsx`

**Specification:**
1.  **UI Update:**
    - Add an "✨ Ask AI" button to `ConsoleToolbar`.
    - Opens a small popover or input bar above the editor.
2.  **Interaction:**
    - User types: "Show me top 5 users by spend"
    - Frontend calls `commands.aiComplete`.
    - **Response handling**: The result contains `content` (SQL). Insert this SQL into the Monaco Editor at cursor position.

### 5. Data Seeding
**Priority:** Low (Dev Tool)
**Backend Support:** `commands.seedTable(connectionId, tableName, schemaName, count)`
**Files:** `src/features/sidebar/components/sidebar-context-menu.tsx` (or similar)

**Specification:**
1.  **Context Menu:**
    - Add "Seed Data..." option when right-clicking a table in the Sidebar.
2.  **Dialog:**
    - Simple Prompt: "Number of rows to generate:" (Default 100).
3.  **Implementation:**
    - Call `commands.seedTable`.
    - On success, trigger `onRefresh` for the grid.

### 6. Database Dump/Restore
**Priority:** Low
**Backend Support:** `commands.dumpDatabase`
**Files:** `src/features/sidebar/components/bottom-toolbar.tsx` or Connection Context Menu.

**Specification:**
1.  Add "Backup Database" option to the connection context menu.
2.  Use Tauri's `save` dialog to pick a destination path.
3.  Call `commands.dumpDatabase`.

---

## 📜 Reference: Relevant Bindings
(Verify these in `src/lib/bindings.ts`)

```typescript
// SSH Config Structure
export type SshConfig = { 
    host: string; 
    port: number; 
    username: string; 
    private_key_path: string | null; 
    password: string | null 
}

// Export
async exportTable(..., format: "json" | "sql_insert" | "csv", ...)

// AI
async aiComplete(prompt: string, ...)

// Seeding
async seedTable(..., count: number)
```
