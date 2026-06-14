//! Runtime SQL dialect detection and source capability gating.
//!
//! Dora routes CockroachDB through the Postgres wire protocol and MariaDB
//! through the MySQL wire protocol. The two engines are wire-compatible but
//! differ in features (e.g. CockroachDB has no `LISTEN`/`NOTIFY`). At connect
//! time we run a `version()` query and detect the *true* engine so that the
//! rest of the app can branch where it matters.
//!
//! The detection functions here are intentionally pure (string -> enum) so they
//! can be unit-tested without a live database. Everything that needs a live
//! cluster (schema introspection, type mapping) is explicitly deferred — see
//! the `TODO(dialect-parity)` markers.

use serde::Serialize;
use specta::Type;

/// Concrete engine behind a Postgres-wire connection.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum PgDialect {
    /// Vanilla PostgreSQL (the default / safe path).
    #[default]
    Postgres,
    /// CockroachDB speaking the Postgres wire protocol.
    CockroachDb,
}

impl PgDialect {
    /// Source capabilities for this dialect.
    ///
    /// Resolution layers (per the data-source spec): model defaults → engine
    /// overrides → dialect overrides. For now the engine default is vanilla
    /// Postgres and only CockroachDB diverges (no LISTEN/NOTIFY).
    pub const fn caps(self) -> SourceCaps {
        SourceCaps::for_dialect(self.detected())
    }

    /// The unified `DetectedDialect` tag for this Postgres-wire dialect.
    pub const fn detected(self) -> DetectedDialect {
        match self {
            PgDialect::Postgres => DetectedDialect::Postgres,
            PgDialect::CockroachDb => DetectedDialect::CockroachDb,
        }
    }

    /// Introspection-query overrides for this dialect.
    ///
    /// Returns the catalog query strings `postgres/schema.rs` runs. Vanilla
    /// Postgres gets [`PgIntrospection::VANILLA`]; CockroachDB gets
    /// [`PgIntrospection::COCKROACH`], which overrides only the queries that
    /// diverge from vanilla `pg_catalog`/`information_schema` semantics.
    pub const fn introspection(self) -> PgIntrospection {
        match self {
            PgDialect::Postgres => PgIntrospection::VANILLA,
            PgDialect::CockroachDb => PgIntrospection::COCKROACH,
        }
    }
}

/// Per-dialect Postgres introspection query overrides.
///
/// One `&'static str` per catalog query that `postgres/schema.rs` runs. The
/// vanilla descriptor holds the canonical queries (the single source of truth);
/// each dialect descriptor is built by cloning vanilla and replacing only the
/// fields whose vanilla query fails or returns wrong/empty results against that
/// engine. This keeps divergences explicit and auditable, and is the same shape
/// `MySqlIntrospection` will grow.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PgIntrospection {
    /// Tables + columns + primary-key + auto-increment detection.
    pub tables_columns: &'static str,
    /// Foreign-key edges: (schema, table, column) -> referenced (schema, table, column).
    pub foreign_keys: &'static str,
    /// Indexes: (schema, table, index name, index definition).
    pub indexes: &'static str,
    /// Per-table estimated live-row counts.
    pub row_counts: &'static str,
}

impl PgIntrospection {
    /// Canonical vanilla PostgreSQL introspection queries. These are the exact
    /// strings `postgres/schema.rs` ran inline before the dialect seam existed.
    pub const VANILLA: Self = Self {
        tables_columns: VANILLA_TABLES_COLUMNS,
        foreign_keys: VANILLA_FOREIGN_KEYS,
        indexes: VANILLA_INDEXES,
        row_counts: VANILLA_ROW_COUNTS,
    };

