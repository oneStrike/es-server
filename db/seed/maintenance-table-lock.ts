import type { Db } from './db-client'
import { sql } from 'drizzle-orm'

const MAINTENANCE_LOCK_TIMEOUT = '3s'

/**
 * 阻断 demo seed 与应用写入的交错：在 seed 事务内对 public schema 的全部真实
 * base table（普通表和分区表）按稳定顺序取得 EXCLUSIVE table lock。
 *
 * 不能用 job advisory lock 代替这里的 table lock：应用写入不持有该 job lock。
 * 表名只从 pg_catalog 读取，并通过 PostgreSQL format('%I') 作为 identifier 引用，
 * 因而不会把外部输入拼接进动态 SQL。
 */
export async function acquirePublicSchemaMaintenanceTableLocks(db: Db) {
  await db.execute(
    sql`SELECT set_config('lock_timeout', ${MAINTENANCE_LOCK_TIMEOUT}, true)`,
  )

  await db.execute(sql`
    DO $$
    DECLARE
      table_record record;
    BEGIN
      FOR table_record IN
        SELECT
          namespace_record.nspname AS schema_name,
          class_record.relname AS table_name
        FROM pg_catalog.pg_class AS class_record
        INNER JOIN pg_catalog.pg_namespace AS namespace_record
          ON namespace_record.oid = class_record.relnamespace
        WHERE namespace_record.nspname = 'public'
          AND class_record.relkind IN ('r', 'p')
        ORDER BY
          namespace_record.nspname,
          class_record.relname,
          class_record.oid
      LOOP
        EXECUTE format(
          'LOCK TABLE %I.%I IN EXCLUSIVE MODE',
          table_record.schema_name,
          table_record.table_name
        );
      END LOOP;
    END $$;
  `)
}
