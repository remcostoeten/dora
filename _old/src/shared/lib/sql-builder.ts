// SQL Query Builder Abstraction Layer

export interface QueryBuilder {
  select(columns: string[]): SelectBuilder
  insert(table: string): InsertBuilder
  update(table: string): UpdateBuilder
  delete(table: string): DeleteBuilder
  raw(sql: string): RawBuilder
}

export interface SelectBuilder {
  from(table: string): SelectFromBuilder
  where(condition: string, ...params: any[]): SelectWhereBuilder
  limit(count: number): SelectLimitBuilder
  orderBy(column: string, direction?: 'ASC' | 'DESC'): SelectOrderByBuilder
  build(): { sql: string; params: any[] }
}

export interface SelectFromBuilder {
  where(condition: string, ...params: any[]): SelectWhereBuilder
  join(table: string, on: string): SelectJoinBuilder
  leftJoin(table: string, on: string): SelectJoinBuilder
  limit(count: number): SelectLimitBuilder
  orderBy(column: string, direction?: 'ASC' | 'DESC'): SelectOrderByBuilder
  build(): { sql: string; params: any[] }
}

export interface SelectWhereBuilder {
  and(condition: string, ...params: any[]): SelectWhereBuilder
  or(condition: string, ...params: any[]): SelectWhereBuilder
  limit(count: number): SelectLimitBuilder
  orderBy(column: string, direction?: 'ASC' | 'DESC'): SelectOrderByBuilder
  build(): { sql: string; params: any[] }
}

export interface SelectJoinBuilder extends SelectWhereBuilder, SelectFromBuilder {}
export interface SelectLimitBuilder extends SelectWhereBuilder, SelectFromBuilder {}
export interface SelectOrderByBuilder extends SelectWhereBuilder, SelectFromBuilder {}

export interface InsertBuilder {
  values(data: Record<string, any>): InsertValuesBuilder
  build(): { sql: string; params: any[] }
}

export interface InsertValuesBuilder {
  build(): { sql: string; params: any[] }
}

export interface UpdateBuilder {
  set(data: Record<string, any>): UpdateSetBuilder
  where(condition: string, ...params: any[]): UpdateWhereBuilder
  build(): { sql: string; params: any[] }
}

export interface UpdateSetBuilder extends UpdateWhereBuilder {
  where(condition: string, ...params: any[]): UpdateWhereBuilder
  build(): { sql: string; params: any[] }
}

export interface UpdateWhereBuilder {
  and(condition: string, ...params: any[]): UpdateWhereBuilder
  or(condition: string, ...params: any[]): UpdateWhereBuilder
  build(): { sql: string; params: any[] }
}

export interface DeleteBuilder {
  where(condition: string, ...params: any[]): DeleteWhereBuilder
  build(): { sql: string; params: any[] }
}

export interface DeleteWhereBuilder {
  and(condition: string, ...params: any[]): DeleteWhereBuilder
  or(condition: string, ...params: any[]): DeleteWhereBuilder
  build(): { sql: string; params: any[] }
}

export interface RawBuilder {
  build(): { sql: string; params: any[] }
}

// Implementation
export class SQLQueryBuilder implements QueryBuilder {
  select(columns: string[] = ['*']): SelectBuilder {
    return new SelectBuilderImpl(columns)
  }

  insert(table: string): InsertBuilder {
    return new InsertBuilderImpl(table)
  }

  update(table: string): UpdateBuilder {
    return new UpdateBuilderImpl(table)
  }

  delete(table: string): DeleteBuilder {
    return new DeleteBuilderImpl(table)
  }

  raw(sql: string): RawBuilder {
    return new RawBuilderImpl(sql)
  }

  static table(table: string): SelectFromBuilder {
    return new SelectBuilderImpl(['*']).from(table)
  }
}

class SelectBuilderImpl implements SelectBuilder {
  private _columns: string[]
  private _table?: string
  private _wheres: { condition: string; params: any[] }[] = []
  private _joins: { type: string; table: string; on: string }[] = []
  private _limit?: number
  private _orderBy?: { column: string; direction: 'ASC' | 'DESC' }

  constructor(columns: string[]) {
    this._columns = columns
  }

  from(table: string): SelectFromBuilder {
    this._table = table
    return this
  }

  where(condition: string, ...params: any[]): SelectWhereBuilder {
    this._wheres.push({ condition, params })
    return this
  }

  and(condition: string, ...params: any[]): SelectWhereBuilder {
    this._wheres.push({ condition: `AND ${condition}`, params })
    return this
  }

  or(condition: string, ...params: any[]): SelectWhereBuilder {
    this._wheres.push({ condition: `OR ${condition}`, params })
    return this
  }

  join(table: string, on: string): SelectJoinBuilder {
    this._joins.push({ type: 'JOIN', table, on })
    return this
  }

  leftJoin(table: string, on: string): SelectJoinBuilder {
    this._joins.push({ type: 'LEFT JOIN', table, on })
    return this
  }

