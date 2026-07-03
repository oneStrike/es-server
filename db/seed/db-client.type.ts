import type * as schema from '@db/schema'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { relations } from '../core/drizzle-relations'

/**
 * Seed 脚本使用的数据库客户端类型。
 * 传入完整 schema（表 + relations），使 db.query 拥有完整的类型推导。
 */
export type Db = NodePgDatabase<typeof schema & typeof relations>
