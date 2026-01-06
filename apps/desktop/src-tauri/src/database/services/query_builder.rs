use anyhow::{Context, Result};
use sqlparser::dialect::GenericDialect;
use sqlparser::parser::Parser;
use sqlparser::ast::Statement;

pub struct QueryBuilderService;

impl QueryBuilderService {
    pub fn parse_sql(&self, sql: &str) -> Result<Vec<Statement>> {
        let dialect = GenericDialect {}; // Support multiple dialects later?
        let ast = Parser::parse_sql(&dialect, sql)
            .context("Failed to parse SQL")?;
        Ok(ast)
    }

    pub fn build_sql(&self, ast: Vec<Statement>) -> Result<String> {
        let mut sql = String::new();
        for (i, stmt) in ast.iter().enumerate() {
            if i > 0 {
                 sql.push_str(";\n");
            }
            sql.push_str(&stmt.to_string());
        }
        Ok(sql)
    }
}
