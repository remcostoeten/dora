mod functions;

use std::{collections::BTreeSet, ops::ControlFlow};

use sqlparser::{
    ast::{
        BinaryOperator, Expr, FunctionArguments, ObjectName, Query, SetExpr, Statement,
        TableFactor, Value, Visit, Visitor,
    },
    dialect::{Dialect, MySqlDialect, PostgreSqlDialect, SQLiteDialect},
    parser::Parser,
};

use self::functions::{is_allowed_function, is_allowed_table_function, is_denied_relation};
use super::{
    catalog::SqlFamily,
    errors::{McpErrorCode, McpFailure},
};
use crate::storage::AgentProposalRisk;

fn dialect_for(family: SqlFamily) -> Box<dyn Dialect> {
    match family {
        SqlFamily::Postgres => Box::new(PostgreSqlDialect {}),
        SqlFamily::MySql => Box::new(MySqlDialect {}),
        SqlFamily::Sqlite | SqlFamily::HogQl => Box::new(SQLiteDialect {}),
    }
}

fn parse_one(family: SqlFamily, sql: &str) -> Result<Statement, McpFailure> {
    if family == SqlFamily::MySql && (sql.contains("/*!") || sql.contains("/*M!")) {
        return Err(not_allowed("MySQL executable comments are not allowed."));
    }
    let dialect = dialect_for(family);
    let mut statements = Parser::parse_sql(dialect.as_ref(), sql).map_err(|error| {
        McpFailure::new(
            McpErrorCode::ParseFailed,
            format!("Dora could not parse this statement: {error}"),
        )
    })?;
    match statements.len() {
        1 => statements.pop().ok_or_else(McpFailure::internal),
        0 => Err(McpFailure::new(
            McpErrorCode::InvalidInput,
            "The SQL contains no statement.",
        )),
        _ => Err(McpFailure::new(
            McpErrorCode::MultipleStatements,
            "Send exactly one statement per item.",
        )),
    }
}

fn not_allowed(message: impl Into<String>) -> McpFailure {
    McpFailure::new(McpErrorCode::StatementNotAllowed, message)
}

fn normalized_function(family: SqlFamily, name: &ObjectName) -> Option<String> {
    match name.0.as_slice() {
        [function] => Some(function.value.to_ascii_lowercase()),
        [schema, function]
            if family == SqlFamily::Postgres && schema.value.eq_ignore_ascii_case("pg_catalog") =>
        {
            Some(function.value.to_ascii_lowercase())
        }
        _ => None,
    }
}

struct PolicyVisitor {
    family: SqlFamily,
    allow_write_functions: bool,
}

impl PolicyVisitor {
    fn check_function(&self, name: &ObjectName) -> Result<(), McpFailure> {
        let allowed = normalized_function(self.family, name).is_some_and(|function| {
            is_allowed_function(self.family, &function, self.allow_write_functions)
        });
        if allowed {
            Ok(())
        } else {
            Err(McpFailure::new(
                McpErrorCode::FunctionNotAllowed,
                format!("The function '{name}' is not allowed for agents."),
            ))
        }
    }

    fn check_set_expr(&self, body: &SetExpr) -> Result<(), McpFailure> {
        match body {
            SetExpr::Select(select) if select.into.is_some() => {
                Err(not_allowed("SELECT INTO is not allowed."))
            }
            SetExpr::Select(_) | SetExpr::Query(_) | SetExpr::Values(_) => Ok(()),
            SetExpr::Table(_) => Err(not_allowed("TABLE statements are not allowed.")),
            SetExpr::SetOperation { left, right, .. } => {
                self.check_set_expr(left)?;
                self.check_set_expr(right)
            }
            SetExpr::Insert(_) | SetExpr::Update(_) => Err(not_allowed(
                "Data-modifying statements inside a query are not allowed.",
            )),
        }
    }

    fn check_query(&self, query: &Query) -> Result<(), McpFailure> {
        if !query.locks.is_empty() {
            return Err(not_allowed("Locking clauses are not allowed."));
        }
        self.check_set_expr(&query.body)
    }

