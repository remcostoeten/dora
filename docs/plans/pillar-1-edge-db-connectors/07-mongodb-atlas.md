# Plan (epic stub): MongoDB Atlas connector

**Tier:** epic. **Effort:** L (new paradigm). **Depends on:** nothing, but is the
largest connector — scope as its own project.

> Biggest TAM of the list, but the biggest lift: MongoDB is a **document
> database**, not relational. The studio's grid, SQL console, schema view, and
> ORM runners assume tables/SQL. Supporting Mongo means a new query/result
> paradigm. **Defer behind D1 + the cheap relational connectors.**

## Why it's big

- New `DatabaseClient::Mongo` variant + a Mongo adapter (the official `mongodb`
  Rust crate over the `mongodb+srv://` connection string).
- Atlas discovery API (connect-flow half): Atlas Admin API uses **HTTP digest
  auth** with a public/private API key pair (not a single bearer token), and
  resource hierarchy is org → project → cluster. The connect-flow must collect
  the API key pair, list projects/clusters, and assemble the `mongodb+srv` URI
  (the DB user/password is separate from the Admin API key — likely a manual
  field, mirroring Supabase's password constraint).
- New UI: collection browser, document (JSON tree) viewer/editor, find/filter
  via Mongo query language or a query builder — **not** a SQL console or a flat
  grid. New feature module.
- Schema is implicit; "introspection" means sampling documents to infer fields.

## If/when pursued — phasing

1. Connect-flow half: `integrations/mongodb.rs` — API-key-pair auth, list
   projects/clusters, `current_account` (org/project). Assemble `mongodb+srv`
   URI (+ manual DB user/password field).
2. `DatabaseType::Mongo` + connection model.
3. `database/mongo/` adapter: connect, list databases/collections, sample-based
   schema inference, find/aggregate execution.
4. New frontend `features/mongo-browser/`: collection list, document tree
   view/edit, query input. Gate relational-only studio panels off for Mongo.

## Recommendation

Validate demand first. This is a strategic bet (broadens TAM well beyond the
serverless-TS ICP) but it's a multi-week effort and dilutes the wedge. Keep as a
scoping note; do not start in parallel with the cheap connectors.
