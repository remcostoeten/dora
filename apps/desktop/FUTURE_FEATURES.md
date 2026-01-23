# Future Backend Features

This document outlines the roadmap for backend feature development to transform Dora into a world-class database client.

## 1. Connectivity & Security (Critical)

| Feature                  | Description                                  | Technical Approach                                                                                         |
| :----------------------- | :------------------------------------------- | :--------------------------------------------------------------------------------------------------------- |
| **SSH Tunneling**        | Connect to databases via SSH jump hosts.     | Integreate `libssh2` or `ssh2` crate. Manage local port forwarding dynamically in `ConnectionService`.     |
| **SSL/TLS Certificates** | Full support for client certificates (mTLS). | Enhance `DatabaseInfo` to store/reference cert paths. Use `native-tls` or `rustls`.                        |
| **Connection Pooling**   | Reuse connections to improve performance.    | Implement `deadpool` or `bb8` for Postgres. Important for concurrent queries (Visual Builder + Data Grid). |

## 2. Advanced Data Management

| Feature                 | Description                                                 | Technical Approach                                                                                 |
| :---------------------- | :---------------------------------------------------------- | :------------------------------------------------------------------------------------------------- |
| **Smart Import Wizard** | Stream large CSV/JSON files into tables.                    | Implement streaming parser in Rust. Chunk insertions using `execute_batch`. Handle type inference. |
| **Data Seeding**        | Generate mock data for testing.                             | Integrate `fake` crate. Provide an RPC to "Fill Table" with N rows of realistic data.              |
| **Schema Diffing**      | Compare schema between two environments (e.g. Dev vs Prod). | Fetch schema snapshots from both, compute difference, generate migration SQL.                      |
| **Migration Runner**    | Manage schema changes as code.                              | Simple version tracking table. RPCs to `migrate_up`, `migrate_down`.                               |

## 3. Intelligence & Productivity

| Feature                  | Description                                          | Technical Approach                                                                                    |
| :----------------------- | :--------------------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| **Visual Query Builder** | Backend support for constructing SQL from JSON tree. | Define AST in `types.rs`. Implement AST -> SQL transpiler.                                            |
| **AI Query Copilot**     | Natural language to SQL.                             | Integrate with OpenAI API or local LLM (Ollama). Context-aware prompts with schema info.              |
| **Autocomplete Engine**  | Advanced SQL completion.                             | Use `sqlparser` to understand cursor context (SELECT vs FROM). Return valid table/column suggestions. |

## 4. Operational Features

| Feature                  | Description                                       | Technical Approach                                                                       |
| :----------------------- | :------------------------------------------------ | :--------------------------------------------------------------------------------------- |
| **Session Restoration**  | Restore query tabs and history on restart.        | Expand `save_session_state` to store full workspace snapshot in `sqlite` app database.   |
| **Job Scheduler**        | Run saved queries periodically (e.g. reports).    | Implement simple in-memory cron runner (e.g. `tokio-cron-scheduler`).                    |
| **Multiple Result Sets** | Support complex scripts returning multiple grids. | Update `start_query` to handle multiple result sets (e.g. Postgres multiple statements). |

## 5. Architecture Upgrades

- **Plugin System**: Allow community Rust plugins (WASM?).
- **Remote Server Mode**: Run Dora Backend as a headless HTTP server (Phase 2 of existing plan).