    /// CockroachDB introspection queries. Starts from [`Self::VANILLA`] and
    /// overrides ONLY the queries that diverge against a live cluster
    /// (CockroachDB CCL v25.1). See each override constant for the divergence.
    pub const COCKROACH: Self = Self {
        // Tables/columns and foreign keys are byte-identical to vanilla: against
        // the live cluster they return correct schemas, columns, PKs and FK
        // edges with no quirks. (The SERIAL `unique_rowid()` auto-increment
        // quirk is handled in the shared Rust parser in postgres/schema.rs, not
        // in SQL, so no query override is needed.)
        tables_columns: VANILLA_TABLES_COLUMNS,
        foreign_keys: VANILLA_FOREIGN_KEYS,
        // Indexes use vanilla `pg_indexes`, which CockroachDB implements: the
        // returned `indexdef` is parseable by the shared parser. CockroachDB
        // appends an explicit ` ASC` direction to every indexed column (vanilla
        // only emits a direction for non-default ordering), but that is stripped
        // in the shared parser, so the query itself needs no override.
        indexes: VANILLA_INDEXES,
        // Row counts: CockroachDB's `pg_stat_user_tables` is a stub that returns
        // ZERO rows, so the vanilla query yields no estimates at all. Pull the
        // estimate from `crdb_internal.table_row_statistics` instead, joined to
        // pg_class/pg_namespace for schema+table names (table_id == pg_class.oid
        // on CockroachDB). When the estimate is stale/0 (stats collection lags),
        // postgres/schema.rs already falls back to an exact COUNT(*) per table —
        // the same safety net vanilla relies on — so correctness is guaranteed.
        row_counts: COCKROACH_ROW_COUNTS,
    };
}

// ---------------------------------------------------------------------------
// Postgres introspection query strings.
//
// The `VANILLA_*` constants are the EXACT queries that previously lived inline
// in `postgres/schema.rs`. They are the single source of truth for the vanilla
// path; moving them here must be byte-for-byte behaviour-preserving.
// ---------------------------------------------------------------------------

/// Vanilla: tables + columns + primary-key + auto-increment detection.
const VANILLA_TABLES_COLUMNS: &str = r#"
        SELECT 
            c.table_schema,
            c.table_name,
            c.column_name,
            c.data_type,
            c.is_nullable = 'YES' as is_nullable,
            c.column_default,
            -- Check if column is part of primary key
            CASE 
                WHEN pk.column_name IS NOT NULL THEN true 
                ELSE false 
            END as is_primary_key,
            -- Check if column has SERIAL/auto-increment
            CASE 
                WHEN c.column_default LIKE 'nextval%' THEN true
                WHEN c.is_identity = 'YES' THEN true
                ELSE false 
            END as is_auto_increment
        FROM 
            information_schema.columns c
        JOIN 
            information_schema.tables t 
            ON c.table_name = t.table_name 
            AND c.table_schema = t.table_schema
        LEFT JOIN (
            -- Get primary key columns
            SELECT 
                kcu.table_schema,
                kcu.table_name, 
                kcu.column_name
            FROM 
                information_schema.table_constraints tc
            JOIN 
                information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name 
                AND tc.table_schema = kcu.table_schema
            WHERE 
                tc.constraint_type = 'PRIMARY KEY'
        ) pk 
            ON c.table_schema = pk.table_schema 
            AND c.table_name = pk.table_name 
            AND c.column_name = pk.column_name
        WHERE 
            t.table_type = 'BASE TABLE'
            AND c.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        ORDER BY 
            c.table_schema, c.table_name, c.ordinal_position
    "#;

/// Vanilla: foreign-key edges.
const VANILLA_FOREIGN_KEYS: &str = r#"
        SELECT
            kcu.table_schema,
            kcu.table_name,
            kcu.column_name,
            ccu.table_schema AS referenced_schema,
            ccu.table_name AS referenced_table,
            ccu.column_name AS referenced_column
        FROM
            information_schema.table_constraints tc
        JOIN
            information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN
            information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE
            tc.constraint_type = 'FOREIGN KEY'
    "#;

