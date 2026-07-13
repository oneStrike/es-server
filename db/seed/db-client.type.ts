/**
 * 演示 seed 的所有领域写入必须位于同一原子事务中，避免 root client 意外绕过
 * rollback 和 advisory-lock 边界。
 */
import type { DbExecutor, DbTransaction } from '@db/core'

/** 仅供 seed domain / cleanup helper 使用的事务客户端。 */
export type Db = DbTransaction

/** 建连工厂持有的根客户端；只用于开启最外层 demo seed 事务。 */
export type SeedClientDb = DbExecutor
