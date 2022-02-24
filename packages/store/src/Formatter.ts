import {CursorData} from './Cursor'
import {BinOp, ExprData, ExprType, UnOp} from './Expr'
import {From, FromType} from './From'
import {OrderBy, OrderDirection} from './OrderBy'
import {Param, ParamType} from './Param'
import {SelectionData, SelectionType} from './Selection'
import {sql, Statement} from './Statement'

const binOps = {
  [BinOp.Add]: '+',
  [BinOp.Subt]: '-',
  [BinOp.Mult]: '*',
  [BinOp.Mod]: '%',
  [BinOp.Div]: '/',
  [BinOp.Greater]: '>',
  [BinOp.GreaterOrEqual]: '>=',
  [BinOp.Less]: '<',
  [BinOp.LessOrEqual]: '<=',
  [BinOp.Equals]: '=',
  [BinOp.NotEquals]: '!=',
  [BinOp.And]: 'and',
  [BinOp.Or]: 'or',
  [BinOp.Like]: 'like',
  [BinOp.Glob]: 'glob',
  [BinOp.Match]: 'match',
  [BinOp.In]: 'in',
  [BinOp.NotIn]: 'not in',
  [BinOp.Concat]: '||'
}

export type FormatCursorOptions = {
  formatInline?: boolean
  includeSelection?: boolean
  formatSubject?: (selection: Statement) => Statement
}

export type FormatExprOptions = FormatCursorOptions & {
  formatAsJsonValue?: boolean
  formatShallow?: boolean
}

export abstract class Formatter {
  constructor() {}

  abstract escape(value: any): string
  abstract escapeId(id: string): string
  abstract formatAccess(on: Statement, field: string): Statement
  abstract formatField(path: Array<string>, shallow: boolean): Statement
  abstract formatUnwrapArray(sql: Statement): Statement

  formatFrom(from: From, options: FormatExprOptions): Statement {
    switch (from.type) {
      case FromType.Table:
        return Statement.raw(
          from.alias
            ? `${this.escapeId(from.name)} as ${this.escapeId(from.alias)}`
            : this.escapeId(from.name)
        )
      case FromType.Column:
        return this.formatFrom(from.of, options)
      case FromType.Join:
        const left = this.formatFrom(from.left, options)
        const right = this.formatFrom(from.right, options)
        const on = this.formatExpr(from.on, options)
        const join = from.join === 'left' ? 'left' : 'inner'
        return sql`${left} ${Statement.raw(join)} join ${right} on ${on}`
    }
  }

  formatOrderBy(
    orderBy: Array<OrderBy> | undefined,
    options: FormatExprOptions
  ): Statement {
    if (!orderBy || orderBy.length == 0) return Statement.EMPTY
    const orders = []
    const params = []
    for (const {expr, order} of orderBy) {
      const stmt = this.formatExpr(expr, options)
      orders.push(
        `${stmt.sql} ${order === OrderDirection.Asc ? 'asc' : 'desc'}`
      )
      params.push(...stmt.params)
    }
    return new Statement(`order by ${orders.join(', ')}`, params)
  }

  formatWhere(
    where: ExprData | undefined,
    options: FormatExprOptions
  ): Statement {
    return where
      ? sql`where ${this.formatExpr(where, options)}`
      : Statement.EMPTY
  }

  formatGroupBy(
    groupBy: Array<ExprData> | undefined,
    options: FormatExprOptions
  ) {
    if (!groupBy || groupBy.length == 0) return Statement.EMPTY
    const groups = []
    const params = []
    for (const expr of groupBy) {
      const stmt = this.formatExpr(expr, options)
      groups.push(stmt.sql)
      params.push(...stmt.params)
    }
    return new Statement(`group by ${groups.join(', ')}`, params)
  }

  formatHaving(
    having: ExprData | undefined,
    options: FormatExprOptions
  ): Statement {
    return having
      ? sql`having ${this.formatExpr(having, options)}`
      : Statement.EMPTY
  }

  formatSelection(
    selection: SelectionData,
    options: FormatExprOptions
  ): Statement {
    switch (selection.type) {
      case SelectionType.Row:
        const {source} = selection
        switch (source.type) {
          case FromType.Column:
            return Statement.raw(
              `json(${this.escapeId(From.source(source))}.${this.escapeId(
                source.column
              )})`
            )
          case FromType.Table:
            return this.formatSelection(
              SelectionData.Fields(
                Object.fromEntries(
                  source.columns.map(column => [
                    column,
                    SelectionData.Expr(
                      ExprData.Field([source.alias || source.name, column])
                    )
                  ])
                )
              ),
              options
            )
          case FromType.Join:
            throw 'assert'
        }
      case SelectionType.Cursor:
        const sub = this.formatCursor(selection.cursor, {
          ...options,
          formatSubject: subject => sql`${subject} as res`
        })
        if (selection.cursor.singleResult) return sql`(select ${sub})`
        return sql`(select json_group_array(json(res)) from (select ${sub}))`
      case SelectionType.Expr:
        return this.formatExpr(selection.expr, options)
      case SelectionType.With:
        const a = this.formatSelection(selection.a, options)
        const b = this.formatSelection(selection.b, options)
        return sql`json_patch(${a}, ${b})`
      case SelectionType.Fields:
        let res = Statement.EMPTY
        const keys = Object.keys(selection.fields)
        Object.entries(selection.fields).forEach(([key, value], i) => {
          res = sql`${res}${Statement.raw(
            this.escape(key)
          )}, ${this.formatSelection(value, options)}`
          if (i < keys.length - 1) res = sql`${res}, `
        })
        return sql`json_object(${res})`
      case SelectionType.Case:
        throw `Not supported in current formatter: _.case(...)`
    }
  }