/// Vanilla: indexes via `pg_indexes`.
const VANILLA_INDEXES: &str = r#"
        SELECT
            schemaname,
            tablename,
            indexname,
            indexdef
        FROM
            pg_indexes
        WHERE
            schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
    "#;

/// Vanilla: row-count estimates via `pg_stat_user_tables`.
const VANILLA_ROW_COUNTS: &str = r#"
        SELECT 
            schemaname,
            relname,
            n_live_tup
        FROM 
            pg_stat_user_tables
    "#;

/// CockroachDB override: row-count estimates.
///
/// Divergence: CockroachDB's `pg_stat_user_tables` is a compatibility stub that
/// returns ZERO rows, so the vanilla query produces no estimates. CockroachDB's
/// real estimate lives in `crdb_internal.table_row_statistics`, keyed by
/// `table_id` which equals `pg_class.oid`. Join to pg_class/pg_namespace to
/// recover (schemaname, relname); shape the result to match the vanilla query
/// (schema, table, count::bigint) so the consuming Rust is identical.
const COCKROACH_ROW_COUNTS: &str = r#"
        SELECT
            ns.nspname AS schemaname,
            cls.relname AS relname,
            COALESCE(stats.estimated_row_count, 0)::bigint AS n_live_tup
        FROM
            crdb_internal.table_row_statistics stats
        JOIN
            pg_class cls ON cls.oid = stats.table_id
        JOIN
            pg_namespace ns ON ns.oid = cls.relnamespace
        WHERE
            ns.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast', 'crdb_internal', 'pg_extension')
    "#;

/// Concrete engine behind a MySQL-wire connection.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum MySqlDialect {
    /// Vanilla MySQL (the default / safe path).
    #[default]
    MySql,
    /// MariaDB speaking the MySQL wire protocol.
    MariaDb,
}

impl MySqlDialect {
    /// Source capabilities for this dialect (MySQL/MariaDB never use
    /// Postgres-style LISTEN/NOTIFY).
    pub const fn caps(self) -> SourceCaps {
        SourceCaps::for_dialect(self.detected())
    }

    /// The unified `DetectedDialect` tag for this MySQL-wire dialect.
    pub const fn detected(self) -> DetectedDialect {
        match self {
            MySqlDialect::MySql => DetectedDialect::MySql,
            MySqlDialect::MariaDb => DetectedDialect::MariaDb,
        }
    }

    /// Introspection-query overrides for this dialect.
    ///
    /// Returns the catalog query strings `mysql/schema.rs` runs. Vanilla MySQL
    /// gets [`MySqlIntrospection::VANILLA`]; MariaDB gets
    /// [`MySqlIntrospection::MARIADB`], which overrides only the queries that
    /// diverge from MySQL's `information_schema` semantics.
    ///
    /// This mirrors [`PgDialect::introspection`] exactly: one descriptor struct
    /// carrying one `&'static str` per introspection query, a `VANILLA` const
    /// holding the canonical queries, and a per-dialect const that clones
    /// vanilla and replaces only the divergent fields.
    pub const fn introspection(self) -> MySqlIntrospection {
        match self {
            MySqlDialect::MySql => MySqlIntrospection::VANILLA,
            MySqlDialect::MariaDb => MySqlIntrospection::MARIADB,
        }
    }
}

/// Per-dialect MySQL introspection query overrides.
///
/// One `&'static str` per catalog query that `mysql/schema.rs` runs. The
/// vanilla descriptor holds the canonical queries (the single source of truth);
/// each dialect descriptor is built by cloning vanilla and replacing only the
/// fields whose vanilla query fails or returns wrong/empty results against that
/// engine. Same shape as [`PgIntrospection`].
///
/// Every query is parameterised by the current database name (`?`), matching
/// the `conn.exec(query, (&current_db,))` call sites in `mysql/schema.rs`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MySqlIntrospection {
    /// Columns + primary-key flag + auto-increment detection per table.
    pub columns: &'static str,
    /// Foreign-key edges: (schema, table, column) -> referenced (schema, table, column).
    pub foreign_keys: &'static str,
    /// Index columns: (schema, table, index name, non_unique, column name) ordered by position.
    pub indexes: &'static str,
    /// Per-table estimated row counts via `information_schema.TABLES.TABLE_ROWS`.
    pub row_counts: &'static str,
}

