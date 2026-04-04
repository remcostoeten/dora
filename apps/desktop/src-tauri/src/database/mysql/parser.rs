use sqlparser::{ast::Statement, dialect::MySqlDialect};

use crate::database::{
    self,
    parser::{ParsedStatement, SqlDialectExt},
};

pub fn parse_statements(query: &str) -> anyhow::Result<Vec<ParsedStatement>> {
    database::parser::parse_statements(&MySqlDialect {}, query)
}

impl SqlDialectExt for MySqlDialect {
    fn returns_values(stmt: &Statement) -> bool {
        match stmt {
            Statement::Query(_) => true,
            Statement::Explain { .. } => true,
            Statement::Execute { .. } => true,
            Statement::ShowColumns { .. } => true,
            Statement::ShowCreate { .. } => true,
            Statement::ShowDatabases { .. } => true,
            Statement::ShowSchemas { .. } => true,
            Statement::ShowTables { .. } => true,
            Statement::ShowVariables { .. } => true,
            Statement::ShowStatus { .. } => true,
            Statement::ShowFunctions { .. } => true,
            Statement::ShowVariable { .. } => true,
            Statement::ShowViews { .. } => true,
            Statement::ShowCollation { .. } => true,
            _ => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_statements() {
        let results = parse_statements("SELECT 1; SELECT 2;").unwrap();
        assert_eq!(results.len(), 2);
        assert!(results[0].returns_values);
        assert!(results[1].returns_values);

        let results = parse_statements("INSERT INTO t (a) VALUES (1);").unwrap();
        assert_eq!(results.len(), 1);
        assert!(!results[0].returns_values);

        let results = parse_statements("SHOW TABLES;").unwrap();
        assert_eq!(results.len(), 1);
        assert!(results[0].returns_values);
    }
}

