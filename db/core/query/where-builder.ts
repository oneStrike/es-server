import type {
  DrizzleColumnKey,
  DrizzleWhere,
  DrizzleWhereCondition,
  DrizzleWhereNode,
  DrizzleWhereObjectNode,
  PgTable,
} from '../drizzle.type'
import {
  and,
  between,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  not,
  or,
} from 'drizzle-orm'
import { escapeLikePattern, isWhereFieldFilter } from './input-guard'

export function buildDrizzleWhere<TTable extends PgTable>(
  table: TTable,
  node?: DrizzleWhereNode<TTable>,
): DrizzleWhere {
  return compileWhereNode(table, node)
}

function compileWhereNode<TTable extends PgTable>(
  table: TTable,
  node?: DrizzleWhereNode<TTable>,
): DrizzleWhere {
  if (!node) {
    return undefined
  }

  if ('and' in node) {
    const andNodes = Array.isArray(node.and)
      ? node.and
      : expandWhereObjectNode(node.and)
    const conditions = andNodes
      .map((item) => compileWhereNode(table, item))
      .filter(Boolean)
    return conditions.length > 0 ? and(...conditions) : undefined
  }

  if ('or' in node) {
    const orNodes = Array.isArray(node.or)
      ? node.or
      : expandWhereObjectNode(node.or)
    const conditions = orNodes
      .map((item) => compileWhereNode(table, item))
      .filter(Boolean)
    return conditions.length > 0 ? or(...conditions) : undefined
  }

  if ('not' in node) {
    const condition = compileWhereNode(table, node.not)
    return condition ? not(condition) : undefined
  }

  return compileWhereCondition(table, node)
}

function compileWhereCondition<TTable extends PgTable>(
  table: TTable,
  condition: DrizzleWhereCondition<TTable>,
): DrizzleWhere {
  const columns = table as unknown as Record<DrizzleColumnKey<TTable>, any>
  const column = columns[condition.field]
  if (!column) {
    return undefined
  }

  if (condition.op === 'isNull') {
    return isNull(column)
  }
  if (condition.op === 'isNotNull') {
    return isNotNull(column)
  }
  if (condition.op === 'between') {
    const from = condition.value.from
    const to = condition.value.to
    if (from !== undefined && to !== undefined) {
      return between(column, from, to)
    }
    if (from !== undefined) {
      return gte(column, from)
    }
    if (to !== undefined) {
      return lte(column, to)
    }
    return undefined
  }
  if (condition.op === 'in') {
    if (!Array.isArray(condition.value) || condition.value.length === 0) {
      return undefined
    }
    return inArray(column, condition.value)
  }
  if (condition.op === 'notIn') {
    if (!Array.isArray(condition.value) || condition.value.length === 0) {
      return undefined
    }
    return not(inArray(column, condition.value))
  }
  if (condition.op === 'like') {
    if (condition.value === undefined || condition.value === '') {
      return undefined
    }
    return ilike(column, `%${escapeLikePattern(String(condition.value))}%`)
  }
  if (condition.op === 'startsWith') {
    if (condition.value === undefined || condition.value === '') {
      return undefined
    }
    return ilike(column, `${escapeLikePattern(String(condition.value))}%`)
  }
  if (condition.op === 'endsWith') {
    if (condition.value === undefined || condition.value === '') {
      return undefined
    }
    return ilike(column, `%${escapeLikePattern(String(condition.value))}`)
  }
  if (!('value' in condition)) {
    return undefined
  }
  if (condition.value === undefined) {
    return undefined
  }
  if (condition.op === 'eq') {
    return condition.value === null
      ? isNull(column)
      : eq(column, condition.value)
  }
  if (condition.op === 'ne') {
    return condition.value === null
      ? isNotNull(column)
      : ne(column, condition.value)
  }
  if (condition.op === 'gt') {
    return gt(column, condition.value)
  }
  if (condition.op === 'gte') {
    return gte(column, condition.value)
  }
  if (condition.op === 'lt') {
    return lt(column, condition.value)
  }
  return lte(column, condition.value)
}

function expandWhereObjectNode<TTable extends PgTable>(
  node: DrizzleWhereObjectNode<TTable>,
): DrizzleWhereCondition<TTable>[] {
  const result: DrizzleWhereCondition<TTable>[] = []

  for (const [field, raw] of Object.entries(node)) {
    if (raw === undefined) {
      continue
    }

    const normalizedField = field as DrizzleColumnKey<TTable>
    if (!isWhereFieldFilter(raw)) {
      result.push({
        field: normalizedField,
        op: 'eq',
        value: raw,
      })
      continue
    }

    if (raw.eq !== undefined) {
      result.push({ field: normalizedField, op: 'eq', value: raw.eq })
    }
    if (raw.ne !== undefined) {
      result.push({ field: normalizedField, op: 'ne', value: raw.ne })
    }
    if (raw.gt !== undefined) {
      result.push({ field: normalizedField, op: 'gt', value: raw.gt })
    }
    if (raw.gte !== undefined) {
      result.push({ field: normalizedField, op: 'gte', value: raw.gte })
    }
    if (raw.lt !== undefined) {
      result.push({ field: normalizedField, op: 'lt', value: raw.lt })
    }
    if (raw.lte !== undefined) {
      result.push({ field: normalizedField, op: 'lte', value: raw.lte })
    }
    if (raw.like !== undefined) {
      result.push({ field: normalizedField, op: 'like', value: raw.like })
    }
    if (raw.startsWith !== undefined) {
      result.push({
        field: normalizedField,
        op: 'startsWith',
        value: raw.startsWith,
      })
    }
    if (raw.endsWith !== undefined) {
      result.push({
        field: normalizedField,
        op: 'endsWith',
        value: raw.endsWith,
      })
    }
    if (raw.in !== undefined) {
      result.push({ field: normalizedField, op: 'in', value: raw.in })
    }
    if (raw.notIn !== undefined) {
      result.push({ field: normalizedField, op: 'notIn', value: raw.notIn })
    }
    if (raw.between !== undefined) {
      result.push({
        field: normalizedField,
        op: 'between',
        value: {
          from: raw.between.from,
          to: raw.between.to,
        },
      })
    }
    if (raw.isNull) {
      result.push({ field: normalizedField, op: 'isNull' })
    }
    if (raw.isNotNull) {
      result.push({ field: normalizedField, op: 'isNotNull' })
    }
  }

  return result
}