impl MySqlIntrospection {
    /// Canonical vanilla MySQL introspection queries. These are the exact
    /// strings `mysql/schema.rs` ran inline before the dialect seam existed.
    pub const VANILLA: Self = Self {
        columns: VANILLA_MYSQL_COLUMNS,
        foreign_keys: VANILLA_MYSQL_FOREIGN_KEYS,
        indexes: VANILLA_MYSQL_INDEXES,
        row_counts: VANILLA_MYSQL_ROW_COUNTS,
    };

    /// MariaDB introspection queries. Starts from [`Self::VANILLA`].
    ///
    /// Divergence audit (run live against MariaDB 11.4.12 in the `mariadb`
    /// container, database `dora`): all four vanilla queries return correct,
    /// well-formed results against MariaDB. MariaDB implements the same
    /// `information_schema.COLUMNS` / `KEY_COLUMN_USAGE` / `STATISTICS` /
    /// `TABLES` catalog views MySQL does, with the same column names and the
    /// same `COLUMN_KEY='PRI'`, `EXTRA LIKE '%auto_increment%'`,
    /// `REFERENCED_TABLE_NAME IS NOT NULL`, `NON_UNIQUE` and `TABLE_ROWS`
    /// semantics relied on here.
    ///
    /// MariaDB-only column types (`uuid`, `inet4`, `inet6`) surface through
    /// `information_schema.COLUMNS.COLUMN_TYPE` as plain readable type names
    /// (`uuid`/`inet4`/`inet6`), so even the columns query needs no override.
    ///
    /// Therefore MariaDB == VANILLA: every field is intentionally inherited.
    /// No override is added where vanilla already works (mirrors the Cockroach
    /// descriptor, which only overrode `row_counts`).
    pub const MARIADB: Self = Self {
        columns: VANILLA_MYSQL_COLUMNS,
        foreign_keys: VANILLA_MYSQL_FOREIGN_KEYS,
        indexes: VANILLA_MYSQL_INDEXES,
        row_counts: VANILLA_MYSQL_ROW_COUNTS,
    };
}

// ---------------------------------------------------------------------------
// MySQL introspection query strings.
//
// The `VANILLA_MYSQL_*` constants are the EXACT queries that previously lived
// inline in `mysql/schema.rs`. They are the single source of truth for the
// vanilla path; moving them here is byte-for-byte behaviour-preserving. Each
// query takes the current database name as its single `?` bind parameter.
// ---------------------------------------------------------------------------

/// Vanilla: columns + primary-key flag + auto-increment detection.
const VANILLA_MYSQL_COLUMNS: &str = r#"
        SELECT
            c.TABLE_SCHEMA,
            c.TABLE_NAME,
            c.COLUMN_NAME,
            c.COLUMN_TYPE,
            c.IS_NULLABLE = 'YES'        AS is_nullable,
            c.COLUMN_DEFAULT,
            CASE WHEN c.COLUMN_KEY = 'PRI' THEN 1 ELSE 0 END AS is_primary_key,
            CASE WHEN c.EXTRA LIKE '%auto_increment%' THEN 1 ELSE 0 END AS is_auto_increment
        FROM
            information_schema.COLUMNS c
        JOIN
            information_schema.TABLES t
            ON c.TABLE_NAME = t.TABLE_NAME
            AND c.TABLE_SCHEMA = t.TABLE_SCHEMA
        WHERE
            t.TABLE_TYPE = 'BASE TABLE'
            AND c.TABLE_SCHEMA = ?
        ORDER BY
            c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION
    "#;

