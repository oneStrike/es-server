import type { Db, PgTable, SQL, TableConfig } from './drizzle.type'
import {
  applyCountDelta,
  existsActive as existsActiveExtension,
  exists as existsExtension,
  findPagination as findPaginationExtension,
  maxOrder as maxOrderExtension,
  softDelete as softDeleteExtension,
  softDeleteMany as softDeleteManyExtension,
  swapField as swapFieldExtension,
} from './extensions'

export function createDrizzleExtensions(db: Db) {
  return {
    exists: async (table: PgTable<TableConfig>, where?: SQL) =>
      existsExtension(db, table, where),
    existsActive: async (table: PgTable<TableConfig>, where?: SQL) =>
      existsActiveExtension(db, table, where),
    findPagination: async (
      table: PgTable<TableConfig>,
      options?: Parameters<typeof findPaginationExtension>[2],
    ) => findPaginationExtension(db, table, options),
    maxOrder: async (
      table: PgTable<TableConfig>,
      where?: SQL,
      field?: string,
    ) => maxOrderExtension(db, table, where, field),
    softDelete: async (table: PgTable<TableConfig>, where: SQL) =>
      softDeleteExtension(db, table, where),
    softDeleteMany: async (table: PgTable<TableConfig>, where: SQL) =>
      softDeleteManyExtension(db, table, where),
    swapField: async (
      table: PgTable<TableConfig>,
      options: Parameters<typeof swapFieldExtension>[2],
    ) => swapFieldExtension(db, table, options),
    applyCountDelta: async (
      table: PgTable<TableConfig>,
      where: SQL,
      field: string,
      delta: number,
    ) => applyCountDelta(db, table, where, field, delta),
  }
}

