use crate::{database::types::DatabaseSchema, error::Error};

pub async fn get_database_schema(_pool: std::sync::Arc<mysql_async::Pool>) -> Result<DatabaseSchema, Error> {
    Err(Error::Any(anyhow::anyhow!(
        "MySQL schema introspection not implemented yet"
    )))
}

