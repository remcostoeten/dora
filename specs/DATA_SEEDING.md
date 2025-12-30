# Feature Spec: Data Seeding

## 1. Overview
The Data Seeding feature allows users to quickly populate database tables with realistic mock data (e.g., names, emails, dates) for testing and development purposes.

## 2. User Story
As a developer, I want to right-click a table and select "Generate Mock Data" so that I can test my application with realistic volume without manually typing rows.

## 3. Technical Requirements

### 3.1 Backend
- **New Command**: `seed_table(connection_id: Uuid, table_name: String, count: u32)`
- **Logic**:
  - Inspect table schema (column types, names).
  - Map column names/types to `fake` crate generators (e.g., "email" -> `Faker(Name)`).
  - Handle Foreign Key constraints (optional/advanced: fetch valid IDs from parent?). *MVP: Skip FK columns or use null.*
  - Generate SQL `INSERT` statements in batches.
  - Execute via `MutationService`.

### 3.2 Frontend (UI/UX)
- **Entry Point**: Context menu on Table in Sidebar -> "Seed Data".
- **Modal**:
  - **Input**: Number of rows (default 100).
  - **Preview**: Show 3-5 rows of what will be generated.
  - **Action**: "Generate".
- **Feedback**: Progress bar or Loading spinner. Success toast.

## 4. Stability
- **Tag**: `Experimental` initially.
- **Safety**: Should strictly warn or disable on Production connections (if we have environment tagging).

## 5. Test Plan
- **Unit**: Verify `faker` mapping works for all supported Types (Text, Int, Boolean, Timestamp).
- **Integration**: Seed a SQLite table with 1000 rows, verify count.
