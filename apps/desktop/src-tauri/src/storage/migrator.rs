use anyhow::Context;
use rusqlite::Connection;

pub(super) struct Migrator {
    migrations: &'static [&'static str],
}

impl Migrator {
    pub(super) fn new() -> Self {
        Self {
            migrations: &[
                include_str!("../../migrations/001.sql"),
                include_str!("../../migrations/002.sql"),
                include_str!("../../migrations/003.sql"),
                include_str!("../../migrations/004.sql"),
                include_str!("../../migrations/005.sql"),
                include_str!("../../migrations/006.sql"),
                include_str!("../../migrations/007.sql"),
                include_str!("../../migrations/008.sql"),
            ],
        }
    }

    pub(super) fn migrate(&self, conn: &mut Connection) -> anyhow::Result<()> {
        let current_version: i32 = conn
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .context("Failed to get current database version")?;

        let target_version = self.migrations.len() as i32;

        if current_version == target_version {
            return Ok(());
        }

        if current_version > target_version {
            anyhow::bail!(
                "Database version ({}) is newer than application version ({}). Please update the application.",
                current_version,
                target_version
            );
        }

        let tx = conn
            .transaction()
            .context("Failed to start migration transaction")?;

        for (i, migration) in self.migrations.iter().enumerate() {
            let migration_version = (i + 1) as i32;

            if migration_version <= current_version {
                continue;
            }

            tx.execute_batch(migration).map_err(|err| {
                anyhow::anyhow!("Failed to execute migration {migration_version}: {err}")
            })?;

            tx.pragma_update(None, "user_version", migration_version)
                .with_context(|| format!("Failed to update version to {}", migration_version))?;
        }

        let integrity_check: String = tx
            .pragma_query_value(None, "integrity_check", |row| row.get(0))
            .context("Failed to check database integrity")?;

        anyhow::ensure!(
            integrity_check == "ok",
            "Database integrity check failed: {}",
            integrity_check
        );

        tx.commit()
            .context("Failed to commit migration transaction")?;

        conn.execute("PRAGMA optimize", [])
            .context("Failed to optimize database")?;

        Ok(())
    }
}
