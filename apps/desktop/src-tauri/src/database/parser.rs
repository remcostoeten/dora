use sqlparser::{
    ast::Statement, dialect::Dialect, keywords::Keyword, parser::Parser, tokenizer::Token,
};

#[derive(Debug)]
pub struct ParsedStatement {
    pub statement: String,
    pub returns_values: bool,
    #[expect(unused)]
    pub is_read_only: bool,
}

pub trait SqlDialectExt {
    fn returns_values(stmt: &Statement) -> bool;
    fn is_read_only(stmt: &Statement) -> bool {
        use Statement::*;

        match stmt {
            Query(_) => true,
            Explain {
                analyze, statement, ..
            } => {
                // If the explain will execute the inner statement, check if it's read-only
                if *analyze {
                    Self::is_read_only(statement)
                } else {
                    true
                }
            }
            ExplainTable { .. }
            | ShowFunctions { .. }
            | ShowVariable { .. }
            | ShowStatus { .. }
            | ShowVariables { .. }
            | ShowCreate { .. }
            | ShowColumns { .. }
            | ShowDatabases { .. }
            | ShowSchemas { .. }

            | ShowTables { .. }
            | ShowViews { .. }
            | ShowCollation { .. } => true,



            Fetch { into, .. } => into.is_none(),
            StartTransaction { .. } => true,
            Commit { .. } | Rollback { .. } | Savepoint { .. } | ReleaseSavepoint { .. } => true,
            Declare { .. } => true,
            _ => false,
        }
    }
}

pub fn parse_statements<T>(dialect: &T, query: &str) -> anyhow::Result<Vec<ParsedStatement>>
where
    T: Dialect + SqlDialectExt,
{
    let mut parser = Parser::new(dialect).try_with_sql(query)?;

    let mut statements = vec![];

    loop {
        while parser.consume_token(&Token::SemiColon) {}

        match parser.peek_token().token {
            Token::EOF => break,
            Token::Word(word) if word.keyword == Keyword::END => break,
            _ => {}
        }

        let statement = parser.parse_statement()?;
        statements.push(ParsedStatement {
            statement: statement.to_string(),
            returns_values: T::returns_values(&statement),
            is_read_only: T::is_read_only(&statement),
        });
    }

    Ok(statements)
}