    fn check_table_factor(&self, factor: &TableFactor) -> Result<(), McpFailure> {
        match factor {
            TableFactor::Table {
                name,
                args: Some(_),
                ..
            } => {
                let allowed = normalized_function(self.family, name)
                    .is_some_and(|function| is_allowed_table_function(self.family, &function));
                if allowed {
                    Ok(())
                } else {
                    Err(McpFailure::new(
                        McpErrorCode::FunctionNotAllowed,
                        format!("The table function '{name}' is not allowed for agents."),
                    ))
                }
            }
            TableFactor::Table { .. }
            | TableFactor::Derived { .. }
            | TableFactor::NestedJoin { .. }
            | TableFactor::UNNEST { .. } => Ok(()),
            _ => Err(not_allowed("This table expression is not allowed.")),
        }
    }

    fn check_relation(&self, relation: &ObjectName) -> Result<(), McpFailure> {
        if relation.0.iter().any(|part| part.quote_style == Some('\'')) {
            return Err(not_allowed("String table references are not allowed."));
        }
        let parts: Vec<String> = relation
            .0
            .iter()
            .map(|part| part.value.to_ascii_lowercase())
            .collect();
        if is_denied_relation(self.family, &parts) {
            return Err(not_allowed(format!(
                "The relation '{relation}' is not available to agents."
            )));
        }
        Ok(())
    }
}

impl Visitor for PolicyVisitor {
    type Break = McpFailure;

    fn pre_visit_query(&mut self, query: &Query) -> ControlFlow<Self::Break> {
        to_flow(self.check_query(query))
    }

    fn pre_visit_relation(&mut self, relation: &ObjectName) -> ControlFlow<Self::Break> {
        to_flow(self.check_relation(relation))
    }

    fn pre_visit_table_factor(&mut self, factor: &TableFactor) -> ControlFlow<Self::Break> {
        to_flow(self.check_table_factor(factor))
    }

    fn pre_visit_expr(&mut self, expr: &Expr) -> ControlFlow<Self::Break> {
        if let Expr::Function(function) = expr {
            if matches!(function.parameters, FunctionArguments::List(_)) {
                return ControlFlow::Break(not_allowed("Parametric functions are not allowed."));
            }
            return to_flow(self.check_function(&function.name));
        }
        ControlFlow::Continue(())
    }
}

fn to_flow(result: Result<(), McpFailure>) -> ControlFlow<McpFailure> {
    match result {
        Ok(()) => ControlFlow::Continue(()),
        Err(failure) => ControlFlow::Break(failure),
    }
}

fn walk(
    statement: &Statement,
    family: SqlFamily,
    allow_write_functions: bool,
) -> Result<(), McpFailure> {
    let mut visitor = PolicyVisitor {
        family,
        allow_write_functions,
    };
    match statement.visit(&mut visitor) {
        ControlFlow::Continue(()) => Ok(()),
        ControlFlow::Break(failure) => Err(failure),
    }
}

fn is_allowed_read(statement: &Statement) -> bool {
    match statement {
        Statement::Query(_)
        | Statement::ShowCreate { .. }
        | Statement::ShowColumns { .. }
        | Statement::ShowDatabases { .. }
        | Statement::ShowSchemas { .. }
        | Statement::ShowTables { .. }
        | Statement::ShowViews { .. } => true,
        Statement::Explain {
            analyze: false,
            statement,
            ..
        } => matches!(statement.as_ref(), Statement::Query(_)),
        _ => false,
    }
}