  formatCursor(cursor: CursorData, options: FormatCursorOptions): Statement {
    const subject = this.formatSelection(cursor.selection, options)
    const select = options.includeSelection
      ? options.formatSubject
        ? options.formatSubject(subject)
        : subject
      : undefined
    const from = sql`from ${this.formatFrom(cursor.from, options)}`
    const where = this.formatWhere(cursor.where, options)
    const groupBy = this.formatGroupBy(cursor.groupBy, options)
    const having = this.formatHaving(cursor.having, options)
    const order = this.formatOrderBy(cursor.orderBy, options)
    const limit =
      cursor.limit !== undefined || cursor.offset !== undefined
        ? sql`limit ${
            options.formatInline
              ? new Statement(this.escape(cursor.limit || 0))
              : Param.value(cursor.limit || 0)
          }`
        : undefined
    const offset =
      cursor.offset !== undefined
        ? sql`offset ${
            options.formatInline
              ? new Statement(this.escape(cursor.offset))
              : Param.value(cursor.offset)
          }`
        : undefined
    return sql`${select} ${from} ${where} ${groupBy} ${having} ${order} ${limit} ${offset}`
  }

  formatExpr(expr: ExprData, options: FormatExprOptions): Statement {
    switch (expr.type) {
      case ExprType.UnOp:
        if (expr.op === UnOp.IsNull)
          return sql`${this.formatExpr(expr.expr, options)} is null`
        return sql`!(${this.formatExpr(expr.expr, options)})`
      case ExprType.BinOp:
        if (
          (expr.op === BinOp.In || expr.op === BinOp.NotIn) &&
          expr.b.type === ExprType.Field
        ) {
          return sql`(${this.formatExpr(expr.a, options)} ${Statement.raw(
            binOps[expr.op]
          )} ${this.formatUnwrapArray(this.formatExpr(expr.b, options))})`
        }
        return sql`(${this.formatExpr(expr.a, options)} ${Statement.raw(
          binOps[expr.op]
        )} ${this.formatExpr(expr.b, options)})`
      case ExprType.Param:
        switch (expr.param.type) {
          case ParamType.Named:
            return new Statement('?', [expr.param])
          case ParamType.Value:
            const value = expr.param.value
            switch (true) {
              case value === null:
                return sql`null`
              case typeof value === 'boolean':
                return value ? sql`1` : sql`0`
              case Array.isArray(value):
                const res = sql`(${Statement.raw(
                  value.map((v: any): string => this.escape(v)).join(', ')
                )})`
                return options.formatAsJsonValue ? sql`json_array${res}` : res
              case typeof value === 'string' || typeof value === 'number':
                if (options.formatInline)
                  return Statement.raw(this.escape(value))
                return new Statement('?', [expr.param])
              default:
                return new Statement(this.escape(value))
            }
        }
      case ExprType.Field:
        return this.formatField(expr.path, Boolean(options.formatShallow))
      case ExprType.Call: {
        const params = expr.params.map(e => this.formatExpr(e, options))
        const expressions = params.map(stmt => stmt.sql).join(', ')
        return new Statement(
          `${this.escapeId(expr.method)}(${expressions})`,
          params.flatMap(stmt => stmt.params)
        )
      }
      case ExprType.Access:
        return this.formatAccess(
          this.formatExpr(expr.expr, options),
          expr.field
        )
      case ExprType.Query:
        return sql`(select ${this.formatCursor(expr.cursor, options)})`
    }
  }

  formatSelect(cursor: CursorData, options: FormatCursorOptions = {}) {
    return sql`select ${this.formatCursor(cursor, {
      ...options,
      includeSelection: true
    })}`
  }

  formatDelete(cursor: CursorData, options: FormatCursorOptions = {}) {
    return sql`delete ${this.formatCursor(cursor, {
      ...options,
      includeSelection: false
    })}`
  }

  // Todo: make abstract
  formatUpdateColumn(
    update: Record<string, any>,
    options: FormatExprOptions
  ): Statement {
    let source = new Statement('`data`')
    for (const [key, value] of Object.entries(update)) {
      const expr = this.formatExpr(ExprData.create(value), {
        ...options,
        formatAsJsonValue: true
      })
      source = sql`json_set(${source}, ${Statement.raw(
        this.escape(`$.${key}`)
      )}, ${expr})`
    }
    return sql`set \`data\` = ${source}`
  }

  formatUpdateTable(
    columns: Array<string>,
    update: Record<string, any>,
    options: FormatExprOptions
  ): Statement {
    const stmts = []
    for (const column of columns) {
      if (!(column in update)) continue
      const expr = this.formatExpr(ExprData.create(update[column]), {
        ...options,
        formatAsJsonValue: true
      })
      stmts.push(sql`${Statement.raw(this.escapeId(column))} = ${expr}`)
    }
    const cols = stmts.map(stmt => stmt.sql).join(', ')
    const params = stmts.flatMap(stmt => stmt.params)
    return sql`set ${new Statement(cols, params)}`
  }

  formatUpdate(
    cursor: CursorData,
    update: Record<string, any>,
    options: FormatCursorOptions = {}
  ) {
    const from = this.formatFrom(cursor.from, options)
    const set =
      cursor.from.type === FromType.Table
        ? this.formatUpdateTable(cursor.from.columns, update, options)
        : this.formatUpdateColumn(update, options)
    const where = this.formatWhere(cursor.where, options)
    return sql`update ${from} ${set} ${where}`
  }
}