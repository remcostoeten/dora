use dashmap::DashMap;
use uuid::Uuid;

use crate::{
    database::{
        adapter::{
            adapter_from_client, write_adapter_from_client, BoxedAdapter, BoxedWriteAdapter,
        },
        parser::ParsedStatement,
        types::{Database, DatabaseClient, DatabaseConnection},
    },
    AppState, Error,
};

pub trait ConnectionRepository: Send + Sync {
    fn get_client(&self, connection_id: Uuid) -> Result<DatabaseClient, Error>;

    fn get_read_adapter(&self, connection_id: Uuid) -> Result<BoxedAdapter, Error> {
        let client = self.get_client(connection_id)?;
        Ok(adapter_from_client(&client))
    }

    fn get_write_adapter(&self, connection_id: Uuid) -> Result<BoxedWriteAdapter, Error> {
        let client = self.get_client(connection_id)?;
        Ok(write_adapter_from_client(&client))
    }

    fn parse_statements(
        &self,
        connection_id: Uuid,
        query: &str,
    ) -> Result<Vec<ParsedStatement>, Error>;
}

impl ConnectionRepository for AppState {
    fn get_client(&self, connection_id: Uuid) -> Result<DatabaseClient, Error> {
        client_from_map(&self.connections, connection_id)
    }

    fn parse_statements(
        &self,
        connection_id: Uuid,
        query: &str,
    ) -> Result<Vec<ParsedStatement>, Error> {
        parse_from_map(&self.connections, connection_id, query)
    }
}

pub struct ConnectionMapRepository<'a> {
    pub connections: &'a DashMap<Uuid, DatabaseConnection>,
}

impl ConnectionRepository for ConnectionMapRepository<'_> {
    fn get_client(&self, connection_id: Uuid) -> Result<DatabaseClient, Error> {
        client_from_map(self.connections, connection_id)
    }

    fn parse_statements(
        &self,
        connection_id: Uuid,
        query: &str,
    ) -> Result<Vec<ParsedStatement>, Error> {
        parse_from_map(self.connections, connection_id, query)
    }
}

fn client_from_map(
    connections: &DashMap<Uuid, DatabaseConnection>,
    connection_id: Uuid,
) -> Result<DatabaseClient, Error> {
    let connection_entry = connections
        .get(&connection_id)
        .ok_or(Error::ConnectionNotFound(connection_id))?;

    connection_entry.value().get_client()
}

fn parse_from_map(
    connections: &DashMap<Uuid, DatabaseConnection>,
    connection_id: Uuid,
    query: &str,
) -> Result<Vec<ParsedStatement>, Error> {
    let connection_entry = connections
        .get(&connection_id)
        .ok_or(Error::ConnectionNotFound(connection_id))?;

    match &connection_entry.value().database {
        Database::Postgres { .. } => {
            crate::database::postgres::parser::parse_statements(query).map_err(Into::into)
        }
        Database::MySQL { .. } => {
            crate::database::mysql::parser::parse_statements(query).map_err(Into::into)
        }
        Database::SQLite { .. } => {
            crate::database::sqlite::parser::parse_statements(query).map_err(Into::into)
        }
        Database::DuckDB { .. } => {
            crate::database::duckdb::parser::parse_statements(query).map_err(Into::into)
        }
        Database::LibSQL { .. } => {
            crate::database::libsql::parser::parse_statements(query).map_err(Into::into)
        }
        Database::D1 { .. } => {
            // D1 is the SQLite dialect.
            crate::database::sqlite::parser::parse_statements(query).map_err(Into::into)
        }
        Database::Posthog { .. } => {
            // PostHog reuses the SQLite parser for statement splitting.
            crate::database::sqlite::parser::parse_statements(query).map_err(Into::into)
        }
    }
}