fn apply_row_limit(query: &mut Query, max_rows: usize) -> Result<(), McpFailure> {
    if query.fetch.is_some() || !query.limit_by.is_empty() {
        return Err(McpFailure::new(
            McpErrorCode::UnsupportedLimit,
            "Use a plain numeric LIMIT.",
        ));
    }
    let requested = max_rows as u64 + 1;
    let limit = match &query.limit {
        None => requested,
        Some(Expr::Value(Value::Number(number, _))) => number
            .parse::<u64>()
            .map(|value| value.min(requested))
            .map_err(|_| {
                McpFailure::new(McpErrorCode::UnsupportedLimit, "Use a plain numeric LIMIT.")
            })?,
        Some(_) => {
            return Err(McpFailure::new(
                McpErrorCode::UnsupportedLimit,
                "Use a plain numeric LIMIT.",
            ))
        }
    };
    query.limit = Some(Expr::Value(Value::Number(limit.to_string(), false)));
    Ok(())
}

pub struct ApprovedRead {
    pub sql: String,
    pub functions: Vec<String>,
}

pub struct CheckedWrite {
    pub risk: AgentProposalRisk,
    pub functions: Vec<String>,
}

struct FunctionCollector {
    family: SqlFamily,
    names: BTreeSet<String>,
}

impl FunctionCollector {
    fn add(&mut self, name: &ObjectName) {
        if let Some(function) = normalized_function(self.family, name) {
            self.names.insert(function);
        }
    }
}

impl Visitor for FunctionCollector {
    type Break = ();

    fn pre_visit_table_factor(&mut self, factor: &TableFactor) -> ControlFlow<Self::Break> {
        if let TableFactor::Table {
            name,
            args: Some(_),
            ..
        } = factor
        {
            self.add(name);
        }
        ControlFlow::Continue(())
    }

    fn pre_visit_expr(&mut self, expr: &Expr) -> ControlFlow<Self::Break> {
        if let Expr::Function(function) = expr {
            self.add(&function.name);
        }
        ControlFlow::Continue(())
    }
}

fn collect_functions(family: SqlFamily, statements: &[Statement]) -> Vec<String> {
    let mut collector = FunctionCollector {
        family,
        names: BTreeSet::new(),
    };
    for statement in statements {
        let _ = statement.visit(&mut collector);
    }
    collector.names.into_iter().collect()
}

/// @name check_read_statement
/// @description Approves exactly one read statement for a dialect and returns
/// the SQL to run, with a row limit applied. Anything unclear is refused.
///
/// @example
/// let approved = check_read_statement(SqlFamily::Postgres, "SELECT 1", 200)?;
pub fn check_read_statement(
    family: SqlFamily,
    sql: &str,
    max_rows: usize,
) -> Result<ApprovedRead, McpFailure> {
    let mut statement = parse_one(family, sql)?;
    if !is_allowed_read(&statement) {
        return Err(not_allowed("Only one read-only statement is allowed."));
    }
    walk(&statement, family, false)?;
    let functions = collect_functions(family, std::slice::from_ref(&statement));

    if let Statement::Query(query) = &mut statement {
        apply_row_limit(query, max_rows)?;
        let rewritten = statement.to_string();
        let reparsed = parse_one(family, &rewritten)?;
        if !matches!(reparsed, Statement::Query(_)) {
            return Err(not_allowed(
                "The statement changed while applying its limit.",
            ));
        }
        walk(&reparsed, family, false)?;
        return Ok(ApprovedRead {
            sql: rewritten,
            functions,
        });
    }
    Ok(ApprovedRead {
        sql: statement.to_string(),
        functions,
    })
}

fn expr_references_column(expr: &Expr) -> bool {
    struct ColumnFinder;

    impl Visitor for ColumnFinder {
        type Break = ();

        fn pre_visit_expr(&mut self, expr: &Expr) -> ControlFlow<Self::Break> {
            match expr {
                Expr::Identifier(_) | Expr::CompoundIdentifier(_) => ControlFlow::Break(()),
                _ => ControlFlow::Continue(()),
            }
        }
    }

    expr.visit(&mut ColumnFinder).is_break()
}

fn is_column(expr: &Expr) -> bool {
    match expr {
        Expr::Identifier(_) | Expr::CompoundIdentifier(_) => true,
        Expr::Nested(inner) => is_column(inner),
        _ => false,
    }
}

