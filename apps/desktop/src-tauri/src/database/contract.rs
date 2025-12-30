use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub enum CommandStability {
    Stable,
    Experimental,
    Dangerous,
}

#[derive(Debug, Clone, Serialize)]
pub struct CommandArgument {
    pub name: &'static str,
    pub arg_type: &'static str,
    pub description: &'static str,
    pub optional: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct CommandDefinition {
    pub name: &'static str,
    pub description: &'static str,
    pub arguments: Vec<CommandArgument>,
    pub return_type: &'static str,
    pub stability: CommandStability,
    pub side_effects: Vec<&'static str>,
}

pub fn get_command_contract() -> Vec<CommandDefinition> {
    vec![
        // Connection Commands
        CommandDefinition {
            name: "add_connection",
            description: "Register a new database connection configuration.",
            arguments: vec![
                CommandArgument { name: "name", arg_type: "String", description: "Display name for the connection", optional: false },
                CommandArgument { name: "database_info", arg_type: "DatabaseInfo", description: "Connection details (type, host, credentials)", optional: false },
                CommandArgument { name: "color", arg_type: "Option<i32>", description: "Color hue for UI accent", optional: true },
            ],
            return_type: "Result<ConnectionInfo, Error>",
            stability: CommandStability::Stable,
            side_effects: vec!["Persists connection config to storage", "Stores credentials securely"],
        },
        CommandDefinition {
            name: "update_connection",
            description: "Update an existing connection configuration.",
            arguments: vec![
                CommandArgument { name: "conn_id", arg_type: "Uuid", description: "ID of the connection to update", optional: false },
                CommandArgument { name: "name", arg_type: "String", description: "New display name", optional: false },
                CommandArgument { name: "database_info", arg_type: "DatabaseInfo", description: "New connection details", optional: false },
                CommandArgument { name: "color", arg_type: "Option<i32>", description: "New color hue", optional: true },
            ],
            return_type: "Result<ConnectionInfo, Error>",
            stability: CommandStability::Stable,
            side_effects: vec!["Updates storage", "MAY disconnect active connection if config changes"],
        },
        CommandDefinition {
            name: "connect_to_database",
            description: "Establish an active connection to a database.",
            arguments: vec![
                CommandArgument { name: "connection_id", arg_type: "Uuid", description: "ID of the connection", optional: false },
            ],
            return_type: "Result<bool, Error>",
            stability: CommandStability::Stable,
            side_effects: vec!["Opened network connection", "Starts connection monitoring"],
        },
        CommandDefinition {
            name: "disconnect_from_database",
            description: "Close an active database connection.",
            arguments: vec![
                CommandArgument { name: "connection_id", arg_type: "Uuid", description: "ID of the connection", optional: false },
            ],
            return_type: "Result<(), Error>",
            stability: CommandStability::Stable,
            side_effects: vec!["Closes network connection", "Stops monitoring"],
        },
        CommandDefinition {
            name: "get_connections",
            description: "Retrieve all configured connections.",
            arguments: vec![],
            return_type: "Result<Vec<ConnectionInfo>, Error>",
            stability: CommandStability::Stable,
            side_effects: vec![],
        },
        CommandDefinition {
            name: "set_connection_pin",
            description: "Set or remove the PIN for verifying connection credentials.",
            arguments: vec![
                CommandArgument { name: "connection_id", arg_type: "Uuid", description: "Target connection ID", optional: false },
                CommandArgument { name: "pin", arg_type: "Option<String>", description: "New PIN (or null to remove)", optional: true },
            ],
            return_type: "Result<(), Error>",
            stability: CommandStability::Stable,
            side_effects: vec!["Persists hashed PIN"],
        },
        CommandDefinition {
            name: "verify_pin_and_get_credentials",
            description: "Verify PIN and return sensitive connection credentials.",
            arguments: vec![
                CommandArgument { name: "connection_id", arg_type: "Uuid", description: "Target connection ID", optional: false },
                CommandArgument { name: "pin", arg_type: "String", description: "PIN to verify", optional: false },
            ],
            return_type: "Result<Option<String>, Error>",
            stability: CommandStability::Stable,
            side_effects: vec![],
        },
        // Query Commands
        CommandDefinition {
            name: "start_query",
            description: "Execute a SQL query asynchronously.",
            arguments: vec![
                CommandArgument { name: "connection_id", arg_type: "Uuid", description: "Active connection ID", optional: false },
                CommandArgument { name: "query", arg_type: "String", description: "SQL query string", optional: false },
            ],
            return_type: "Result<Vec<usize>, Error>",
            stability: CommandStability::Stable,
            side_effects: vec!["Executes SQL on DB", "Allocates query state"],
        },
        CommandDefinition {
            name: "fetch_page",
            description: "Fetch a page of results for an executed query.",
            arguments: vec![
                CommandArgument { name: "query_id", arg_type: "usize", description: "ID returned by start_query", optional: false },
                CommandArgument { name: "page_index", arg_type: "usize", description: "Zero-based page index", optional: false },
            ],
            return_type: "Result<Option<Box<RawValue>>, Error>",
            stability: CommandStability::Stable,
            side_effects: vec![],
        },
        // Mutation Commands
        CommandDefinition {
            name: "insert_row",
            description: "Insert a single row into a table.",
            arguments: vec![
                CommandArgument { name: "connection_id", arg_type: "Uuid", description: "Active connection ID", optional: false },
                CommandArgument { name: "table_name", arg_type: "String", description: "Target table", optional: false },
                CommandArgument { name: "schema_name", arg_type: "Option<String>", description: "Target schema (optional)", optional: true },
                CommandArgument { name: "row_data", arg_type: "Map<String, Value>", description: "Column-value map", optional: false },
            ],
            return_type: "Result<MutationResult, Error>",
            stability: CommandStability::Stable,
            side_effects: vec!["Modifies DB data"],
        },
        CommandDefinition {
            name: "execute_batch",
            description: "Execute multiple SQL statements in a single batch/transaction.",
            arguments: vec![
                CommandArgument { name: "connection_id", arg_type: "Uuid", description: "Active connection ID", optional: false },
                CommandArgument { name: "statements", arg_type: "Vec<String>", description: "List of SQL statements", optional: false },
            ],
            return_type: "Result<MutationResult, Error>",
            stability: CommandStability::Experimental,
            side_effects: vec!["Modifies DB data", "Invalidates schema cache"],
        },
        CommandDefinition {
            name: "truncate_database",
            description: "Truncate ALL tables in the database.",
            arguments: vec![
                CommandArgument { name: "connection_id", arg_type: "Uuid", description: "Active connection ID", optional: false },
                CommandArgument { name: "confirm", arg_type: "bool", description: "Safety confirmation flag", optional: false },
            ],
            return_type: "Result<TruncateResult, Error>",
            stability: CommandStability::Dangerous,
            side_effects: vec!["DELETES ALL DATE", "Irreversible operation"],
        },
        // Seeding Commands
        CommandDefinition {
            name: "seed_table",
            description: "Populate a table with mock data.",
            arguments: vec![
                CommandArgument { name: "connection_id", arg_type: "Uuid", description: "Active connection ID", optional: false },
                CommandArgument { name: "table_name", arg_type: "String", description: "Target table", optional: false },
                CommandArgument { name: "schema_name", arg_type: "Option<String>", description: "Target schema (optional)", optional: true },
                CommandArgument { name: "count", arg_type: "u32", description: "Number of rows to generate", optional: false },
            ],
            return_type: "Result<SeedResult, Error>",
            stability: CommandStability::Experimental,
            side_effects: vec!["Inserts random data"],
        },
        // Query Builder Commands
        CommandDefinition {
            name: "parse_sql",
            description: "Parse SQL string into JSON AST.",
            arguments: vec![
                CommandArgument { name: "sql", arg_type: "String", description: "SQL Query", optional: false },
            ],
            return_type: "Result<Value, Error>",
            stability: CommandStability::Stable,
            side_effects: vec![],
        },
        CommandDefinition {
            name: "build_sql",
            description: "Build SQL string from JSON AST.",
            arguments: vec![
                CommandArgument { name: "ast", arg_type: "Value", description: "JSON AST", optional: false },
            ],
            return_type: "Result<String, Error>",
            stability: CommandStability::Stable,
            side_effects: vec![],
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    #[test]
    fn export_contract_json() {
        let contract = get_command_contract();
        let json = serde_json::to_string_pretty(&contract).unwrap();
        
        // Target: dora/apps/docs/static/contract.json
        // We are in dora/apps/desktop/src-tauri
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
        println!("Manifest dir: {}", manifest_dir);
        let mut path = PathBuf::from(manifest_dir);
        path.pop(); // out of src-tauri
        path.pop(); // out of desktop
        path.push("docs");
        path.push("static");
        
        // Ensure static dir exists
        fs::create_dir_all(&path).unwrap();
        
        path.push("contract.json");
        
        fs::write(&path, json).expect("Unable to write contract.json");
        println!("Exported contract to {:?}", path);
    }
}