/// Vanilla: foreign-key edges.
const VANILLA_MYSQL_FOREIGN_KEYS: &str = r#"
        SELECT
            kcu.TABLE_SCHEMA,
            kcu.TABLE_NAME,
            kcu.COLUMN_NAME,
            kcu.REFERENCED_TABLE_SCHEMA,
            kcu.REFERENCED_TABLE_NAME,
            kcu.REFERENCED_COLUMN_NAME
        FROM
            information_schema.KEY_COLUMN_USAGE kcu
        WHERE
            kcu.REFERENCED_TABLE_NAME IS NOT NULL
            AND kcu.TABLE_SCHEMA = ?
    "#;

/// Vanilla: index columns via `information_schema.STATISTICS`.
const VANILLA_MYSQL_INDEXES: &str = r#"
        SELECT
            TABLE_SCHEMA,
            TABLE_NAME,
            INDEX_NAME,
            NON_UNIQUE,
            COLUMN_NAME
        FROM
            information_schema.STATISTICS
        WHERE
            TABLE_SCHEMA = ?
        ORDER BY
            TABLE_SCHEMA, TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
    "#;

/// Vanilla: row-count estimates via `information_schema.TABLES.TABLE_ROWS`.
const VANILLA_MYSQL_ROW_COUNTS: &str = r#"
        SELECT
            TABLE_SCHEMA,
            TABLE_NAME,
            TABLE_ROWS
        FROM
            information_schema.TABLES
        WHERE
            TABLE_TYPE = 'BASE TABLE'
            AND TABLE_SCHEMA = ?
    "#;

/// A unified, runtime-detected dialect tag stored on a connection.
///
/// `None` of these is fabricated: each is set only after a successful
/// `version()` query against the live server.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum DetectedDialect {
    Postgres,
    CockroachDb,
    MySql,
    MariaDb,
}

impl From<PgDialect> for DetectedDialect {
    fn from(value: PgDialect) -> Self {
        match value {
            PgDialect::Postgres => DetectedDialect::Postgres,
            PgDialect::CockroachDb => DetectedDialect::CockroachDb,
        }
    }
}

impl From<MySqlDialect> for DetectedDialect {
    fn from(value: MySqlDialect) -> Self {
        match value {
            MySqlDialect::MySql => DetectedDialect::MySql,
            MySqlDialect::MariaDb => DetectedDialect::MariaDb,
        }
    }
}

/// Detect the real engine from a Postgres `SELECT version()` string.
///
/// CockroachDB returns strings like `CockroachDB CCL v23.1.0 (...)`, whereas
/// PostgreSQL returns `PostgreSQL 16.1 on x86_64-pc-linux-gnu ...`. The match is
/// case-insensitive and substring-based so it survives build-info noise.
pub fn detect_pg_dialect(version_str: &str) -> PgDialect {
    if version_str.to_ascii_lowercase().contains("cockroach") {
        PgDialect::CockroachDb
    } else {
        PgDialect::Postgres
    }
}

/// Detect the real engine from a MySQL `SELECT VERSION()` string.
///
/// MariaDB embeds `MariaDB` in the version banner (e.g. `11.4.2-MariaDB`),
/// while MySQL returns a bare version like `8.0.36`. Case-insensitive substring
/// match.
pub fn detect_mysql_dialect(version_str: &str) -> MySqlDialect {
    if version_str.to_ascii_lowercase().contains("mariadb") {
        MySqlDialect::MariaDb
    } else {
        MySqlDialect::MySql
    }
}

/// Feature flags that gate behaviour per detected dialect.
///
/// This is the "source caps" layer: code that wants to know "can I use
/// LISTEN/NOTIFY here?" asks the caps, not the raw enum, so the answer is
/// derived from the *runtime-detected* engine rather than the user's pick.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SourceCaps {
    /// True when the engine supports Postgres `LISTEN`/`NOTIFY`, which the live
    /// monitor uses for push-based change notifications. CockroachDB does NOT
    /// support it, so live monitoring must fall back to polling (or be hidden).
    pub supports_listen_notify: bool,
}

