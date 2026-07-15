import type { DbTransaction } from '@db/core'
import { sql } from 'drizzle-orm'

const APP_USER_ACCOUNT_PREFIX = 'u'

/**
 * 在创建用户事务内分配唯一账号。
 *
 * 账号使用 app_user identity sequence 作为全局单调来源，避免“先查询再插入”的
 * 并发竞态。原生 SQL 用于在数据库侧原子获取 sequence 值，Drizzle builder 无法表达
 * nextval 与 pg_get_serial_sequence 的组合。
 */
export async function allocateAppUserAccountInTx(
  tx: DbTransaction,
): Promise<string> {
  const result = await tx.execute<{ account: string }>(sql`
    SELECT concat(
      ${APP_USER_ACCOUNT_PREFIX}::text,
      nextval(pg_get_serial_sequence('public.app_user', 'id'))
    ) AS account
  `)
  const [row] = result.rows
  if (!row?.account) {
    throw new Error('应用用户账号分配失败')
  }
  return row.account
}
