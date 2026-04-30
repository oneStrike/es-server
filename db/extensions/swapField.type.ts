import type { SQL } from '../core/drizzle.type'

/**
 * 字段交换扩展的入参。
 */
export interface SwapFieldOptions {
  where: [{ id: number }, { id: number }]
  field?: string
  sourceField?: string
  recordWhere?: SQL
}