fn is_narrow_filter(expr: &Expr) -> bool {
    match expr {
        Expr::Nested(inner) => is_narrow_filter(inner),
        Expr::BinaryOp {
            left,
            op: BinaryOperator::And,
            right,
        } => is_narrow_filter(left) || is_narrow_filter(right),
        Expr::BinaryOp {
            left,
            op: BinaryOperator::Or,
            right,
        } => is_narrow_filter(left) && is_narrow_filter(right),
        Expr::BinaryOp {
            left,
            op: BinaryOperator::Eq,
            right,
        } => {
            (is_column(left) && !expr_references_column(right))
                || (is_column(right) && !expr_references_column(left))
        }
        Expr::InList {
            expr,
            list,
            negated: false,
        } => is_column(expr) && !list.iter().any(expr_references_column),
        _ => false,
    }
}

fn has_narrow_filter(selection: Option<&Expr>) -> bool {
    selection.is_some_and(is_narrow_filter)
}

fn risk_of(statement: &Statement) -> AgentProposalRisk {
    let standard = match statement {
        Statement::Insert(insert) => {
            insert.or.is_none() && !insert.replace_into && insert.on.is_none() && !insert.overwrite
        }
        Statement::Update { selection, .. } => has_narrow_filter(selection.as_ref()),
        Statement::Delete(delete) => has_narrow_filter(delete.selection.as_ref()),
        Statement::CreateTable(create) => !create.or_replace,
        Statement::CreateIndex(_) => true,
        Statement::CreateView { or_replace, .. } => !or_replace,
        _ => false,
    };
    if standard {
        AgentProposalRisk::Standard
    } else {
        AgentProposalRisk::Destructive
    }
}

fn batch_risk(statements: &[Statement]) -> AgentProposalRisk {
    if statements
        .iter()
        .any(|statement| risk_of(statement) == AgentProposalRisk::Destructive)
    {
        AgentProposalRisk::Destructive
    } else {
        AgentProposalRisk::Standard
    }
}

fn require_atomic_batch(family: SqlFamily, statements: &[Statement]) -> Result<(), McpFailure> {
    let has_non_dml = statements.iter().any(|statement| {
        !matches!(
            statement,
            Statement::Insert(_) | Statement::Update { .. } | Statement::Delete(_)
        )
    });
    if family == SqlFamily::MySql && statements.len() > 1 && has_non_dml {
        return Err(McpFailure::new(
            McpErrorCode::AtomicBatchUnsupported,
            "MySQL commits around schema changes. Send schema changes as a single statement.",
        ));
    }
    Ok(())
}

fn parse_batch(family: SqlFamily, statements: &[String]) -> Result<Vec<Statement>, McpFailure> {
    let parsed = statements
        .iter()
        .map(|statement| parse_one(family, statement))
        .collect::<Result<Vec<_>, _>>()?;
    require_atomic_batch(family, &parsed)?;
    Ok(parsed)
}

/// @name check_proposal
/// @description Parses every proposed statement and returns the batch risk. A
/// person reviews the exact SQL, so functions are not restricted here.
///
/// @example
/// let risk = check_proposal(SqlFamily::Postgres, &statements)?;
pub fn check_proposal(
    family: SqlFamily,
    statements: &[String],
) -> Result<AgentProposalRisk, McpFailure> {
    Ok(batch_risk(&parse_batch(family, statements)?))
}

/// @name check_write
/// @description Classifies a direct write batch. Standard batches also pass the
/// function and relation policy, destructive batches must become proposals.
///
/// @example
/// let checked = check_write(SqlFamily::Postgres, &statements)?;
pub fn check_write(family: SqlFamily, statements: &[String]) -> Result<CheckedWrite, McpFailure> {
    let parsed = parse_batch(family, statements)?;
    let risk = batch_risk(&parsed);
    if risk == AgentProposalRisk::Standard {
        for statement in &parsed {
            walk(statement, family, true)?;
        }
    }
    Ok(CheckedWrite {
        risk,
        functions: collect_functions(family, &parsed),
    })
}