  limit(count: number): SelectLimitBuilder {
    this._limit = count
    return this
  }

  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): SelectOrderByBuilder {
    this._orderBy = { column, direction }
    return this
  }

  build(): { sql: string; params: any[] } {
    if (!this._table) {
      throw new Error('Table is required for SELECT query')
    }

    let sql = `SELECT ${this._columns.join(', ')} FROM "${this._table}"`
    const params: any[] = []

    for (const join of this._joins) {
      sql += ` ${join.type} "${join.table}" ON ${join.on}`
    }

    if (this._wheres.length > 0) {
      sql += ' WHERE ' + this._wheres.map(w => w.condition).join(' ')
      params.push(...this._wheres.flatMap(w => w.params))
    }

    if (this._orderBy) {
      sql += ` ORDER BY "${this._orderBy.column}" ${this._orderBy.direction}`
    }

    if (this._limit) {
      sql += ` LIMIT ${this._limit}`
    }

    return { sql, params }
  }
}

class InsertBuilderImpl implements InsertBuilder {
  private _table: string
  private _data?: Record<string, any>

  constructor(table: string) {
    this._table = table
  }

  values(data: Record<string, any>): InsertValuesBuilder {
    this._data = data
    return this
  }

  build(): { sql: string; params: any[] } {
    if (!this._data) {
      throw new Error('Values are required for INSERT query')
    }

    const columns = Object.keys(this._data)
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
    const params = Object.values(this._data)

    const sql = `INSERT INTO "${this._table}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`
    return { sql, params }
  }
}

class UpdateBuilderImpl implements UpdateBuilder {
  private _table: string
  private _data?: Record<string, any>
  private _wheres: { condition: string; params: any[] }[] = []

  constructor(table: string) {
    this._table = table
  }

  set(data: Record<string, any>): UpdateSetBuilder {
    this._data = data
    return this
  }

  where(condition: string, ...params: any[]): UpdateWhereBuilder {
    this._wheres.push({ condition, params })
    return this
  }

  and(condition: string, ...params: any[]): UpdateWhereBuilder {
    this._wheres.push({ condition: `AND ${condition}`, params })
    return this
  }

  or(condition: string, ...params: any[]): UpdateWhereBuilder {
    this._wheres.push({ condition: `OR ${condition}`, params })
    return this
  }

  build(): { sql: string; params: any[] } {
    if (!this._data) {
      throw new Error('SET data is required for UPDATE query')
    }

    const setClause = Object.keys(this._data)
      .map((key, i) => `"${key}" = $${i + 1}`)
      .join(', ')
    
    const params = [...Object.values(this._data)]
    let sql = `UPDATE "${this._table}" SET ${setClause}`

    if (this._wheres.length > 0) {
      sql += ' WHERE ' + this._wheres.map(w => w.condition).join(' ')
      params.push(...this._wheres.flatMap(w => w.params))
    }

    return { sql, params }
  }
}

class DeleteBuilderImpl implements DeleteBuilder {
  private _table: string
  private _wheres: { condition: string; params: any[] }[] = []

  constructor(table: string) {
    this._table = table
  }

  where(condition: string, ...params: any[]): DeleteWhereBuilder {
    this._wheres.push({ condition, params })
    return this
  }

  and(condition: string, ...params: any[]): DeleteWhereBuilder {
    this._wheres.push({ condition: `AND ${condition}`, params })
    return this
  }

  or(condition: string, ...params: any[]): DeleteWhereBuilder {
    this._wheres.push({ condition: `OR ${condition}`, params })
    return this
  }

  build(): { sql: string; params: any[] } {
    let sql = `DELETE FROM "${this._table}"`
    const params: any[] = []

    if (this._wheres.length > 0) {
      sql += ' WHERE ' + this._wheres.map(w => w.condition).join(' ')
      params.push(...this._wheres.flatMap(w => w.params))
    }

    return { sql, params }
  }
}

class RawBuilderImpl implements RawBuilder {
  private _sql: string
  private _params: any[] = []

  constructor(sql: string) {
    this._sql = sql
  }

  build(): { sql: string; params: any[] } {
    return { sql: this._sql, params: this._params }
  }
}

// Factory function
export const sql = new SQLQueryBuilder()

// Usage examples:
/*
// SELECT
const { sql: selectSql, params } = sql
  .select(['id', 'name', 'email'])
  .from('users')
  .where('age > ?', 18)
  .and('status = ?', 'active')
  .orderBy('name', 'ASC')
  .limit(10)
  .build()

// INSERT
const { sql: insertSql, params: insertParams } = sql
  .insert('users')
  .values({ name: 'John', email: 'john@example.com', age: 25 })
  .build()

// UPDATE
const { sql: updateSql, params: updateParams } = sql
  .update('users')
  .set({ status: 'inactive' })
  .where('last_login < ?', '2023-01-01')
  .build()

// DELETE
const { sql: deleteSql, params: deleteParams } = sql
  .delete('users')
  .where('status = ?', 'deleted')
  .build()

// Raw SQL
const { sql: rawSql } = sql.raw('SELECT COUNT(*) FROM users').build()
*/