impl SourceCaps {
    /// Capabilities for a Postgres-wire connection whose dialect is not yet
    /// known. Assumes vanilla Postgres (the safe, existing behaviour).
    pub const fn postgres_default() -> Self {
        Self {
            supports_listen_notify: true,
        }
    }

    /// Capabilities for a MySQL-wire connection whose dialect is not yet known.
    /// MySQL/MariaDB have no Postgres-style LISTEN/NOTIFY; the live monitor
    /// already polls for these engines.
    pub const fn mysql_default() -> Self {
        Self {
            supports_listen_notify: false,
        }
    }

    /// Derive capabilities from a concretely detected dialect.
    pub const fn for_dialect(dialect: DetectedDialect) -> Self {
        match dialect {
            // Vanilla Postgres: full LISTEN/NOTIFY support.
            DetectedDialect::Postgres => Self {
                supports_listen_notify: true,
            },
            // CockroachDB intentionally does not implement LISTEN/NOTIFY.
            // https://github.com/cockroachdb/cockroach/issues/41522
            DetectedDialect::CockroachDb => Self {
                supports_listen_notify: false,
            },
            // MySQL/MariaDB: polling-based monitoring only.
            DetectedDialect::MySql | DetectedDialect::MariaDb => Self {
                supports_listen_notify: false,
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_cockroachdb_from_version_string() {
        let v = "CockroachDB CCL v23.1.0 (x86_64-pc-linux-gnu, built 2023/05/15 ...)";
        assert_eq!(detect_pg_dialect(v), PgDialect::CockroachDb);
    }

    #[test]
    fn detects_vanilla_postgres_from_version_string() {
        let v = "PostgreSQL 16.1 on x86_64-pc-linux-gnu, compiled by gcc ...";
        assert_eq!(detect_pg_dialect(v), PgDialect::Postgres);
    }

    #[test]
    fn detects_cockroachdb_case_insensitively() {
        assert_eq!(detect_pg_dialect("cockroachdb v22.2"), PgDialect::CockroachDb);
    }

    #[test]
    fn detects_mariadb_from_version_string() {
        let v = "11.4.2-MariaDB-1:11.4.2+maria~ubu2404";
        assert_eq!(detect_mysql_dialect(v), MySqlDialect::MariaDb);
    }

    #[test]
    fn detects_vanilla_mysql_from_version_string() {
        assert_eq!(detect_mysql_dialect("8.0.36"), MySqlDialect::MySql);
    }

    #[test]
    fn detects_mariadb_case_insensitively() {
        assert_eq!(detect_mysql_dialect("10.11.8-mariadb"), MySqlDialect::MariaDb);
    }

    #[test]
    fn cockroach_caps_disable_listen_notify() {
        let caps = SourceCaps::for_dialect(DetectedDialect::CockroachDb);
        assert!(!caps.supports_listen_notify);
    }

    #[test]
    fn postgres_caps_enable_listen_notify() {
        let caps = SourceCaps::for_dialect(DetectedDialect::Postgres);
        assert!(caps.supports_listen_notify);
    }

    #[test]
    fn mysql_and_mariadb_caps_disable_listen_notify() {
        assert!(!SourceCaps::for_dialect(DetectedDialect::MySql).supports_listen_notify);
        assert!(!SourceCaps::for_dialect(DetectedDialect::MariaDb).supports_listen_notify);
    }

    #[test]
    fn dialect_conversions_are_consistent() {
        assert_eq!(
            DetectedDialect::from(PgDialect::CockroachDb),
            DetectedDialect::CockroachDb
        );
        assert_eq!(
            DetectedDialect::from(MySqlDialect::MariaDb),
            DetectedDialect::MariaDb
        );
    }
}
